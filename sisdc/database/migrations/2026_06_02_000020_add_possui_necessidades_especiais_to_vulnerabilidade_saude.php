<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vulnerabilidade_saude', function (Blueprint $table): void {
            $table->boolean('possui_necessidades_especiais')->nullable()->after('cadastro_id');
        });
    }

    public function down(): void
    {
        Schema::table('vulnerabilidade_saude', function (Blueprint $table): void {
            $table->dropColumn('possui_necessidades_especiais');
        });
    }
};
