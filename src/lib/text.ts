/** Minúsculas, sem acentos, sem pontuação e com espaços simples. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Palavras que aparecem em extratos mas não identificam o estabelecimento.
const NOISE_WORDS = new Set([
  "pix", "compra", "compras", "pag", "pagto", "pgto", "pagamento", "pagamentos", "debito",
  "credito", "deb", "cred", "dbt", "cartao", "card", "transferencia", "transf", "enviada", "enviado", "recebida",
  "recebido", "ted", "doc", "parc", "parcela", "parcelado", "elo", "visa", "master",
  "mastercard", "nacional", "internacional", "estab", "estabelecimento", "no", "na", "em",
  "de", "do", "da", "dos", "das", "para", "a", "o", "e", "via", "app", "online", "aut",
  "autorizado", "autorizada", "realizada", "realizado", "qr", "code", "boleto", "conta",
  "mov", "lancamento", "ltda", "me", "sa", "eireli", "br", "brasil",
]);

/**
 * Sugere um trecho para regra de categorização a partir da descrição do extrato.
 * Ex.: "PIX ENVIADO - IFOOD *RESTAURANTE 12/09" → "ifood restaurante".
 */
export function suggestRulePattern(description: string): string {
  const words = normalizeText(description)
    .split(" ")
    .filter((word) => word.length > 1 && !/\d/.test(word) && !NOISE_WORDS.has(word));
  return words.slice(0, 2).join(" ");
}
