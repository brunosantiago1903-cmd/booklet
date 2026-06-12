<?php
// Relatório unificado em CSV para auditoria (separador ';' + BOM p/ Excel pt-BR).

function rota_export_csv(): void
{
    require_auth(['admin']);
    $stmt = getPDO()->prepare(sql_estacoes_com_semaforo() . ' ORDER BY e.hostname, e.mac_address');
    $stmt->execute([':janela' => '-' . OFFLINE_MINUTOS . ' minutes']);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="inventario_' . gmdate('Ymd_His') . '.csv"');
    $saida = fopen('php://output', 'w');
    fwrite($saida, "\xEF\xBB\xBF");
    $colunas = [
        'mac_address', 'hostname', 'status_vinculo', 'semaforo',
        'patrimonio_cpu', 'secretaria_setor', 'servidor_resp',
        'estado_monitor', 'estado_teclado_rato',
        'latitude', 'longitude',
        'uso_cpu', 'uso_ram', 'uso_hd', 'ultima_telemetria', 'primeiro_contato',
    ];
    fputcsv($saida, $colunas, ';', '"', '');
    while ($linha = $stmt->fetch()) {
        fputcsv($saida, array_map(fn($c) => $linha[$c] ?? '', $colunas), ';', '"', '');
    }
    exit;
}
