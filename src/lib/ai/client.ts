import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-opus-5-5";

/**
 * Se o modelo recusar o pedido (classificadores de segurança), a API refaz a chamada
 * no modelo de reserva recomendado, dentro da mesma requisição.
 */
export const FALLBACK_OPTIONS = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada: a leitura automática está desligada.");
  }
  client ??= new Anthropic();
  return client;
}

export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "Chave da API da Anthropic inválida.";
  if (error instanceof Anthropic.PermissionDeniedError) return "A chave da Anthropic não tem permissão para este modelo.";
  if (error instanceof Anthropic.RateLimitError) return "Limite de uso da API atingido. Tente de novo em alguns minutos.";
  if (error instanceof Anthropic.BadRequestError) return `A API recusou o arquivo: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return "Sem conexão com a API da Anthropic.";
  if (error instanceof Anthropic.APIError) return `Erro da API da Anthropic (${error.status}).`;
  return error instanceof Error ? error.message : "Erro desconhecido na leitura.";
}
