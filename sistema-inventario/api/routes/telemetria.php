<?php
// Endpoint chamado pelo agente PowerShell a cada 5 minutos.
// No primeiro contato a estação entra automaticamente como PENDENTE.

function rota_telemetria(): void
{
    if (AGENT_KEY !== '' && !hash_equals(AGENT_KEY, $_SERVER['HTTP_X_AGENT_KEY'] ?? '')) {
        json_error('Chave de agente inválida.', 401);
    }
    $dados = read_json_body();
    $mac = normalize_mac((string)($dados['mac_address'] ?? ''));
    if ($mac === null) {
        json_error('mac_address inválido.', 400);
    }
    $hostname = trim((string)($dados['hostname'] ?? ''));
    foreach (['uso_cpu', 'uso_ram', 'uso_hd'] as $campo) {
        if (!isset($dados[$campo]) || !porcentagem_valida($dados[$campo])) {
            json_error("Campo '$campo' deve ser numérico entre 0 e 100.", 400);
        }
    }

    $pdo = getPDO();
    $pdo->prepare(
        'INSERT INTO estacoes_trabalho (mac_address, hostname) VALUES (?, ?)
         ON CONFLICT(mac_address) DO UPDATE SET hostname = excluded.hostname'
    )->execute([$mac, $hostname !== '' ? $hostname : null]);

    $pdo->prepare(
        'INSERT INTO telemetria_logs (mac_address, uso_cpu, uso_ram, uso_hd) VALUES (?, ?, ?, ?)'
    )->execute([
        $mac,
        round((float)$dados['uso_cpu'], 1),
        round((float)$dados['uso_ram'], 1),
        round((float)$dados['uso_hd'], 1),
    ]);

    limpeza_automatica($pdo);

    $stmt = $pdo->prepare('SELECT status_vinculo FROM estacoes_trabalho WHERE mac_address = ?');
    $stmt->execute([$mac]);
    json_response(['ok' => true, 'mac_address' => $mac, 'status_vinculo' => $stmt->fetchColumn()], 201);
}
