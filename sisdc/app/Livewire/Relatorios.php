<?php

declare(strict_types=1);

namespace App\Livewire;

use App\Enums\AreaAtencao;
use App\Enums\Criticidade;
use App\Enums\StatusCadastro;
use App\Models\Cadastro;
use Illuminate\Contracts\View\View;
use Livewire\Attributes\Url;
use Livewire\Component;

/**
 * Relatórios gerenciais: filtra por situação de risco (criticidade/área) e por
 * bairro, mostra resumos agregados e oferece exportações (PDF/Excel).
 */
class Relatorios extends Component
{
    #[Url]
    public string $status = '';

    /** @var array<int,string> */
    #[Url]
    public array $criticidade = [];

    #[Url]
    public string $area_atencao = '';

    /** @var array<int,string> */
    #[Url]
    public array $bairro = [];

    #[Url]
    public string $busca = '';

    public function mount(): void
    {
        abort_unless(auth()->user()?->role->canValidate(), 403);
    }

    public function limpar(): void
    {
        $this->reset(['status', 'criticidade', 'area_atencao', 'bairro', 'busca']);
    }

    /** @return array<string,mixed> */
    private function filtros(): array
    {
        return [
            'status' => $this->status,
            'criticidade' => $this->criticidade,
            'area_atencao' => $this->area_atencao,
            'bairro' => $this->bairro,
            'busca' => $this->busca,
        ];
    }

    public function render(): View
    {
        $cadastros = Cadastro::query()->filtrar($this->filtros())
            ->withCount('habitantes')->get();

        $resumoBairro = $cadastros->groupBy(fn ($c) => $c->bairro ?: 'Sem bairro')
            ->map(fn ($g) => [
                'cadastros' => $g->count(),
                'pessoas' => $g->sum('habitantes_count'),
                'criticos' => $g->whereIn('criticidade_atual', [Criticidade::ALTO, Criticidade::MUITO_ALTO])->count(),
            ])->sortKeys();

        $resumoCriticidade = collect(Criticidade::cases())
            ->mapWithKeys(fn (Criticidade $c) => [$c->value => $cadastros->where('criticidade_atual', $c)->count()]);

        $resumoArea = collect(AreaAtencao::cases())
            ->mapWithKeys(fn (AreaAtencao $a) => [
                $a->value => $cadastros->filter(fn ($c) => in_array($a->value, $c->areas_atencao ?? [], true))->count(),
            ]);

        return view('livewire.relatorios', [
            'cadastros' => $cadastros,
            'resumoBairro' => $resumoBairro,
            'resumoCriticidade' => $resumoCriticidade,
            'resumoArea' => $resumoArea,
            'bairrosDisponiveis' => Cadastro::query()->whereNotNull('bairro')
                ->distinct()->orderBy('bairro')->pluck('bairro'),
            'criticidades' => Criticidade::cases(),
            'areas' => AreaAtencao::cases(),
            'statuses' => StatusCadastro::cases(),
            'queryExport' => http_build_query(array_filter($this->filtros())),
        ])->layout('components.layouts.app', ['title' => 'Relatórios · SISDC']);
    }
}
