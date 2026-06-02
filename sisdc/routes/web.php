<?php

declare(strict_types=1);

use App\Http\Controllers\AnexoController;
use App\Http\Controllers\Api\MapaController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\ColetaController;
use App\Livewire\Auditoria;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rotas Web (painel administrativo)
|--------------------------------------------------------------------------
*/

Route::get('/', fn () => redirect()->route('mapa'));

// Autenticacao de sessao (uso interno). Throttle anti força-bruta no POST.
Route::middleware('guest')->group(function (): void {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'login'])
        ->middleware('throttle:10,1')->name('login.attempt');
});
Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth')->name('logout');

Route::middleware('auth')->group(function (): void {
    // Mapa interativo de risco - acessivel a todos os perfis autenticados.
    Route::view('/painel/mapa', 'mapa.index')->name('mapa');

    // GeoJSON do mapa via sessao web (funciona em qualquer host da rede interna,
    // sem depender de dominio stateful do Sanctum). Tablets usam a rota /api.
    Route::get('/painel/mapa/cadastros.geojson', [MapaController::class, 'geojson'])->name('mapa.geojson');

    // Foto de um anexo (disco privado, somente autenticado).
    Route::get('/anexos/{anexo}', [AnexoController::class, 'show'])->name('anexos.show');

    // Auditoria - valida/rejeita cadastros (administrador, auditor).
    Route::get('/painel/auditoria', Auditoria::class)
        ->middleware('role:administrador,auditor')->name('auditoria');

    // Coleta de campo (Wizard offline-first) - administrador, operador.
    Route::get('/coleta', [ColetaController::class, 'index'])
        ->middleware('role:administrador,operador')->name('coleta');
});
