<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed seguro para qualquer ambiente: apenas dados de referência
     * (programas sociais). Usuários NÃO são semeados aqui.
     *
     * - Produção: crie o administrador com `php artisan sisdc:usuario`.
     * - Desenvolvimento/homologação: use `db:seed --class=DemoUsersSeeder`.
     */
    public function run(): void
    {
        $this->call(ProgramaSocialSeeder::class);
    }
}
