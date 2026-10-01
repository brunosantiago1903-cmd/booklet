function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada. Veja .env.example.`);
  }
  return value;
}

// Acessos diretos a process.env.NEXT_PUBLIC_* para o Next embutir os valores no bundle do navegador.
export function supabasePublicEnv(): { url: string; key: string } {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    key: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}

export function supabaseSecretKey(): string {
  return required(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function allowedEmails(): Set<string> {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function encryptionKey(): string {
  return required("APP_ENCRYPTION_KEY", process.env.APP_ENCRYPTION_KEY);
}

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function cronSecret(): string | null {
  return process.env.CRON_SECRET || null;
}
