<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Role;
use App\Livewire\Usuarios;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class UsuariosTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => Role::ADMINISTRADOR]);
    }

    public function test_admin_cria_operador_de_campo(): void
    {
        Livewire::actingAs($this->admin())
            ->test(Usuarios::class)
            ->set('nome', 'Carlos Campo')
            ->set('email', 'carlos@morretes.pr.gov.br')
            ->set('perfil', Role::OPERADOR->value)
            ->set('senha', 'senha-forte-1')
            ->call('criar')
            ->assertHasNoErrors();

        $this->assertDatabaseHas('users', [
            'email' => 'carlos@morretes.pr.gov.br',
            'role' => 'operador',
            'ativo' => true,
        ]);
    }

    public function test_email_duplicado_falha(): void
    {
        User::factory()->create(['email' => 'dup@morretes.pr.gov.br']);

        Livewire::actingAs($this->admin())
            ->test(Usuarios::class)
            ->set('nome', 'X')
            ->set('email', 'dup@morretes.pr.gov.br')
            ->set('senha', 'senha-forte-1')
            ->call('criar')
            ->assertHasErrors('email');
    }

    public function test_admin_desativa_usuario(): void
    {
        $operador = User::factory()->create(['role' => Role::OPERADOR, 'ativo' => true]);

        Livewire::actingAs($this->admin())
            ->test(Usuarios::class)
            ->call('alternarAtivo', $operador->id);

        $this->assertFalse($operador->refresh()->ativo);
    }

    public function test_admin_nao_desativa_a_si_mesmo(): void
    {
        $admin = $this->admin();

        Livewire::actingAs($admin)
            ->test(Usuarios::class)
            ->call('alternarAtivo', $admin->id);

        $this->assertTrue($admin->refresh()->ativo);
    }

    public function test_auditor_e_operador_nao_acessam(): void
    {
        $this->actingAs(User::factory()->create(['role' => Role::AUDITOR]))
            ->get(route('usuarios'))->assertForbidden();

        $this->actingAs(User::factory()->create(['role' => Role::OPERADOR]))
            ->get(route('usuarios'))->assertForbidden();
    }
}
