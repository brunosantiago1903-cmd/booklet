import type { Metadata } from "next";
import { SubmitButton } from "@/components/submit-button";
import { signOut } from "../login/actions";

export const metadata: Metadata = { title: "Acesso não autorizado" };

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Acesso não autorizado</h1>
        <p className="mt-2 text-sm text-ink-2">
          Este e-mail não está na lista de pessoas autorizadas (variável <code>ALLOWED_EMAILS</code>). Peça para
          incluírem o seu e-mail e entre de novo.
        </p>
      </div>
      <form action={signOut}>
        <SubmitButton variant="secondary" pendingText="Saindo…" className="w-full">
          Sair e usar outra conta
        </SubmitButton>
      </form>
    </main>
  );
}
