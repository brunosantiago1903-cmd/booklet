// Normalmente o service worker intercepta o compartilhamento (Android) antes de chegar aqui.
// Se o SW ainda não estiver ativo, leva o usuário para a tela de envio.
export function POST(request: Request) {
  return Response.redirect(new URL("/comprovantes?compartilhado=falhou", request.url), 303);
}
