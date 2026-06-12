<?php
// Recebe o formulário de vistoria do PWA (multipart/form-data):
// campos do inventário físico + foto da etiqueta de património + coordenadas GPS.

function rota_inventario(): void
{
    $auth = require_auth(['admin', 'operador']);

    $mac = normalize_mac((string)($_POST['mac_address'] ?? ''));
    if ($mac === null) {
        json_error('mac_address inválido.', 400);
    }
    $pdo = getPDO();
    $stmt = $pdo->prepare('SELECT mac_address FROM estacoes_trabalho WHERE mac_address = ?');
    $stmt->execute([$mac]);
    if (!$stmt->fetch()) {
        json_error('Estação não encontrada. O agente já foi instalado nesta máquina?', 404);
    }

    $campos = [];
    foreach (['patrimonio_cpu', 'secretaria_setor', 'servidor_resp', 'estado_monitor', 'estado_teclado_rato'] as $campo) {
        $valor = trim((string)($_POST[$campo] ?? ''));
        if ($valor === '') {
            json_error("Campo obrigatório: $campo.", 400);
        }
        $campos[$campo] = $valor;
    }

    $latitude = $_POST['latitude'] ?? null;
    $longitude = $_POST['longitude'] ?? null;
    if (!is_numeric($latitude) || !is_numeric($longitude)
        || abs((float)$latitude) > 90 || abs((float)$longitude) > 180) {
        json_error('Coordenadas GPS inválidas ou ausentes. Ative a localização do dispositivo.', 400);
    }

    $fotoPath = salvar_foto();

    $pdo->prepare(
        "UPDATE estacoes_trabalho SET
            patrimonio_cpu = ?, secretaria_setor = ?, servidor_resp = ?,
            estado_monitor = ?, estado_teclado_rato = ?,
            foto_path = ?, latitude = ?, longitude = ?,
            status_vinculo = 'CONCLUIDO',
            inventariado_por = ?, inventariado_em = datetime('now')
         WHERE mac_address = ?"
    )->execute([
        $campos['patrimonio_cpu'], $campos['secretaria_setor'], $campos['servidor_resp'],
        $campos['estado_monitor'], $campos['estado_teclado_rato'],
        $fotoPath, (float)$latitude, (float)$longitude,
        (int)$auth['sub'], $mac,
    ]);

    json_response(['ok' => true, 'mac_address' => $mac, 'status_vinculo' => 'CONCLUIDO', 'foto_path' => $fotoPath]);
}

function salvar_foto(): string
{
    if (!isset($_FILES['foto']) || $_FILES['foto']['error'] !== UPLOAD_ERR_OK) {
        json_error('Foto da estação é obrigatória.', 400);
    }
    $foto = $_FILES['foto'];
    if ($foto['size'] > MAX_FOTO_BYTES) {
        json_error('Foto excede o tamanho máximo de 8 MB.', 400);
    }
    // Nunca confiar no nome/extensão enviados pelo cliente: validar o conteúdo real
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($foto['tmp_name']);
    $extensoes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensoes[$mime])) {
        json_error('Formato de imagem não suportado (use JPEG, PNG ou WebP).', 400);
    }
    if (!is_dir(UPLOADS_DIR)) {
        mkdir(UPLOADS_DIR, 0775, true);
    }
    $nome = bin2hex(random_bytes(8)) . '.' . $extensoes[$mime];
    if (!move_uploaded_file($foto['tmp_name'], UPLOADS_DIR . '/' . $nome)) {
        json_error('Falha ao salvar a foto no servidor.', 500);
    }
    return $nome;
}

function servir_upload(string $arquivo): void
{
    $arquivo = basename($arquivo);
    $caminho = UPLOADS_DIR . '/' . $arquivo;
    if (!preg_match('/^[0-9a-f]{16}\.(jpg|png|webp)$/', $arquivo) || !is_file($caminho)) {
        json_error('Arquivo não encontrado.', 404);
    }
    $mimes = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
    header('Content-Type: ' . $mimes[pathinfo($arquivo, PATHINFO_EXTENSION)]);
    header('Content-Length: ' . filesize($caminho));
    readfile($caminho);
    exit;
}
