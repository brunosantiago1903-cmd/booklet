<?php
// Implementação manual de JWT HS256 (sem dependências externas).
require_once __DIR__ . '/config.php';

function b64url_encode(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

function b64url_decode(string $s): string|false
{
    return base64_decode(strtr($s, '-_', '+/'));
}

function jwt_encode(array $payload): string
{
    $payload['iat'] = time();
    $payload['exp'] = time() + JWT_TTL;
    $header = b64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $corpo = b64url_encode(json_encode($payload));
    $assinatura = b64url_encode(hash_hmac('sha256', "$header.$corpo", JWT_SECRET, true));
    return "$header.$corpo.$assinatura";
}

function jwt_decode(string $token): ?array
{
    $partes = explode('.', $token);
    if (count($partes) !== 3) {
        return null;
    }
    [$header, $corpo, $assinatura] = $partes;
    $esperada = b64url_encode(hash_hmac('sha256', "$header.$corpo", JWT_SECRET, true));
    if (!hash_equals($esperada, $assinatura)) {
        return null;
    }
    $payload = json_decode(b64url_decode($corpo) ?: '', true);
    if (!is_array($payload) || ($payload['exp'] ?? 0) < time()) {
        return null;
    }
    return $payload;
}
