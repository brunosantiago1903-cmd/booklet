<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_pagina_de_login_abre(): void
    {
        $this->get('/login')->assertOk()->assertSee('Defesa Civil de Morretes');
    }

    public function test_login_com_credenciais_validas(): void
    {
        $user = User::factory()->create([
            'email' => 'op@morretes.pr.gov.br',
            'password' => Hash::make('senha-segura'),
        ]);

        $this->post('/login', [
            'email' => 'op@morretes.pr.gov.br',
            'password' => 'senha-segura',
        ])->assertRedirect(route('mapa'));

        $this->assertAuthenticatedAs($user);
    }

    public function test_login_com_senha_invalida_falha(): void
    {
        User::factory()->create([
            'email' => 'op@morretes.pr.gov.br',
            'password' => Hash::make('senha-segura'),
        ]);

        $this->from('/login')->post('/login', [
            'email' => 'op@morretes.pr.gov.br',
            'password' => 'errada',
        ])->assertRedirect('/login')->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_usuario_inativo_nao_entra(): void
    {
        User::factory()->create([
            'email' => 'inativo@morretes.pr.gov.br',
            'password' => Hash::make('senha-segura'),
            'ativo' => false,
        ]);

        $this->from('/login')->post('/login', [
            'email' => 'inativo@morretes.pr.gov.br',
            'password' => 'senha-segura',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post('/logout')->assertRedirect(route('login'));
        $this->assertGuest();
    }
}
