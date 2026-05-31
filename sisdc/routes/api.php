<?php

declare(strict_types=1);

use App\Http\Controllers\Api\MapaController;
use App\Http\Controllers\Api\SyncController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rotas da API (autenticadas via Sanctum)
|--------------------------------------------------------------------------
| Prefixo /api e aplicado automaticamente pelo bootstrap/app.php.
*/

Route::middleware('auth:sanctum')->prefix('v1')->group(function (): void {

    // Sincronizacao offline-first (apenas operador/admin).
    Route::middleware('role:administrador,operador')->group(function (): void {
        Route::post('/sync/cadastros', [SyncController::class, 'push']);
        Route::get('/sync/cadastros', [SyncController::class, 'pull']);
    });

    // Mapa do painel (qualquer perfil autenticado pode visualizar).
    Route::get('/mapa/cadastros.geojson', [MapaController::class, 'geojson']);
});
