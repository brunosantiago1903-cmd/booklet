<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('anexos', function (Blueprint $table): void {
            $table->string('legenda')->nullable()->after('categoria');
        });
    }

    public function down(): void
    {
        Schema::table('anexos', function (Blueprint $table): void {
            $table->dropColumn('legenda');
        });
    }
};
