<?php
// Front controller da API REST.
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/routes/login.php';
require_once __DIR__ . '/routes/telemetria.php';
require_once __DIR__ . '/routes/estacoes.php';
require_once __DIR__ . '/routes/inventario.php';
require_once __DIR__ . '/routes/usuarios.php';
require_once __DIR__ . '/routes/export.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Agent-Key');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$metodo = $_SERVER['REQUEST_METHOD'];
$caminho = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$caminho = preg_replace('#^/api#', '', $caminho);
$caminho = '/' . trim($caminho ?? '', '/');

try {
    if ($metodo === 'POST' && $caminho === '/login') {
        rota_login();
    }
    if ($metodo === 'POST' && $caminho === '/telemetria') {
        rota_telemetria();
    }
    if ($metodo === 'GET' && $caminho === '/estacoes') {
        rota_estacoes_listar();
    }
    if ($metodo === 'GET' && $caminho === '/estacoes/pendentes') {
        rota_estacoes_pendentes();
    }
    if ($metodo === 'GET' && preg_match('#^/estacoes/([^/]+)/historico$#', $caminho, $m)) {
        rota_estacoes_historico($m[1]);
    }
    if ($metodo === 'PATCH' && preg_match('#^/estacoes/([^/]+)/status$#', $caminho, $m)) {
        rota_estacoes_status($m[1]);
    }
    if ($metodo === 'POST' && $caminho === '/inventario') {
        rota_inventario();
    }
    if ($metodo === 'GET' && $caminho === '/usuarios') {
        rota_usuarios_listar();
    }
    if ($metodo === 'POST' && $caminho === '/usuarios') {
        rota_usuarios_criar();
    }
    if ($metodo === 'PATCH' && preg_match('#^/usuarios/(\d+)$#', $caminho, $m)) {
        rota_usuarios_atualizar((int)$m[1]);
    }
    if ($metodo === 'DELETE' && preg_match('#^/usuarios/(\d+)$#', $caminho, $m)) {
        rota_usuarios_deletar((int)$m[1]);
    }
    if ($metodo === 'GET' && $caminho === '/export/csv') {
        rota_export_csv();
    }
    if ($metodo === 'GET' && preg_match('#^/uploads/([^/]+)$#', $caminho, $m)) {
        servir_upload($m[1]);
    }
    json_error('Rota não encontrada.', 404);
} catch (Throwable $e) {
    json_error('Erro interno do servidor: ' . $e->getMessage(), 500);
}
