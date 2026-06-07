"use client";

import { useActionState } from "react";
import { login } from "@/app/auth/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-brand" />
          <h1 className="text-xl font-bold">Gestão TI</h1>
          <p className="text-sm text-slate-500">Prefeitura de Morretes</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">E-mail</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="voce@morretes.pr.gov.br"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Senha</label>
          <input
            name="senha"
            type="password"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-center text-xs text-slate-400">
          Precisa abrir um chamado?{" "}
          <a href="/chamados/novo" className="text-brand underline">
            Clique aqui
          </a>
        </p>
      </form>
    </main>
  );
}
