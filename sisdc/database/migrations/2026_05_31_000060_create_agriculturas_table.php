<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Producao agricola da propriedade (relacao 1:1 opcional com cadastros).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agriculturas', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cadastro_id')->unique()->constrained('cadastros')->cascadeOnDelete();

            $table->string('tamanho_propriedade')->nullable();
            $table->text('areas_plantio')->nullable();
            $table->text('culturas')->nullable();
            $table->string('tipo_cultivo')->nullable(); // organico | convencional
            $table->decimal('renda_media', 12, 2)->nullable();
            $table->unsignedSmallInteger('pessoas_trabalham')->nullable();
            $table->text('equipamentos_maquinarios')->nullable();
            $table->boolean('barracao_proprio')->nullable();
            $table->boolean('sistema_irrigacao')->nullable();
            $table->text('observacao')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agriculturas');
    }
};
