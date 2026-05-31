<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rotas Web (painel administrativo)
|--------------------------------------------------------------------------
*/

Route::get('/', fn () => redirect()->route('mapa'));

Route::middleware(['auth'])->group(function (): void {
    // Mapa interativo de risco - acessivel a todos os perfis autenticados.
    Route::view('/painel/mapa', 'mapa.index')->name('mapa');
});
