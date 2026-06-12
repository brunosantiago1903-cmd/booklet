<?php
// Roteador para o servidor embutido do PHP:
//   php -S 0.0.0.0:8000 router.php   (executar a partir desta pasta)
$caminho = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (preg_match('#^/api(/|$)#', $caminho)) {
    require __DIR__ . '/api/index.php';
    return true;
}
if ($caminho === '/') {
    header('Location: /dashboard/');
    return true;
}
// Demais caminhos: o servidor embutido serve os arquivos estáticos (pwa/, dashboard/)
return false;
