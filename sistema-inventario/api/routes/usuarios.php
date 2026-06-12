<?php
// Gestão de utilizadores — exclusivo do perfil 'admin'.

function rota_usuarios_listar(): void
{
    require_auth(['admin']);
    $stmt = getPDO()->query(
        'SELECT id, nome, email, perfil, criado_em FROM usuarios_sistema ORDER BY nome'
    );
    json_response($stmt->fetchAll());
}

function rota_usuarios_criar(): void
{
    require_auth(['admin']);
    $dados = read_json_body();
    $nome = trim((string)($dados['nome'] ?? ''));
    $email = trim((string)($dados['email'] ?? ''));
    $senha = (string)($dados['senha'] ?? '');
    $perfil = (string)($dados['perfil'] ?? 'operador');
    if ($nome === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Informe nome e um email válido.', 400);
    }
    if (strlen($senha) < 6) {
        json_error('A senha deve ter pelo menos 6 caracteres.', 400);
    }
    if (!in_array($perfil, ['admin', 'operador'], true)) {
        json_error("perfil deve ser 'admin' ou 'operador'.", 400);
    }
    try {
        $stmt = getPDO()->prepare(
            'INSERT INTO usuarios_sistema (nome, email, senha, perfil) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$nome, $email, password_hash($senha, PASSWORD_DEFAULT), $perfil]);
    } catch (PDOException $e) {
        json_error('Já existe um utilizador com este email.', 409);
    }
    json_response(['ok' => true, 'id' => (int)getPDO()->lastInsertId()], 201);
}

function rota_usuarios_atualizar(int $id): void
{
    require_auth(['admin']);
    $dados = read_json_body();
    $sets = [];
    $valores = [];
    if (isset($dados['nome']) && trim((string)$dados['nome']) !== '') {
        $sets[] = 'nome = ?';
        $valores[] = trim((string)$dados['nome']);
    }
    if (isset($dados['senha'])) {
        if (strlen((string)$dados['senha']) < 6) {
            json_error('A senha deve ter pelo menos 6 caracteres.', 400);
        }
        $sets[] = 'senha = ?';
        $valores[] = password_hash((string)$dados['senha'], PASSWORD_DEFAULT);
    }
    if (isset($dados['perfil'])) {
        if (!in_array($dados['perfil'], ['admin', 'operador'], true)) {
            json_error("perfil deve ser 'admin' ou 'operador'.", 400);
        }
        $sets[] = 'perfil = ?';
        $valores[] = $dados['perfil'];
    }
    if (!$sets) {
        json_error('Nada para atualizar (nome, senha ou perfil).', 400);
    }
    $valores[] = $id;
    $stmt = getPDO()->prepare('UPDATE usuarios_sistema SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($valores);
    if ($stmt->rowCount() === 0) {
        json_error('Utilizador não encontrado.', 404);
    }
    json_response(['ok' => true]);
}

function rota_usuarios_deletar(int $id): void
{
    $auth = require_auth(['admin']);
    if ((int)$auth['sub'] === $id) {
        json_error('Não é possível remover o próprio utilizador.', 400);
    }
    $stmt = getPDO()->prepare('DELETE FROM usuarios_sistema WHERE id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
        json_error('Utilizador não encontrado.', 404);
    }
    json_response(['ok' => true]);
}
