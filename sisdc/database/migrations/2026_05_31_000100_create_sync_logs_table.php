<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Log de lotes de sincronizacao. Cada requisicao de sync do tablet gera um
 * registro com o resultado por item, util para auditoria e reprocessamento.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_logs', function (Blueprint $table): void {
            $table->id();
            $table->uuid('batch_uuid')->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('device_id')->nullable();
            $table->unsignedInteger('total_itens')->default(0);
            $table->unsignedInteger('itens_criados')->default(0);
            $table->unsignedInteger('itens_atualizados')->default(0);
            $table->unsignedInteger('itens_ignorados')->default(0);
            $table->unsignedInteger('itens_com_erro')->default(0);
            $table->jsonb('resultado')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_logs');
    }
};
