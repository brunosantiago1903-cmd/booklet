<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\LoginController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rotas Web (painel administrativo)
|--------------------------------------------------------------------------
*/

Route::get('/', fn () => redirect()->route('mapa'));

// Autenticacao de sessao (uso interno).
Route::middleware('guest')->group(function (): void {
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'login'])->name('login.attempt');
});
Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth')->name('logout');

Route::middleware('auth')->group(function (): void {
    // Mapa interativo de risco - acessivel a todos os perfis autenticados.
    Route::view('/painel/mapa', 'mapa.index')->name('mapa');
});
