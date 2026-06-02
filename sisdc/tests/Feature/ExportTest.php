<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Role;
use App\Livewire\Relatorios;
use App\Models\Cadastro;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class ExportTest extends TestCase
{
    use RefreshDatabase;

    private function auditor(): User
    {
        return User::factory()->create(['role' => Role::AUDITOR]);
    }

    public function test_pdf_individual_do_cadastro(): void
    {
        $cadastro = Cadastro::factory()->create();

        $resp = $this->actingAs($this->auditor())
            ->get(route('export.cadastro.pdf', $cadastro));

        $resp->assertOk();
        $this->assertSame('application/pdf', $resp->headers->get('content-type'));
    }

    public function test_excel_da_lista(): void
    {
        Cadastro::factory()->count(3)->create();

        $resp = $this->actingAs($this->auditor())->get(route('export.lista.xlsx'));

        $resp->assertOk();
        $this->assertStringContainsString('spreadsheetml', $resp->headers->get('content-type'));
        $this->assertStringContainsString('cadastros.xlsx', $resp->headers->get('content-disposition'));
    }

    public function test_pdf_da_lista_agrupado_por_bairro(): void
    {
        Cadastro::factory()->count(2)->create(['bairro' => 'Centro']);

        $resp = $this->actingAs($this->auditor())
            ->get(route('export.lista.pdf', ['agrupar' => 'bairro']));

        $resp->assertOk();
        $this->assertSame('application/pdf', $resp->headers->get('content-type'));
    }

    public function test_relatorios_filtra_por_bairro_e_criticidade(): void
    {
        Cadastro::factory()->validado()->create(['nome_familia' => 'FamiliaAlfa', 'bairro' => 'Centro']);
        Cadastro::factory()->validado()->create(['nome_familia' => 'FamiliaBeta', 'bairro' => 'Porto']);

        Livewire::actingAs($this->auditor())
            ->test(Relatorios::class)
            ->set('bairro', ['Centro'])
            ->assertSee('FamiliaAlfa')
            ->assertDontSee('FamiliaBeta');
    }

    public function test_operador_nao_acessa_relatorios(): void
    {
        $operador = User::factory()->create(['role' => Role::OPERADOR]);

        $this->actingAs($operador)->get(route('relatorios'))->assertForbidden();
    }
}
