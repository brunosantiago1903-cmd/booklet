import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={56} height={56} className="rounded-2xl" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finanças do casal</h1>
          <p className="mt-1 text-sm text-ink-2">Entre com o e-mail e a senha cadastrados.</p>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5">
        <LoginForm next={typeof next === "string" ? next : "/"} />
      </div>
      <p className="text-center text-xs text-muted">
        Acesso restrito ao casal. Novos usuários são cadastrados pelo administrador.
      </p>
    </main>
  );
}
