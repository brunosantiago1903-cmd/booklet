<?php

declare(strict_types=1);

namespace App\Exports;

use App\Enums\AreaAtencao;
use App\Enums\Criticidade;
use App\Models\Cadastro;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

/**
 * Resumo por situação de risco: total por criticidade e por área de atenção.
 */
class ResumoRiscoSheet implements FromCollection, WithHeadings, WithTitle
{
    /** @param  array<string,mixed>  $filtros */
    public function __construct(private readonly array $filtros = []) {}

    public function title(): string
    {
        return 'Resumo por risco';
    }

    public function collection(): Collection
    {
        $cadastros = Cadastro::query()->filtrar($this->filtros)->get();
        $linhas = collect();

        $linhas->push(['CRITICIDADE', 'Total']);
        foreach (Criticidade::cases() as $c) {
            $linhas->push([$c->label(), $cadastros->where('criticidade_atual', $c)->count()]);
        }

        $linhas->push(['', '']);
        $linhas->push(['ÁREA DE ATENÇÃO', 'Total']);
        foreach (AreaAtencao::cases() as $a) {
            $total = $cadastros->filter(fn ($c) => in_array($a->value, $c->areas_atencao ?? [], true))->count();
            $linhas->push([$a->label(), $total]);
        }

        return $linhas;
    }

    /** @return array<int,string> */
    public function headings(): array
    {
        return ['Situação', 'Total'];
    }
}
