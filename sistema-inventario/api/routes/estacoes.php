<?php
// Listagem de estações com a última telemetria e o cálculo do semáforo:
//   CINZA    -> baixa por obsolescência
//   VERMELHO -> offline (sem telemetria dentro da janela) ou nunca reportou
//   AMARELO  -> disco acima do limiar ou RAM saturada
//   VERDE    -> funcionamento normal

function sql_estacoes_com_semaforo(): string
{
    $disco = LIMIAR_DISCO;
    $ram = LIMIAR_RAM;
    return "
        SELECT e.*,
               t.uso_cpu, t.uso_ram, t.uso_hd, t.created_at AS ultima_telemetria,
               CASE
                 WHEN e.status_vinculo = 'BAIXA' THEN 'CINZA'
                 WHEN t.created_at IS NULL OR t.created_at < datetime('now', :janela) THEN 'VERMELHO'
                 WHEN t.uso_hd > $disco OR t.uso_ram > $ram THEN 'AMARELO'
                 ELSE 'VERDE'
               END AS semaforo
        FROM estacoes_trabalho e
        LEFT JOIN (
            SELECT l.mac_address, l.uso_cpu, l.uso_ram, l.uso_hd, l.created_at
            FROM telemetria_logs l
            JOIN (SELECT mac_address, MAX(id) AS max_id FROM telemetria_logs GROUP BY mac_address) ult
              ON ult.max_id = l.id
        ) t ON t.mac_address = e.mac_address
    ";
}

function rota_estacoes_listar(): void
{
    require_auth(['admin']);
    $stmt = getPDO()->prepare(sql_estacoes_com_semaforo() . ' ORDER BY e.hostname, e.mac_address');
    $stmt->execute([':janela' => '-' . OFFLINE_MINUTOS . ' minutes']);
    json_response($stmt->fetchAll());
}

function rota_estacoes_pendentes(): void
{
    require_auth(['admin', 'operador']);
    $stmt = getPDO()->query(
        "SELECT mac_address, hostname, primeiro_contato
         FROM estacoes_trabalho
         WHERE status_vinculo = 'PENDENTE'
         ORDER BY primeiro_contato DESC"
    );
    json_response($stmt->fetchAll());
}

function rota_estacoes_historico(string $macBruto): void
{
    require_auth(['admin']);
    $mac = normalize_mac($macBruto);
    if ($mac === null) {
        json_error('mac_address inválido.', 400);
    }
    $horas = max(1, min(720, (int)($_GET['horas'] ?? 24)));
    $stmt = getPDO()->prepare(
        "SELECT uso_cpu, uso_ram, uso_hd, created_at
         FROM telemetria_logs
         WHERE mac_address = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC
         LIMIT 1000"
    );
    $stmt->execute([$mac, "-$horas hours"]);
    json_response($stmt->fetchAll());
}

// Alteração manual de status pelo administrador (ex.: baixa por obsolescência)
function rota_estacoes_status(string $macBruto): void
{
    require_auth(['admin']);
    $mac = normalize_mac($macBruto);
    if ($mac === null) {
        json_error('mac_address inválido.', 400);
    }
    $dados = read_json_body();
    $status = strtoupper(trim((string)($dados['status_vinculo'] ?? '')));
    if (!in_array($status, ['PENDENTE', 'CONCLUIDO', 'BAIXA'], true)) {
        json_error("status_vinculo deve ser 'PENDENTE', 'CONCLUIDO' ou 'BAIXA'.", 400);
    }
    $stmt = getPDO()->prepare('UPDATE estacoes_trabalho SET status_vinculo = ? WHERE mac_address = ?');
    $stmt->execute([$status, $mac]);
    if ($stmt->rowCount() === 0) {
        json_error('Estação não encontrada.', 404);
    }
    json_response(['ok' => true, 'mac_address' => $mac, 'status_vinculo' => $status]);
}
