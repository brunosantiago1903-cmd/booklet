<?php

declare(strict_types=1);

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Exportação .xlsx com 4 abas: Famílias, Habitantes, Resumo por bairro e
 * Resumo por situação de risco. Respeita os filtros recebidos.
 */
class CadastrosExport implements WithMultipleSheets
{
    /** @param  array<string,mixed>  $filtros */
    public function __construct(private readonly array $filtros = []) {}

    /** @return array<int,object> */
    public function sheets(): array
    {
        return [
            new FamiliasSheet($this->filtros),
            new HabitantesSheet($this->filtros),
            new ResumoBairroSheet($this->filtros),
            new ResumoRiscoSheet($this->filtros),
        ];
    }
}
