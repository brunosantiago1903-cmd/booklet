<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Habitantes da residencia (tabela separada, relacao 1:N com cadastros).
 *
 * Optou-se por tabela relacional em vez de JSON porque os habitantes sao
 * consultados/filtrados individualmente (ex.: localizar pessoas com
 * necessidades especiais ou tipo sanguineo especifico numa area de risco).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('habitantes', function (Blueprint $table): void {
            $table->id();
            $table->uuid('client_uuid')->unique();
            $table->foreignId('cadastro_id')->constrained('cadastros')->cascadeOnDelete();

            $table->string('nome_completo');
            $table->string('cpf', 14)->nullable()->index();
            $table->date('data_nascimento')->nullable();
            $table->string('sexo', 20)->nullable();
            $table->string('celular', 20)->nullable();

            // Escolaridade: nivel (S/E, F, M, S) + situacao (completo/incompleto).
            $table->string('escolaridade_nivel', 10)->nullable();
            $table->string('escolaridade_situacao', 12)->nullable();

            // Trabalho.
            $table->boolean('trabalha')->nullable();
            $table->string('trabalho_tipo', 12)->nullable(); // formal | informal
            $table->string('deslocamento_meio')->nullable();
            $table->string('deslocamento_tempo')->nullable();

            $table->string('tipo_sanguineo', 5)->nullable();
            $table->boolean('responsavel_familiar')->default(false);

            $table->timestamps();

            $table->index('cadastro_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('habitantes');
    }
};
