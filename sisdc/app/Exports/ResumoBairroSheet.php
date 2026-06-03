<?php

declare(strict_types=1);

namespace App\Exports;

use App\Enums\Criticidade;
use App\Models\Cadastro;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

/**
 * Resumo por bairro: total de cadastros, pessoas e distribuição de criticidade.
 */
class ResumoBairroSheet implements FromCollection, WithHeadings, WithTitle
{
    /** @param  array<string,mixed>  $filtros */
    public function __construct(private readonly array $filtros = []) {}

    public function title(): string
    {
        return 'Resumo por bairro';
    }

    public function collection(): Collection
    {
        $cadastros = Cadastro::query()->filtrar($this->filtros)
            ->withCount('habitantes')->get();

        return $cadastros->groupBy(fn ($c) => $c->bairro ?: 'Sem bairro')
            ->map(function (Collection $grupo, string $bairro): array {
                $linha = [
                    'bairro' => $bairro,
                    'cadastros' => $grupo->count(),
                    'pessoas' => $grupo->sum('habitantes_count'),
                ];
                foreach (Criticidade::cases() as $c) {
                    $linha[$c->value] = $grupo->where('criticidade_atual', $c)->count();
                }

                return array_values($linha);
            })->values();
    }

    /** @return array<int,string> */
    public function headings(): array
    {
        return array_merge(
            ['Bairro', 'Cadastros', 'Pessoas'],
            array_map(fn (Criticidade $c) => $c->label(), Criticidade::cases()),
        );
    }
}
