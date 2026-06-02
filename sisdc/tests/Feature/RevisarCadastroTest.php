<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Criticidade;
use App\Enums\Role;
use App\Enums\StatusCadastro;
use App\Livewire\RevisarCadastro;
use App\Models\Cadastro;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class RevisarCadastroTest extends TestCase
{
    use RefreshDatabase;

    public function test_auditor_edita_valida_e_recalcula_criticidade(): void
    {
        $auditor = User::factory()->create(['role' => Role::AUDITOR]);
        $cadastro = Cadastro::factory()->create([
            'nome_familia' => 'Antiga',
            'criticidade_atual' => Criticidade::SEM_RISCO->value,
        ]);

        Livewire::actingAs($auditor)
            ->test(RevisarCadastro::class, ['cadastro' => $cadastro])
            ->set('dados.nome_familia', 'Família Corrigida')
            ->set('habitantes', [['nome_completo' => 'Novo Morador', 'cpf' => '123']])
            ->set('novaAvaliacao', true)
            ->set('avaliacaoTipo', 'deslizamento')
            ->set('avaliacaoCriticidade', Criticidade::MUITO_ALTO->value)
            ->call('validar');

        $cadastro->refresh();
        $this->assertSame('Família Corrigida', $cadastro->nome_familia);
        $this->assertSame(StatusCadastro::VALIDADO, $cadastro->status);
        $this->assertSame(Criticidade::MUITO_ALTO, $cadastro->criticidade_atual);
        $this->assertSame('Novo Morador', $cadastro->habitantes()->first()->nome_completo);
        $this->assertSame($auditor->id, $cadastro->validado_por_id);
    }

    public function test_rejeicao_exige_motivo(): void
    {
        $auditor = User::factory()->create(['role' => Role::AUDITOR]);
        $cadastro = Cadastro::factory()->create();

        Livewire::actingAs($auditor)
            ->test(RevisarCadastro::class, ['cadastro' => $cadastro])
            ->set('motivoRejeicao', '')
            ->call('rejeitar')
            ->assertHasErrors('motivoRejeicao');
    }

    public function test_operador_nao_acessa_revisao(): void
    {
        $operador = User::factory()->create(['role' => Role::OPERADOR]);
        $cadastro = Cadastro::factory()->create();

        $this->actingAs($operador)->get(route('auditoria.revisar', $cadastro))->assertForbidden();
    }
}
