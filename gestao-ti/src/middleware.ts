import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.APP_SECRET || "troque-este-segredo");

const ROTAS_PUBLICAS = ["/login", "/chamados/novo", "/api/chamados"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publico = ROTAS_PUBLICAS.some((p) => path.startsWith(p));

  let logado = false;
  const token = request.cookies.get("sessao")?.value;
  if (token) {
    try {
      await jwtVerify(token, secret());
      logado = true;
    } catch {
      logado = false;
    }
  }

  // Já logado tentando ver o login → manda pro painel
  if (logado && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!logado && !publico) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)"],
};
