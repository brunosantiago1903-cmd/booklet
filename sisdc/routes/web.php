<?php

declare(strict_types=1);

use App\Http\Controllers\AnexoController;
use App\Http\Controllers\Api\MapaController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\ColetaController;
use App\Http\Controllers\ExportController;
use App\Livewire\Auditoria;
use App\Livewire\Relatorios;
use App\Livewire\RevisarCadastro;
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

    // Auditoria e relatórios (administrador, auditor).
    Route::middleware('role:administrador,auditor')->group(function (): void {
        Route::get('/painel/auditoria', Auditoria::class)->name('auditoria');
        Route::get('/painel/auditoria/{cadastro}', RevisarCadastro::class)->name('auditoria.revisar');
        Route::get('/painel/relatorios', Relatorios::class)->name('relatorios');

        // Exportações
        Route::get('/relatorios/cadastro/{cadastro}/pdf', [ExportController::class, 'cadastroPdf'])->name('export.cadastro.pdf');
        Route::get('/relatorios/cadastros/pdf', [ExportController::class, 'listaPdf'])->name('export.lista.pdf');
        Route::get('/relatorios/cadastros/xlsx', [ExportController::class, 'listaExcel'])->name('export.lista.xlsx');
    });

    // Coleta de campo (Wizard offline-first) - administrador, operador.
    Route::get('/coleta', [ColetaController::class, 'index'])
        ->middleware('role:administrador,operador')->name('coleta');
});
