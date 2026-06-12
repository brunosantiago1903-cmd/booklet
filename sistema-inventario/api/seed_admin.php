<?php
// Cria (ou atualiza) o administrador inicial do sistema.
// Uso: php seed_admin.php <email> <senha> [nome]
require_once __DIR__ . '/database.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script só pode ser executado via linha de comando.\n");
}

$email = $argv[1] ?? null;
$senha = $argv[2] ?? null;
$nome = $argv[3] ?? 'Administrador';
if (!$email || !$senha) {
    fwrite(STDERR, "Uso: php seed_admin.php <email> <senha> [nome]\n");
    exit(1);
}

getPDO()->prepare(
    "INSERT INTO usuarios_sistema (nome, email, senha, perfil) VALUES (?, ?, ?, 'admin')
     ON CONFLICT(email) DO UPDATE SET nome = excluded.nome, senha = excluded.senha, perfil = 'admin'"
)->execute([$nome, $email, password_hash($senha, PASSWORD_DEFAULT)]);

echo "Administrador '$email' criado/atualizado com sucesso.\n";
