<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Habilita a extensao PostGIS. O usuario do banco precisa de privilegio para
 * criar extensoes (em producao, normalmente executado uma vez pelo DBA).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS postgis;');
    }

    public function down(): void
    {
        // Nao removemos a extensao no rollback para nao quebrar outros schemas.
    }
};
