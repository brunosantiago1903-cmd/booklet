<?php
// Limpeza manual do histórico de telemetria + compactação do banco.
// Uso: php limpar_telemetria.php [dias]   (padrão: TELEMETRIA_RETENCAO_DIAS)
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/limpeza.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script só pode ser executado via linha de comando.\n");
}

$dias = isset($argv[1]) ? max(1, (int)$argv[1]) : TELEMETRIA_RETENCAO_DIAS;
$pdo = getPDO();
$removidos = limpar_telemetria_antiga($pdo, $dias);
$pdo->exec('VACUUM'); // devolve o espaço ao sistema de arquivos
echo "Removidos $removidos registos de telemetria com mais de $dias dias. Banco compactado.\n";
