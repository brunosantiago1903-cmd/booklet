<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Infraestrutura / saneamento do domicilio (relacao 1:1 com cadastros).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('infraestruturas', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cadastro_id')->unique()->constrained('cadastros')->cascadeOnDelete();

            // Captacao de agua: nascente|poco|sanepar|associacao|outro.
            $table->string('captacao_agua')->nullable();
            $table->string('captacao_agua_outro')->nullable();
            $table->text('poco_nascente_localizacao')->nullable();
            $table->decimal('poco_profundidade_m', 8, 2)->nullable();
            $table->decimal('poco_latitude', 10, 7)->nullable();
            $table->decimal('poco_longitude', 10, 7)->nullable();

            // Residuos solidos.
            $table->boolean('coleta_lixo')->nullable();
            $table->text('lixo_organico_destino')->nullable();
            $table->text('lixo_reciclavel_destino')->nullable();
            $table->boolean('conhece_associacoes_reciclaveis')->nullable();
            $table->string('associacao_reciclavel_qual')->nullable();
            $table->boolean('coleta_seletiva_proxima')->nullable();
            $table->text('observacoes_residuos')->nullable();

            // Saneamento: nenhum|fossa|esgoto_sanepar|saneamento_ecologico.
            $table->string('saneamento_tipo')->nullable();
            $table->string('saneamento_qual')->nullable();
            $table->text('saneamento_localizacao')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('infraestruturas');
    }
};
