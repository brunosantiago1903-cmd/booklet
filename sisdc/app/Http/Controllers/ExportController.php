<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exports\CadastrosExport;
use App\Models\Cadastro;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Exportações: PDF individual do cadastro, PDF de lista (agrupável) e Excel
 * (famílias + habitantes + resumos por bairro/criticidade). Acesso restrito a
 * administrador/auditor (rota com middleware role).
 */
class ExportController extends Controller
{
    /** Relatório individual do cadastro (formato do formulário, com fotos). */
    public function cadastroPdf(Cadastro $cadastro): Response
    {
        $cadastro->load([
            'habitantes', 'vulnerabilidadeSaude', 'infraestrutura', 'riscoAmbiental',
            'agricultura', 'programasSociais', 'historicoRiscos', 'anexos', 'operador', 'validadoPor',
        ]);

        // Fotos embutidas como data-URI (dompdf não busca recursos remotos).
        $fotos = $cadastro->anexos->map(function ($a) {
            $disk = Storage::disk($a->disk ?: 'local');
            if (! $disk->exists($a->path)) {
                return null;
            }

            return [
                'categoria' => $a->categoria,
                'data' => 'data:'.($a->mime ?: 'image/jpeg').';base64,'.base64_encode($disk->get($a->path)),
            ];
        })->filter()->values();

        $pdf = Pdf::loadView('exports.cadastro-pdf', compact('cadastro', 'fotos'))->setPaper('a4');

        return $pdf->download('cadastro-'.$cadastro->id.'.pdf');
    }

    /** PDF da lista filtrada, opcionalmente agrupada por bairro ou criticidade. */
    public function listaPdf(Request $request): Response
    {
        $cadastros = Cadastro::query()->filtrar($this->filtros($request))
            ->orderBy('bairro')->orderByDesc('criticidade_atual')->get();

        $agrupar = in_array($request->query('agrupar'), ['bairro', 'criticidade'], true)
            ? $request->query('agrupar')
            : null;

        $grupos = $agrupar
            ? $cadastros->groupBy(fn ($c) => $agrupar === 'bairro' ? ($c->bairro ?: 'Sem bairro') : $c->criticidade_atual->label())
            : collect(['Todos' => $cadastros]);

        $pdf = Pdf::loadView('exports.lista-pdf', [
            'grupos' => $grupos,
            'total' => $cadastros->count(),
            'agrupar' => $agrupar,
        ])->setPaper('a4', 'landscape');

        return $pdf->download('cadastros.pdf');
    }

    /** Excel (.xlsx) com famílias + habitantes + resumos. */
    public function listaExcel(Request $request): BinaryFileResponse
    {
        return Excel::download(new CadastrosExport($this->filtros($request)), 'cadastros.xlsx');
    }

    /** @return array<string,mixed> */
    private function filtros(Request $request): array
    {
        return [
            'status' => $request->query('status'),
            'criticidade' => array_filter((array) $request->query('criticidade', [])),
            'area_atencao' => $request->query('area_atencao'),
            'bairro' => array_filter((array) $request->query('bairro', [])),
            'busca' => $request->query('busca'),
            'operador' => $request->query('operador'),
        ];
    }
}
