<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Anexos (fotos) polimorficos. O formulario pede fotos em varios pontos:
 * residencia, poco/nascente, saneamento e riscos. No fluxo offline, a foto e
 * armazenada como Blob no IndexedDB e enviada apos o cadastro sincronizar.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('anexos', function (Blueprint $table): void {
            $table->id();
            $table->uuid('client_uuid')->unique();
            $table->morphs('anexavel'); // anexavel_type / anexavel_id
            $table->string('categoria')->nullable(); // residencia|poco|saneamento|risco
            $table->string('disk')->default('local');
            $table->string('path');
            $table->string('mime', 100)->nullable();
            $table->unsignedBigInteger('tamanho_bytes')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamp('capturado_em')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anexos');
    }
};
