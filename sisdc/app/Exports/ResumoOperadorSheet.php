<?php

declare(strict_types=1);

namespace App\Exports;

use App\Models\Cadastro;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

/**
 * Resumo por operador (quem coletou): total de cadastros e de pessoas.
 */
class ResumoOperadorSheet implements FromCollection, WithHeadings, WithTitle
{
    /** @param  array<string,mixed>  $filtros */
    public function __construct(private readonly array $filtros = []) {}

    public function title(): string
    {
        return 'Resumo por operador';
    }

    public function collection(): Collection
    {
        $cadastros = Cadastro::query()->filtrar($this->filtros)
            ->with('operador:id,name')->withCount('habitantes')->get();

        return $cadastros->groupBy(fn ($c) => $c->operador?->name ?: 'Sem operador')
            ->map(fn (Collection $g, string $operador): array => [
                $operador,
                $g->count(),
                $g->sum('habitantes_count'),
            ])->values();
    }

    /** @return array<int,string> */
    public function headings(): array
    {
        return ['Operador', 'Cadastros', 'Pessoas'];
    }
}
