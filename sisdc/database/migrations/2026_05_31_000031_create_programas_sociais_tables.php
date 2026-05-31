<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Programas sociais (lookup) e pivot com cadastros (N:N).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('programas_sociais', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('nome');
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        Schema::create('cadastro_programa_social', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('cadastro_id')->constrained('cadastros')->cascadeOnDelete();
            $table->foreignId('programa_social_id')->constrained('programas_sociais')->cascadeOnDelete();
            $table->string('observacao')->nullable();
            $table->timestamps();

            $table->unique(['cadastro_id', 'programa_social_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cadastro_programa_social');
        Schema::dropIfExists('programas_sociais');
    }
};
