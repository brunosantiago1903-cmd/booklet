<?php

function json_response($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $mensagem, int $code): void
{
    json_response(['erro' => $mensagem], $code);
}

function read_json_body(): array
{
    $dados = json_decode(file_get_contents('php://input'), true);
    if (!is_array($dados)) {
        json_error('Corpo da requisição deve ser JSON válido.', 400);
    }
    return $dados;
}

function get_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = array_change_key_case(apache_request_headers(), CASE_LOWER);
        $header = $headers['authorization'] ?? '';
    }
    if (preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
        return $m[1];
    }
    return null;
}

// Aceita MAC com :, -, ponto ou sem separador; normaliza para AA:BB:CC:DD:EE:FF
function normalize_mac(string $mac): ?string
{
    $hex = strtoupper(preg_replace('/[^0-9a-fA-F]/', '', $mac));
    if (strlen($hex) !== 12) {
        return null;
    }
    return implode(':', str_split($hex, 2));
}

function porcentagem_valida($v): bool
{
    return is_numeric($v) && $v >= 0 && $v <= 100;
}
