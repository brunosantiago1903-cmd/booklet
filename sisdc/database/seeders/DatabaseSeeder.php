<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Usuarios padrao (um por perfil) para acesso inicial ao painel.
        User::updateOrCreate(
            ['email' => 'admin@morretes.pr.gov.br'],
            ['name' => 'Administrador', 'password' => Hash::make('senha-segura'), 'role' => Role::ADMINISTRADOR],
        );
        User::updateOrCreate(
            ['email' => 'auditor@morretes.pr.gov.br'],
            ['name' => 'Auditor', 'password' => Hash::make('senha-segura'), 'role' => Role::AUDITOR],
        );
        User::updateOrCreate(
            ['email' => 'operador@morretes.pr.gov.br'],
            ['name' => 'Operador de Campo', 'password' => Hash::make('senha-segura'), 'role' => Role::OPERADOR],
        );

        $this->call(ProgramaSocialSeeder::class);
    }
}
