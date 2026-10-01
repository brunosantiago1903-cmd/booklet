import { createHash } from "node:crypto";
import { isISODate, toISODate, type ISODate } from "./dates";

export type OfxTransaction = {
  externalId: string;
  date: ISODate;
  amountCents: number;
  description: string;
};

export type OfxStatement = {
  accountType: "checking" | "credit_card" | null;
  currency: string | null;
  transactions: OfxTransaction[];
};

/**
 * Decodifica os bytes de um OFX respeitando o charset declarado no cabeçalho.
 * Bancos brasileiros costumam exportar em Windows-1252 (CHARSET:1252).
 */
export function decodeOfx(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).toUpperCase();
  const declaresUtf8 = /ENCODING:\s*UTF-?8|ENCODING="UTF-?8"|CHARSET:\s*UTF-?8/.test(head);
  const declares1252 = /CHARSET:\s*(1252|WINDOWS-1252|ISO-8859-1|8859-1|LATIN1)/.test(head);

  if (declaresUtf8 && !declares1252) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (declares1252) {
    return new TextDecoder("windows-1252").decode(bytes);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function tagValue(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  if (!match) return null;
  const value = match[1].trim();
  return value === "" ? null : decodeEntities(value);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Lê TRNAMT aceitando ponto ou vírgula como separador decimal. */
export function parseOfxAmount(raw: string): number | null {
  let text = raw.trim().replace(/\s/g, "");
  if (!/^[+-]?[\d.,]+$/.test(text)) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandsSep = decimalSep === "," ? "." : ",";
    text = text.split(thousandsSep).join("").replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    text = text.replace(",", ".");
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function parseOfxDate(raw: string): ISODate | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!match) return null;
  const date = toISODate(Number(match[1]), Number(match[2]), Number(match[3]));
  return isISODate(date) ? date : null;
}

function syntheticId(date: ISODate, amountCents: number, description: string): string {
  return createHash("sha256").update(`${date}|${amountCents}|${description}`).digest("hex").slice(0, 24);
}

/** Extrai os lançamentos de um arquivo OFX (SGML 1.x ou XML 2.x). */
export function parseOfx(text: string): OfxStatement {
  const upper = text.toUpperCase();
  const accountType = upper.includes("<CREDITCARDMSGSRSV1>") || upper.includes("<CCSTMTRS>")
    ? "credit_card"
    : upper.includes("<BANKMSGSRSV1>") || upper.includes("<STMTRS>")
      ? "checking"
      : null;
  const currency = tagValue(text, "CURDEF");

  const transactions: OfxTransaction[] = [];
  const seenSynthetic = new Map<string, number>();
  const seenFitIds = new Set<string>();
  const blockRe = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi;

  for (const match of text.matchAll(blockRe)) {
    const block = match[1];
    const date = parseOfxDate(tagValue(block, "DTPOSTED") ?? "");
    const amountRaw = tagValue(block, "TRNAMT");
    const amountCents = amountRaw ? parseOfxAmount(amountRaw) : null;
    if (!date || amountCents === null || amountCents === 0) continue;

    const name = tagValue(block, "NAME");
    const memo = tagValue(block, "MEMO");
    let description = memo ?? name ?? "Lançamento importado";
    if (name && memo && !memo.toLowerCase().includes(name.toLowerCase())) {
      description = `${name} ${memo}`;
    }
    description = description.replace(/\s+/g, " ").trim();

    let fitId = tagValue(block, "FITID");
    if (fitId && seenFitIds.has(fitId)) {
      // Alguns bancos repetem FITID no mesmo arquivo: diferencia pelo conteúdo.
      fitId = `${fitId}-${syntheticId(date, amountCents, description).slice(0, 8)}`;
    }
    if (fitId) seenFitIds.add(fitId);
    if (!fitId) {
      // Sem FITID: id estável derivado do conteúdo; repetições idênticas no mesmo arquivo ganham sufixo.
      const base = syntheticId(date, amountCents, description);
      const count = (seenSynthetic.get(base) ?? 0) + 1;
      seenSynthetic.set(base, count);
      fitId = count === 1 ? `sha-${base}` : `sha-${base}-${count}`;
    }

    transactions.push({ externalId: `ofx:${fitId}`, date, amountCents, description });
  }

  return { accountType, currency, transactions };
}
