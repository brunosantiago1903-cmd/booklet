<?php

declare(strict_types=1);

namespace App\Exports;

use App\Models\Cadastro;
use Illuminate\Database\Eloquent\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;

class FamiliasSheet implements FromCollection, WithHeadings, WithMapping, WithTitle
{
    /** @param  array<string,mixed>  $filtros */
    public function __construct(private readonly array $filtros = []) {}

    public function title(): string
    {
        return 'Famílias';
    }

    public function collection(): Collection
    {
        return Cadastro::query()->filtrar($this->filtros)
            ->withCount('habitantes')
            ->with('operador:id,name')
            ->orderBy('bairro')->orderBy('nome_familia')->get();
    }

    /** @return array<int,string> */
    public function headings(): array
    {
        return [
            'Código SISDC', 'Família', 'Bairro', 'Endereço', 'Criticidade', 'Status',
            'Nº pessoas', 'Precisa abrigo', 'Áreas de atenção', 'Latitude', 'Longitude',
            'Tel. celular', 'Operador', 'Coletado em', 'Validado em',
        ];
    }

    /** @param  Cadastro  $c */
    public function map($c): array
    {
        return [
            $c->codigo_sisdc,
            $c->nome_familia,
            $c->bairro,
            trim(($c->endereco ?? '').' '.($c->numero ?? '')),
            $c->criticidade_atual->label(),
            $c->status->label(),
            $c->habitantes_count,
            $c->precisa_abrigo ? 'Sim' : 'Não',
            collect($c->areas_atencao ?? [])->implode(', '),
            $c->latitude,
            $c->longitude,
            $c->telefone_celular,
            $c->operador?->name,
            $c->coletado_em?->format('d/m/Y H:i'),
            $c->validado_em?->format('d/m/Y H:i'),
        ];
    }
}
