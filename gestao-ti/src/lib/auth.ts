import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

const COOKIE = "sessao";
const secret = () => new TextEncoder().encode(process.env.APP_SECRET || "troque-este-segredo");

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  papel: "gestor" | "tecnico";
  telefone: string | null;
  ativo: boolean;
};

/** Gera o hash de uma senha (usado ao criar usuários). */
export function hashSenha(senha: string) {
  return bcrypt.hashSync(senha, 10);
}

/** Valida e-mail/senha; em caso de sucesso, grava o cookie de sessão. */
export async function entrar(email: string, senha: string): Promise<boolean> {
  const [u] = await sql<{ id: string; senha_hash: string; ativo: boolean }[]>`
    select id, senha_hash, ativo from usuarios where lower(email) = lower(${email}) limit 1
  `;
  if (!u || !u.ativo) return false;
  if (!bcrypt.compareSync(senha, u.senha_hash)) return false;

  const token = await new SignJWT({ sub: u.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

/** Remove o cookie de sessão. */
export async function sairSessao() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Lê o id do usuário do cookie (sem consultar o banco). */
export async function getUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

/** Retorna o usuário logado (com dados do banco) ou null. */
export async function getUser(): Promise<Usuario | null> {
  const id = await getUserId();
  if (!id) return null;
  const [u] = await sql<Usuario[]>`
    select id, nome, email, cargo, papel, telefone, ativo from usuarios where id = ${id} limit 1
  `;
  return u && u.ativo ? u : null;
}
