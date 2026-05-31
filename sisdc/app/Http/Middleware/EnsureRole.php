<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware de RBAC. Uso na rota: ->middleware('role:administrador,auditor').
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        abort_if($user === null, 401, 'Nao autenticado.');
        abort_unless($user->ativo, 403, 'Usuario inativo.');

        $permitidos = array_map(
            static fn (string $r): Role => Role::from($r),
            $roles,
        );

        abort_unless($user->hasRole(...$permitidos), 403, 'Acesso negado para o seu perfil.');

        return $next($request);
    }
}
