<?php
require_once __DIR__ . '/config.php';

// Remove registos de telemetria mais antigos que o período de retenção.
// Retorna o número de linhas apagadas. Retenção 0 = desativada.
function limpar_telemetria_antiga(PDO $pdo, int $dias): int
{
    if ($dias <= 0) {
        return 0;
    }
    $stmt = $pdo->prepare("DELETE FROM telemetria_logs WHERE created_at < datetime('now', ?)");
    $stmt->execute(["-$dias days"]);
    return $stmt->rowCount();
}

// Chamada no endpoint de telemetria: executa a limpeza no máximo uma vez
// a cada 24h (controlado por um arquivo marcador ao lado do banco).
function limpeza_automatica(PDO $pdo): void
{
    $marcador = dirname(DB_PATH) . '/.ultima_limpeza';
    if (is_file($marcador) && filemtime($marcador) > time() - 86400) {
        return;
    }
    touch($marcador);
    limpar_telemetria_antiga($pdo, TELEMETRIA_RETENCAO_DIAS);
}
