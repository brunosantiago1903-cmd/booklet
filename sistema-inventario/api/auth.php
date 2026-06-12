<?php
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/helpers.php';

// Valida o token Bearer e (opcionalmente) restringe por perfil.
// Retorna o payload do JWT: ['sub' => id, 'email' => ..., 'perfil' => 'admin'|'operador']
function require_auth(array $perfis = []): array
{
    $token = get_bearer_token();
    if ($token === null) {
        json_error('Token de autenticação ausente.', 401);
    }
    $payload = jwt_decode($token);
    if ($payload === null) {
        json_error('Token inválido ou expirado.', 401);
    }
    if ($perfis && !in_array($payload['perfil'] ?? '', $perfis, true)) {
        json_error('Acesso negado para este perfil.', 403);
    }
    return $payload;
}
