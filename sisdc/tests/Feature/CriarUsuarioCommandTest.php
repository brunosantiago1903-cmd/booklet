<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CriarUsuarioCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_cria_administrador_com_senha(): void
    {
        $this->artisan('sisdc:usuario', [
            '--name' => 'Maria Gestora',
            '--email' => 'maria@morretes.pr.gov.br',
            '--role' => 'administrador',
        ])
            ->expectsQuestion('Senha (mín. 8 caracteres)', 'super-secreta')
            ->assertExitCode(0);

        $user = User::where('email', 'maria@morretes.pr.gov.br')->firstOrFail();
        $this->assertSame('administrador', $user->role->value);
        $this->assertNotSame('super-secreta', $user->password); // hasheada
    }

    public function test_rejeita_email_duplicado(): void
    {
        User::factory()->create(['email' => 'dup@morretes.pr.gov.br']);

        $this->artisan('sisdc:usuario', [
            '--name' => 'Outro',
            '--email' => 'dup@morretes.pr.gov.br',
            '--role' => 'auditor',
        ])
            ->expectsQuestion('Senha (mín. 8 caracteres)', 'super-secreta')
            ->assertExitCode(1);
    }
}
