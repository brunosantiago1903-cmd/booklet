<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Cadastro;
use App\Models\ProgramaSocial;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Testes do endpoint de sincronizacao offline.
 *
 * Requer banco PostgreSQL com PostGIS habilitado (a coluna geography e
 * escrita via ST_MakePoint). Configure phpunit.xml com a conexao de teste.
 */
class SyncCadastroTest extends TestCase
{
    use RefreshDatabase;

    private function operador(): User
    {
        return User::factory()->create(['role' => Role::OPERADOR]);
    }

    private function payloadValido(string $uuid): array
    {
        return [
            'batch_uuid' => (string) Str::uuid(),
            'device_id' => 'tablet-teste-01',
            'cadastros' => [[
                'client_uuid' => $uuid,
                'updated_at_client' => now()->toIso8601String(),
                'nome_familia' => 'Familia Silva',
                'latitude' => -25.4767,
                'longitude' => -48.8344,
                'areas_atencao' => ['deslizamento'],
                'historico_riscos' => [[
                    'client_uuid' => (string) Str::uuid(),
                    'tipo_evento' => 'deslizamento',
                    'criticidade' => 'alto',
                    'avaliado_em' => now()->toIso8601String(),
                ]],
            ]],
        ];
    }

    public function test_operador_sincroniza_cadastro_e_define_criticidade(): void
    {
        $uuid = (string) Str::uuid();

        $resp = $this->actingAs($this->operador(), 'sanctum')
            ->postJson('/api/v1/sync/cadastros', $this->payloadValido($uuid));

        $resp->assertStatus(207);
        $this->assertDatabaseHas('cadastros', [
            'client_uuid' => $uuid,
            'criticidade_atual' => 'alto',
            'status' => 'sincronizado',
        ]);
    }

    public function test_reenvio_do_mesmo_uuid_e_idempotente(): void
    {
        $uuid = (string) Str::uuid();
        $payload = $this->payloadValido($uuid);

        $this->actingAs($this->operador(), 'sanctum')
            ->postJson('/api/v1/sync/cadastros', $payload)->assertStatus(207);
        $this->actingAs($this->operador(), 'sanctum')
            ->postJson('/api/v1/sync/cadastros', $payload)->assertStatus(207);

        $this->assertSame(1, Cadastro::where('client_uuid', $uuid)->count());
    }

    public function test_auditor_nao_pode_sincronizar(): void
    {
        $auditor = User::factory()->create(['role' => Role::AUDITOR]);

        $this->actingAs($auditor, 'sanctum')
            ->postJson('/api/v1/sync/cadastros', $this->payloadValido((string) Str::uuid()))
            ->assertForbidden();
    }

    public function test_sincroniza_programas_sociais_e_escolaridade(): void
    {
        $programa = ProgramaSocial::create([
            'slug' => 'bolsa-familia', 'nome' => 'Bolsa Família', 'ativo' => true,
        ]);

        $uuid = (string) Str::uuid();
        $payload = $this->payloadValido($uuid);
        $payload['cadastros'][0]['programas_sociais'] = ['bolsa-familia'];
        $payload['cadastros'][0]['habitantes'] = [[
            'client_uuid' => (string) Str::uuid(),
            'nome_completo' => 'João',
            'escolaridade_nivel' => 'M',
            'escolaridade_situacao' => 'completo',
            'trabalha' => true,
            'trabalho_tipo' => 'formal',
        ]];

        $this->actingAs($this->operador(), 'sanctum')
            ->postJson('/api/v1/sync/cadastros', $payload)->assertStatus(207);

        $cadastro = Cadastro::where('client_uuid', $uuid)->firstOrFail();
        $this->assertTrue($cadastro->atendido_programa_social);
        $this->assertTrue($cadastro->programasSociais->contains($programa));
        $this->assertSame('M', $cadastro->habitantes->first()->escolaridade_nivel);
        $this->assertTrue($cadastro->habitantes->first()->trabalha);
    }

    public function test_rascunho_incompleto_nao_derruba_o_lote(): void
    {
        $valido = (string) Str::uuid();
        $invalido = (string) Str::uuid();

        $payload = $this->payloadValido($valido);
        // Segundo item e um rascunho sem nome da familia (incompleto).
        $payload['cadastros'][] = [
            'client_uuid' => $invalido,
            'updated_at_client' => now()->toIso8601String(),
            'nome_familia' => '',
        ];

        $resp = $this->actingAs($this->operador(), 'sanctum')
            ->postJson('/api/v1/sync/cadastros', $payload);

        $resp->assertStatus(207);
        // O valido sobe; o incompleto vira 'erro' sem travar o lote.
        $this->assertDatabaseHas('cadastros', ['client_uuid' => $valido, 'status' => 'sincronizado']);
        $this->assertDatabaseMissing('cadastros', ['client_uuid' => $invalido]);
        $resp->assertJsonFragment(['acao' => 'erro']);
    }

    public function test_cadastro_sem_coordenadas_sincroniza_sem_localizacao(): void
    {
        $uuid = (string) Str::uuid();
        $payload = $this->payloadValido($uuid);
        unset($payload['cadastros'][0]['latitude'], $payload['cadastros'][0]['longitude']);

        $this->actingAs($this->operador(), 'sanctum')
            ->postJson('/api/v1/sync/cadastros', $payload)->assertStatus(207);

        $cadastro = Cadastro::where('client_uuid', $uuid)->firstOrFail();
        $this->assertSame('sincronizado', $cadastro->status->value);
        $this->assertNull($cadastro->localizacao);
    }

    public function test_sincroniza_blocos_1a1_e_habitantes_do_wizard(): void
    {
        $uuid = (string) Str::uuid();
        $payload = $this->payloadValido($uuid);
        $payload['cadastros'][0]['habitantes'] = [[
            'client_uuid' => (string) Str::uuid(),
            'nome_completo' => 'Maria Souza',
            'tipo_sanguineo' => 'O+',
        ]];
        $payload['cadastros'][0]['vulnerabilidade_saude'] = [
            'possui_necessidades_especiais' => true,
            'necessidades_especiais' => 'Cadeirante',
            'doenca_cronica' => true,
            'doenca_cronica_qual' => 'Hipertensão',
            'animais_caes' => 2,
        ];
        $payload['cadastros'][0]['infraestrutura'] = [
            'captacao_agua' => 'nascente',
            'saneamento_tipo' => 'fossa',
        ];
        $payload['cadastros'][0]['risco_ambiental'] = [
            'rio_passa_propriedade' => true,
            'rio_nome' => 'Rio Nhundiaquara',
            'mata_ciliar' => 'desmatada',
        ];
        $payload['cadastros'][0]['agricultura'] = [
            'tamanho_propriedade' => '2 ha',
            'tipo_cultivo' => 'organico',
        ];

        $this->actingAs($this->operador(), 'sanctum')
            ->postJson('/api/v1/sync/cadastros', $payload)->assertStatus(207);

        $cadastro = Cadastro::where('client_uuid', $uuid)->firstOrFail();
        $this->assertSame('Maria Souza', $cadastro->habitantes->first()->nome_completo);
        $this->assertTrue($cadastro->vulnerabilidadeSaude->possui_necessidades_especiais);
        $this->assertSame('Cadeirante', $cadastro->vulnerabilidadeSaude->necessidades_especiais);
        $this->assertTrue($cadastro->vulnerabilidadeSaude->doenca_cronica);
        $this->assertSame('nascente', $cadastro->infraestrutura->captacao_agua);
        $this->assertSame('Rio Nhundiaquara', $cadastro->riscoAmbiental->rio_nome);
        $this->assertSame('organico', $cadastro->agricultura->tipo_cultivo);
    }
}
