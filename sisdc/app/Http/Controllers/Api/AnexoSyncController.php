<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAnexoRequest;
use App\Models\Anexo;
use App\Models\Cadastro;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

/**
 * Recebe o upload de fotos coletadas offline. Os arquivos vão para o disco
 * privado `local` (LGPD); o acesso é só por rota autenticada (AnexoController).
 */
class AnexoSyncController extends Controller
{
    public function store(StoreAnexoRequest $request): JsonResponse
    {
        $dados = $request->validated();

        $cadastro = Cadastro::where('client_uuid', $dados['cadastro_client_uuid'])->firstOrFail();

        // Idempotência: o mesmo client_uuid não duplica nem regrava o arquivo.
        $existente = Anexo::where('client_uuid', $dados['client_uuid'])->first();
        if ($existente !== null) {
            return response()->json(['id' => $existente->id, 'acao' => 'ignorado'], 200);
        }

        $path = $request->file('file')->store(
            "anexos/{$cadastro->id}",
            'local',
        );

        $anexo = $cadastro->anexos()->create([
            'client_uuid' => $dados['client_uuid'],
            'categoria' => $dados['categoria'],
            'legenda' => $dados['legenda'] ?? null,
            'disk' => 'local',
            'path' => $path,
            'mime' => $request->file('file')->getMimeType(),
            'tamanho_bytes' => $request->file('file')->getSize(),
            'latitude' => $dados['latitude'] ?? null,
            'longitude' => $dados['longitude'] ?? null,
            'capturado_em' => isset($dados['capturado_em']) ? Carbon::parse($dados['capturado_em']) : null,
        ]);

        return response()->json(['id' => $anexo->id, 'acao' => 'criado'], 201);
    }
}
