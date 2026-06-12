<?php

function rota_login(): void
{
    $dados = read_json_body();
    $email = trim((string)($dados['email'] ?? ''));
    $senha = (string)($dados['senha'] ?? '');
    if ($email === '' || $senha === '') {
        json_error('Informe email e senha.', 400);
    }
    $stmt = getPDO()->prepare('SELECT * FROM usuarios_sistema WHERE email = ?');
    $stmt->execute([$email]);
    $usuario = $stmt->fetch();
    if (!$usuario || !password_verify($senha, $usuario['senha'])) {
        json_error('Credenciais inválidas.', 401);
    }
    $token = jwt_encode([
        'sub' => (int)$usuario['id'],
        'email' => $usuario['email'],
        'perfil' => $usuario['perfil'],
    ]);
    json_response([
        'token' => $token,
        'usuario' => [
            'id' => (int)$usuario['id'],
            'nome' => $usuario['nome'],
            'email' => $usuario['email'],
            'perfil' => $usuario['perfil'],
        ],
    ]);
}
