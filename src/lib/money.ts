const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata centavos como moeda brasileira (ex.: 123456 → "R$ 1.234,56"). */
export function formatCents(cents: number): string {
  return brlFormatter.format(cents / 100);
}

/** Converte um valor decimal (ex.: vindo de API) para centavos inteiros. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Lê um valor digitado em formato brasileiro ou internacional e devolve centavos.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 12,30", "-12,30", "12".
 * Retorna null se o texto não for um valor válido.
 */
export function parseMoneyToCents(input: string): number | null {
  let text = input.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (text === "") return null;

  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  if (!/^[\d.,]+$/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let integerPart: string;
  let decimalPart = "";

  if (lastComma >= 0 && lastDot >= 0) {
    // O separador que aparece por último é o decimal; o outro só pode agrupar milhares.
    const decimalIndex = Math.max(lastComma, lastDot);
    const thousandsSep = decimalIndex === lastComma ? "." : ",";
    const integerRaw = text.slice(0, decimalIndex);
    if (!hasValidThousandsGroups(integerRaw, thousandsSep)) return null;
    integerPart = integerRaw.split(thousandsSep).join("");
    decimalPart = text.slice(decimalIndex + 1);
  } else if (lastComma >= 0) {
    if (text.indexOf(",") !== lastComma) {
      // Várias vírgulas: separador de milhar em formato internacional ("1,234,567").
      if (!hasValidThousandsGroups(text, ",")) return null;
      integerPart = text.replace(/,/g, "");
    } else {
      integerPart = text.slice(0, lastComma);
      decimalPart = text.slice(lastComma + 1);
    }
  } else if (lastDot >= 0) {
    const afterDot = text.slice(lastDot + 1);
    const multipleDots = text.indexOf(".") !== lastDot;
    if (multipleDots || (afterDot.length === 3 && lastDot > 0)) {
      // "1.234" ou "1.234.567": ponto como milhar (padrão brasileiro).
      if (!hasValidThousandsGroups(text, ".")) return null;
      integerPart = text.replace(/\./g, "");
    } else {
      integerPart = text.slice(0, lastDot);
      decimalPart = afterDot;
    }
  } else {
    integerPart = text;
  }

  if (integerPart === "") integerPart = "0";
  if (!/^\d+$/.test(integerPart) || !/^\d*$/.test(decimalPart)) return null;
  if (decimalPart.length > 2) return null;

  const cents =
    Number(integerPart) * 100 + Number(decimalPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

function hasValidThousandsGroups(value: string, separator: string): boolean {
  const groups = value.split(separator);
  return (
    /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((group) => /^\d{3}$/.test(group))
  );
}

/** Valor em centavos formatado para preencher um input editável ("1234,56"). */
export function centsToInput(cents: number): string {
  const abs = Math.abs(cents);
  const value = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return cents < 0 ? `-${value}` : value;
}
