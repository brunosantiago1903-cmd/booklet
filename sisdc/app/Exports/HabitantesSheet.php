<?php

declare(strict_types=1);

namespace App\Exports;

use App\Models\Cadastro;
use App\Models\Habitante;
use Illuminate\Database\Eloquent\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;

class HabitantesSheet implements FromCollection, WithHeadings, WithMapping, WithTitle
{
    /** @param  array<string,mixed>  $filtros */
    public function __construct(private readonly array $filtros = []) {}

    public function title(): string
    {
        return 'Habitantes';
    }

    public function collection(): Collection
    {
        $ids = Cadastro::query()->filtrar($this->filtros)->pluck('id');

        return Habitante::query()
            ->whereIn('cadastro_id', $ids)
            ->with('cadastro:id,nome_familia,bairro')
            ->get();
    }

    /** @return array<int,string> */
    public function headings(): array
    {
        return [
            'Família', 'Bairro', 'Nome completo', 'CPF', 'Nascimento', 'Sexo',
            'Celular', 'Escolaridade', 'Tipo sanguíneo', 'Responsável',
        ];
    }

    /** @param  Habitante  $h */
    public function map($h): array
    {
        return [
            $h->cadastro?->nome_familia,
            $h->cadastro?->bairro,
            $h->nome_completo,
            $h->cpf,
            $h->data_nascimento?->format('d/m/Y'),
            $h->sexo,
            $h->celular,
            trim(($h->escolaridade_nivel ?? '').' '.($h->escolaridade_situacao ?? '')),
            $h->tipo_sanguineo,
            $h->responsavel_familiar ? 'Sim' : 'Não',
        ];
    }
}
