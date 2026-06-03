<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\ProgramaSocial;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Entrega o Wizard de coleta offline-first ao operador de campo, emitindo um
 * token Sanctum para o PWA usar na sincronizacao (push da fila do IndexedDB).
 */
class ColetaController extends Controller
{
    public function index(Request $request): View
    {
        $user = $request->user();

        // Renova o token do dispositivo (um token "pwa-coleta" por operador).
        $user->tokens()->where('name', 'pwa-coleta')->delete();
        $token = $user->createToken('pwa-coleta', ['sync:cadastros'])->plainTextToken;

        return view('coleta.wizard', [
            'token' => $token,
            'deviceId' => 'web-'.$user->id,
            'programasSociais' => ProgramaSocial::where('ativo', true)
                ->orderBy('nome')->pluck('nome', 'slug'),
        ]);
    }
}
