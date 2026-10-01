import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sem conexão" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Sem conexão</h1>
      <p className="text-sm text-ink-2">
        O app precisa de internet para mostrar e salvar lançamentos. Assim que a conexão voltar, recarregue a página.
      </p>
    </main>
  );
}
