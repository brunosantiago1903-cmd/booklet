<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Login de sessao para o painel administrativo (uso interno).
 */
class LoginController extends Controller
{
    public function show(): View
    {
        return view('auth.login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credenciais = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credenciais, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'Credenciais invalidas.',
            ]);
        }

        if (! $request->user()->ativo) {
            Auth::logout();
            throw ValidationException::withMessages([
                'email' => 'Usuario inativo.',
            ]);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('mapa'));
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
