<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Avaliacao de risco ambiental do terreno (relacao 1:1 com cadastros).
 * Reflete os blocos "Riscos" e "Relevo/Rio" do formulario de campo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('riscos_ambientais', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cadastro_id')->unique()->constrained('cadastros')->cascadeOnDelete();

            // Agua / inundacao.
            $table->boolean('potencialmente_inundavel')->nullable();
            $table->text('escoamento_propriedade')->nullable();
            $table->boolean('escoamento_rua')->nullable();
            $table->text('escoamento_rua_descricao')->nullable();
            $table->boolean('acumulo_agua')->nullable();
            $table->text('acumulo_agua_onde')->nullable();

            // Deslizamento.
            $table->boolean('historico_deslizamento')->nullable();
            $table->text('historico_deslizamento_descricao')->nullable();
            $table->boolean('risco_deslizamento_atual')->nullable();
            $table->text('risco_deslizamento_observacoes')->nullable();

            // Relevo / solo / erosao.
            $table->text('relevo_descricao')->nullable();
            $table->boolean('solo_exposto')->nullable();
            $table->text('solo_exposto_observacoes')->nullable();
            $table->boolean('erosao_expressiva')->nullable();
            $table->text('erosao_expressiva_observacoes')->nullable();

            // Rio.
            $table->boolean('rio_passa_propriedade')->nullable();
            $table->string('rio_nome')->nullable();
            $table->string('rio_largura')->nullable();
            $table->string('mata_ciliar')->nullable(); // preservada | desmatada
            $table->text('mata_ciliar_observacoes')->nullable();
            $table->boolean('erosao_beira_rio')->nullable();
            $table->text('erosao_beira_rio_observacoes')->nullable();
            $table->boolean('rio_assoreado')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('riscos_ambientais');
    }
};
