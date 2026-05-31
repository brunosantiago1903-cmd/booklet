<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dados de saude/vulnerabilidade do domicilio (relacao 1:1 com cadastros).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vulnerabilidade_saude', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cadastro_id')->unique()->constrained('cadastros')->cascadeOnDelete();

            $table->text('necessidades_especiais')->nullable();
            $table->boolean('necessita_medicacao')->nullable();
            $table->text('medicacao_qual')->nullable();
            $table->text('restricao_medicamento')->nullable();
            $table->boolean('doenca_cronica')->nullable();
            $table->text('doenca_cronica_qual')->nullable();
            $table->text('alergias')->nullable();

            // Animais de estimacao.
            $table->unsignedSmallInteger('animais_caes')->default(0);
            $table->unsignedSmallInteger('animais_gatos')->default(0);
            $table->unsignedSmallInteger('animais_aves')->default(0);
            $table->string('animais_outros')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vulnerabilidade_saude');
    }
};
