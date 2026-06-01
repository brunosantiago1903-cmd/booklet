<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Usuários de demonstração (um por perfil) para DESENVOLVIMENTO/HOMOLOGAÇÃO.
 * NÃO execute em produção — usa senha padrão conhecida.
 */
class DemoUsersSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('DemoUsersSeeder ignorado em produção.');

            return;
        }

        $demo = [
            ['Administrador', 'admin@morretes.pr.gov.br', Role::ADMINISTRADOR],
            ['Auditor', 'auditor@morretes.pr.gov.br', Role::AUDITOR],
            ['Operador de Campo', 'operador@morretes.pr.gov.br', Role::OPERADOR],
        ];

        foreach ($demo as [$nome, $email, $papel]) {
            User::updateOrCreate(
                ['email' => $email],
                ['name' => $nome, 'password' => Hash::make('senha-segura'), 'role' => $papel],
            );
        }
    }
}
