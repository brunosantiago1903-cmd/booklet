<?php

declare(strict_types=1);

use App\Enums\StatusCadastro;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tabela principal de cadastro (ocorrencia / domicilio).
 *
 * Cada registro representa uma familia/domicilio levantado em campo. A
 * geolocalizacao e armazenada como GEOGRAPHY(POINT, 4326) do PostGIS (SRID
 * WGS84) para permitir consultas espaciais (ST_DWithin, ST_Distance) e
 * indice GIST. Mantemos tambem latitude/longitude em colunas numericas para
 * exibicao rapida e para o transito offline (JSON do IndexedDB).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cadastros', function (Blueprint $table): void {
            // Chave primaria interna.
            $table->id();

            // UUID gerado no cliente (tablet). E a chave de idempotencia do
            // sync: garante que o mesmo registro offline nunca seja duplicado.
            $table->uuid('client_uuid')->unique();

            // Identificadores oficiais.
            $table->string('codigo_sisdc')->nullable()->index();
            $table->string('codigo_interno')->nullable()->index();

            // Areas de atencao associadas (multiplas) - ex.: ["deslizamento","inundacao"].
            $table->jsonb('areas_atencao')->nullable();

            // Identificacao da familia / endereco.
            $table->string('nome_familia');
            $table->string('cep', 9)->nullable();
            $table->string('endereco')->nullable();
            $table->string('numero', 20)->nullable();
            $table->string('complemento')->nullable();
            $table->string('bairro')->nullable();
            $table->string('cidade')->default('Morretes');
            $table->string('uf', 2)->default('PR');

            $table->string('padrao_construtivo')->nullable();
            $table->string('telefone_fixo', 20)->nullable();
            $table->string('telefone_celular', 20)->nullable();

            // Coordenadas brutas (como digitadas/coletadas no GPS do tablet).
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('precisao_gps_m', 8, 2)->nullable();

            // Caracteristicas do imovel.
            $table->string('tipo_residencia')->nullable();
            $table->boolean('precisa_abrigo')->nullable();
            $table->boolean('moradores_encontrados')->nullable();
            $table->unsignedSmallInteger('qtd_pessoas_domicilio')->nullable();
            $table->decimal('renda_domiciliar', 12, 2)->nullable();
            $table->boolean('atendido_programa_social')->nullable();

            // Bloco "Preparacao" do formulario.
            $table->text('percepcao_risco')->nullable();
            $table->text('acao_risco_iminente')->nullable();
            $table->boolean('cadastrado_alertas')->nullable();
            $table->text('medidas_sugeridas')->nullable();

            // Criticidade vigente (derivada do historico de risco mais recente);
            // denormalizada para acelerar filtros do mapa.
            $table->string('criticidade_atual')->default('sem_risco')->index();

            // Fluxo de auditoria/sync.
            $table->string('status')->default(StatusCadastro::SINCRONIZADO->value)->index();
            $table->string('device_id')->nullable();
            $table->timestamp('coletado_em')->nullable();
            $table->timestamp('sincronizado_em')->nullable();
            $table->timestamp('validado_em')->nullable();
            $table->text('motivo_rejeicao')->nullable();

            // Auditoria de autoria.
            $table->foreignId('operador_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('validado_por_id')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();
        });

        // Coluna espacial GEOGRAPHY(POINT, 4326) + indice GIST.
        // O Schema Builder do Laravel nao expoe geography nativamente, entao
        // usamos SQL cru (compativel com clickbar/laravel-magellan nos models).
        DB::statement('ALTER TABLE cadastros ADD COLUMN localizacao geography(POINT, 4326) NULL;');
        DB::statement('CREATE INDEX cadastros_localizacao_gix ON cadastros USING GIST (localizacao);');
    }

    public function down(): void
    {
        Schema::dropIfExists('cadastros');
    }
};
