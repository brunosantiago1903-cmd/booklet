<?php

declare(strict_types=1);

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Exportação .xlsx com 5 abas: Famílias, Habitantes, Resumo por bairro, Resumo
 * por situação de risco e Resumo por operador. Respeita os filtros recebidos.
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
            new ResumoOperadorSheet($this->filtros),
        ];
    }
}
