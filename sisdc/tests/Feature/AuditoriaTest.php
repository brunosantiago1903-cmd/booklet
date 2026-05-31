<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Role;
use App\Livewire\Auditoria;
use App\Models\Cadastro;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class AuditoriaTest extends TestCase
{
    use RefreshDatabase;

    public function test_auditor_valida_cadastro(): void
    {
        $auditor = User::factory()->create(['role' => Role::AUDITOR]);
        $cadastro = Cadastro::factory()->create();

        Livewire::actingAs($auditor)
            ->test(Auditoria::class)
            ->call('validar', $cadastro->id);

        $this->assertDatabaseHas('cadastros', [
            'id' => $cadastro->id,
            'status' => 'validado',
            'validado_por_id' => $auditor->id,
        ]);
    }

    public function test_auditor_rejeita_com_motivo(): void
    {
        $auditor = User::factory()->create(['role' => Role::AUDITOR]);
        $cadastro = Cadastro::factory()->create();

        Livewire::actingAs($auditor)
            ->test(Auditoria::class)
            ->call('abrirRejeicao', $cadastro->id)
            ->set('motivoRejeicao', 'Coordenadas inconsistentes com o endereço.')
            ->call('rejeitar');

        $this->assertDatabaseHas('cadastros', [
            'id' => $cadastro->id,
            'status' => 'rejeitado',
        ]);
    }

    public function test_rejeicao_exige_motivo(): void
    {
        $auditor = User::factory()->create(['role' => Role::AUDITOR]);
        $cadastro = Cadastro::factory()->create();

        Livewire::actingAs($auditor)
            ->test(Auditoria::class)
            ->call('abrirRejeicao', $cadastro->id)
            ->set('motivoRejeicao', '')
            ->call('rejeitar')
            ->assertHasErrors(['motivoRejeicao']);
    }

    public function test_operador_nao_acessa_auditoria(): void
    {
        $operador = User::factory()->create(['role' => Role::OPERADOR]);

        $this->actingAs($operador)
            ->get('/painel/auditoria')
            ->assertForbidden();
    }
}
