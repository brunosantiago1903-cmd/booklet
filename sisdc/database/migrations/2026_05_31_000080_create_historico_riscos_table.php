<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Historico de risco do domicilio (linha do tempo).
 *
 * Cada linha e uma avaliacao/evento de risco datado, com tipo (area de
 * atencao), criticidade e, opcionalmente, um ponto especifico (ex.: ponto de
 * deslizamento dentro do terreno). Permite reconstruir a evolucao do risco
 * de um cadastro e alimentar as camadas temporais do mapa.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('historico_riscos', function (Blueprint $table): void {
            $table->id();
            $table->uuid('client_uuid')->unique();
            $table->foreignId('cadastro_id')->constrained('cadastros')->cascadeOnDelete();

            $table->string('tipo_evento');   // App\Enums\AreaAtencao
            $table->string('criticidade');   // App\Enums\Criticidade
            $table->text('descricao')->nullable();
            $table->timestamp('avaliado_em');

            // Coordenadas especificas do ponto de risco (podem diferir da casa).
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->foreignId('registrado_por_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['cadastro_id', 'avaliado_em']);
            $table->index(['tipo_evento', 'criticidade']);
        });

        DB::statement('ALTER TABLE historico_riscos ADD COLUMN localizacao geography(POINT, 4326) NULL;');
        DB::statement('CREATE INDEX historico_riscos_localizacao_gix ON historico_riscos USING GIST (localizacao);');
    }

    public function down(): void
    {
        Schema::dropIfExists('historico_riscos');
    }
};
