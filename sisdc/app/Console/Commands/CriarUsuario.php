<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

use function Laravel\Prompts\password;
use function Laravel\Prompts\select;
use function Laravel\Prompts\text;

/**
 * Cria um usuário do painel de forma segura (senha digitada, nunca em seed).
 *
 *   php artisan sisdc:usuario
 *   php artisan sisdc:usuario --name="Maria" --email=maria@x.gov.br --role=administrador
 */
class CriarUsuario extends Command
{
    protected $signature = 'sisdc:usuario
        {--name= : Nome do usuário}
        {--email= : E-mail (login)}
        {--role= : Perfil: administrador|auditor|operador}';

    protected $description = 'Cria um usuário do SISDC com senha segura (uso em produção).';

    public function handle(): int
    {
        $name = $this->option('name') ?: text('Nome', required: true);
        $email = $this->option('email') ?: text('E-mail', required: true);

        $role = $this->option('role') ?: select(
            'Perfil',
            collect(Role::cases())->mapWithKeys(fn (Role $r) => [$r->value => $r->label()])->all(),
        );

        $senha = password('Senha (mín. 8 caracteres)', required: true);

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'role' => $role, 'password' => $senha],
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'unique:users,email'],
                'role' => ['required', 'in:'.implode(',', array_column(Role::cases(), 'value'))],
                'password' => ['required', 'string', 'min:8'],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $erro) {
                $this->error($erro);
            }

            return self::FAILURE;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'password' => Hash::make($senha),
            'ativo' => true,
        ]);

        $this->info("Usuário #{$user->id} criado: {$user->email} ({$role}).");

        return self::SUCCESS;
    }
}
