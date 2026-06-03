<?php

declare(strict_types=1);

namespace App\Livewire;

use App\Enums\AreaAtencao;
use App\Enums\Criticidade;
use App\Enums\StatusCadastro;
use App\Models\Cadastro;
use App\Models\ProgramaSocial;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Component;

/**
 * Revisão completa de um cadastro pelo auditor: visualizar, editar todos os
 * dados (inclusive habitantes e avaliação de risco), validar ou rejeitar.
 */
class RevisarCadastro extends Component
{
    public Cadastro $cadastro;

    /** @var array<string,mixed> */
    public array $dados = [];

    /** @var array<int,array<string,mixed>> */
    public array $habitantes = [];

    /** @var array<string,mixed> */
    public array $saude = [];

    /** @var array<string,mixed> */
    public array $infra = [];

    /** @var array<string,mixed> */
    public array $risco = [];

    /** @var array<string,mixed> */
    public array $agricultura = [];

    /** @var array<int,string> */
    public array $programas = [];

    public bool $novaAvaliacao = false;

    public string $avaliacaoTipo = 'deslizamento';

    public string $avaliacaoCriticidade = 'sem_risco';

    public string $motivoRejeicao = '';

    public function mount(Cadastro $cadastro): void
    {
        abort_unless(auth()->user()?->role->canValidate(), 403);

        $cadastro->load([
            'habitantes', 'vulnerabilidadeSaude', 'infraestrutura', 'riscoAmbiental',
            'agricultura', 'programasSociais', 'anexos', 'operador',
        ]);
        $this->cadastro = $cadastro;

        $this->dados = Arr::only($cadastro->toArray(), [
            'codigo_sisdc', 'nome_familia', 'cep', 'endereco', 'numero', 'complemento',
            'bairro', 'telefone_fixo', 'telefone_celular', 'latitude', 'longitude',
            'qtd_pessoas_domicilio', 'renda_domiciliar', 'precisa_abrigo',
            'moradores_encontrados', 'percepcao_risco', 'acao_risco_iminente',
            'medidas_sugeridas', 'cadastrado_alertas',
        ]);
        $this->habitantes = $cadastro->habitantes->map(fn ($h) => $h->only([
            'id', 'nome_completo', 'cpf', 'data_nascimento', 'sexo', 'celular',
            'escolaridade_nivel', 'escolaridade_situacao', 'tipo_sanguineo', 'responsavel_familiar',
        ]))->all();
        $this->saude = $cadastro->vulnerabilidadeSaude?->only([
            'possui_necessidades_especiais', 'necessidades_especiais', 'necessita_medicacao',
            'medicacao_qual', 'restricao_medicamento', 'doenca_cronica', 'doenca_cronica_qual',
            'alergias', 'animais_caes', 'animais_gatos', 'animais_aves', 'animais_outros',
        ]) ?? [];
        $this->infra = $cadastro->infraestrutura?->only([
            'captacao_agua', 'captacao_agua_outro', 'poco_nascente_localizacao',
            'poco_profundidade_m', 'coleta_lixo', 'lixo_organico_destino',
            'lixo_reciclavel_destino', 'coleta_seletiva_proxima', 'saneamento_tipo',
            'saneamento_qual', 'saneamento_localizacao',
        ]) ?? [];
        $this->risco = $cadastro->riscoAmbiental?->only([
            'potencialmente_inundavel', 'historico_deslizamento', 'risco_deslizamento_atual',
            'solo_exposto', 'erosao_expressiva', 'relevo_descricao', 'rio_passa_propriedade',
            'rio_nome', 'rio_largura', 'mata_ciliar', 'erosao_beira_rio', 'rio_assoreado',
        ]) ?? [];
        $this->agricultura = $cadastro->agricultura?->only([
            'tamanho_propriedade', 'culturas', 'tipo_cultivo', 'renda_media',
            'pessoas_trabalham', 'barracao_proprio', 'sistema_irrigacao', 'observacao',
        ]) ?? [];
        $this->programas = $cadastro->programasSociais->pluck('slug')->all();
    }

    public function addHabitante(): void
    {
        $this->habitantes[] = ['nome_completo' => '', 'cpf' => ''];
    }

    public function removerHabitante(int $i): void
    {
        unset($this->habitantes[$i]);
        $this->habitantes = array_values($this->habitantes);
    }

    public function salvar(): void
    {
        $this->persistir();
        session()->flash('ok', 'Alterações salvas.');
    }

    public function validar(): void
    {
        $this->persistir();
        $this->cadastro->update([
            'status' => StatusCadastro::VALIDADO,
            'validado_em' => now(),
            'validado_por_id' => auth()->id(),
            'motivo_rejeicao' => null,
        ]);
        session()->flash('ok', 'Cadastro validado e liberado no mapa.');
        $this->redirectRoute('auditoria', navigate: true);
    }

    public function rejeitar(): void
    {
        $this->validate(['motivoRejeicao' => ['required', 'string', 'min:5', 'max:500']]);
        $this->persistir();
        $this->cadastro->update([
            'status' => StatusCadastro::REJEITADO,
            'motivo_rejeicao' => $this->motivoRejeicao,
            'validado_por_id' => auth()->id(),
        ]);
        session()->flash('ok', 'Cadastro rejeitado.');
        $this->redirectRoute('auditoria', navigate: true);
    }

    private function persistir(): void
    {
        abort_unless(auth()->user()?->role->canValidate(), 403);

        $this->cadastro->update($this->dados);

        // Habitantes: upsert por id; remove os que saíram.
        $idsMantidos = [];
        foreach ($this->habitantes as $h) {
            $modelo = isset($h['id'])
                ? $this->cadastro->habitantes()->find($h['id'])
                : $this->cadastro->habitantes()->make(['client_uuid' => (string) Str::uuid()]);
            if ($modelo === null) {
                continue;
            }
            $modelo->fill(Arr::except($h, ['id']))->save();
            $idsMantidos[] = $modelo->id;
        }
        $this->cadastro->habitantes()->whereNotIn('id', $idsMantidos)->delete();

        $this->cadastro->vulnerabilidadeSaude()->updateOrCreate(['cadastro_id' => $this->cadastro->id], $this->saude);
        $this->cadastro->infraestrutura()->updateOrCreate(['cadastro_id' => $this->cadastro->id], $this->infra);
        $this->cadastro->riscoAmbiental()->updateOrCreate(['cadastro_id' => $this->cadastro->id], $this->risco);
        $this->cadastro->agricultura()->updateOrCreate(['cadastro_id' => $this->cadastro->id], $this->agricultura);

        $ids = ProgramaSocial::whereIn('slug', $this->programas)->pluck('id')->all();
        $this->cadastro->programasSociais()->sync($ids);
        $this->cadastro->forceFill(['atendido_programa_social' => $ids !== []])->save();

        // Nova avaliação de risco (opcional) -> entra no histórico e recalcula criticidade.
        if ($this->novaAvaliacao) {
            $h = $this->cadastro->historicoRiscos()->create([
                'client_uuid' => (string) Str::uuid(),
                'tipo_evento' => $this->avaliacaoTipo,
                'criticidade' => $this->avaliacaoCriticidade,
                'avaliado_em' => now(),
                'latitude' => $this->dados['latitude'] ?? null,
                'longitude' => $this->dados['longitude'] ?? null,
                'registrado_por_id' => auth()->id(),
            ]);
            if (isset($this->dados['latitude'], $this->dados['longitude'])) {
                DB::statement(
                    'UPDATE historico_riscos SET localizacao = ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography WHERE id = ?',
                    [$this->dados['longitude'], $this->dados['latitude'], $h->id],
                );
            }
        }

        // Mantém a coluna geography do cadastro coerente com lat/long editados.
        if (isset($this->dados['latitude'], $this->dados['longitude'])) {
            DB::statement(
                'UPDATE cadastros SET localizacao = ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography WHERE id = ?',
                [$this->dados['longitude'], $this->dados['latitude'], $this->cadastro->id],
            );
        }

        $this->cadastro->recalcularCriticidadeAtual();
        $this->cadastro->refresh()->load(['habitantes', 'anexos', 'programasSociais']);
    }

    public function render(): View
    {
        return view('livewire.revisar-cadastro', [
            'todosProgramas' => ProgramaSocial::where('ativo', true)->orderBy('nome')->pluck('nome', 'slug'),
            'criticidades' => Criticidade::cases(),
            'areas' => AreaAtencao::cases(),
        ])->layout('components.layouts.app', ['title' => 'Revisar cadastro · SISDC']);
    }
}
