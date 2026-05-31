<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\SyncCadastrosRequest;
use App\Models\Cadastro;
use App\Services\CadastroSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    public function __construct(private readonly CadastroSyncService $service) {}

    /**
     * Recebe o lote (push) de cadastros coletados offline no tablet.
     *
     * POST /api/v1/sync/cadastros
     */
    public function push(SyncCadastrosRequest $request): JsonResponse
    {
        $resultado = $this->service->processarLote(
            $request->validated(),
            $request->user(),
        );

        // 207 Multi-Status: o lote pode conter itens criados, ignorados e com erro.
        return response()->json($resultado, 207);
    }

    /**
     * Pull incremental: devolve cadastros alterados apos `desde` para o tablet
     * reconciliar (ex.: status de validacao definido pelo auditor).
     *
     * GET /api/v1/sync/cadastros?desde=2026-05-30T00:00:00Z
     */
    public function pull(Request $request): JsonResponse
    {
        $desde = $request->date('desde');

        $cadastros = Cadastro::query()
            ->when($desde, fn ($q) => $q->where('updated_at', '>=', $desde))
            ->with(['habitantes', 'historicoRiscos'])
            ->orderBy('updated_at')
            ->limit(500)
            ->get([
                'id', 'client_uuid', 'codigo_sisdc', 'nome_familia',
                'status', 'criticidade_atual', 'motivo_rejeicao', 'updated_at',
            ]);

        return response()->json([
            'servidor_em' => now()->toIso8601String(),
            'cadastros' => $cadastros,
        ]);
    }
}
