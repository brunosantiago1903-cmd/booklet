/** Datas de calendário no formato ISO "YYYY-MM-DD" (sem fuso). */
export type ISODate = string;
/** Mês no formato "YYYY-MM". */
export type MonthKey = string;

export const APP_TIME_ZONE = "America/Sao_Paulo";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_RE = /^(\d{4})-(\d{2})$/;

export function isISODate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isMonthKey(value: string): boolean {
  const match = MONTH_KEY_RE.exec(value);
  return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

export function parseISODate(value: ISODate): { year: number; month: number; day: number } {
  const match = ISO_DATE_RE.exec(value);
  if (!match) throw new Error(`Data inválida: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Data de hoje no fuso de São Paulo (o servidor da Vercel roda em UTC). */
export function todayISO(now: Date = new Date()): ISODate {
  return dateInTimeZone(now, APP_TIME_ZONE);
}

export function dateInTimeZone(instant: Date, timeZone: string): ISODate {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Soma meses mantendo o dia, limitado ao último dia do mês de destino. */
export function addMonths(date: ISODate, months: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const index = year * 12 + (month - 1) + months;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  return toISODate(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth)));
}

export function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Diferença em dias (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const pa = parseISODate(a);
  const pb = parseISODate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000,
  );
}

export function monthKeyOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function monthStart(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function monthKeyToStart(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function addMonthsToKey(month: MonthKey, months: number): MonthKey {
  return monthKeyOf(addMonths(monthKeyToStart(month), months));
}

/** Intervalo [início, fimExclusivo) de um mês, para filtros de data. */
export function monthRange(month: MonthKey): { start: ISODate; end: ISODate } {
  const start = monthKeyToStart(month);
  return { start, end: addMonths(start, 1) };
}

export function formatDateBR(date: ISODate): string {
  const { year, month, day } = parseISODate(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatMonthBR(month: MonthKey, { short = false } = {}): string {
  const [year, m] = month.split("-").map(Number);
  const name = MONTH_NAMES[m - 1];
  return short ? `${name.slice(0, 3)}/${String(year).slice(2)}` : `${name} de ${year}`;
}

export function weekdayDateBR(date: ISODate): string {
  const { year, month, day } = parseISODate(date);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function clampedDate(year: number, month: number, day: number): ISODate {
  return toISODate(year, month, Math.min(day, daysInMonth(year, month)));
}

export type InvoiceInfo = {
  /** Data em que a fatura fecha. */
  closingDate: ISODate;
  /** Data de vencimento. */
  dueDate: ISODate;
  /** Primeiro dia do mês de vencimento: identifica a fatura. */
  invoiceMonth: ISODate;
};

/**
 * Descobre em qual fatura cai uma compra no cartão.
 * Compras feitas NO dia do fechamento já entram na fatura seguinte.
 * O vencimento é o primeiro `dueDay` depois do fechamento.
 */
export function invoiceFor(purchaseDate: ISODate, closingDay: number, dueDay: number): InvoiceInfo {
  const { year, month } = parseISODate(purchaseDate);
  let closingDate = clampedDate(year, month, closingDay);
  if (purchaseDate >= closingDate) {
    const next = parseISODate(addMonths(toISODate(year, month, 1), 1));
    closingDate = clampedDate(next.year, next.month, closingDay);
  }

  const closing = parseISODate(closingDate);
  let dueDate = clampedDate(closing.year, closing.month, dueDay);
  if (dueDate <= closingDate) {
    const next = parseISODate(addMonths(toISODate(closing.year, closing.month, 1), 1));
    dueDate = clampedDate(next.year, next.month, dueDay);
  }

  return { closingDate, dueDate, invoiceMonth: monthStart(dueDate) };
}

/** Fatura que um pagamento feito em `paymentDate` provavelmente quita (a última fechada). */
export function invoicePaidOn(paymentDate: ISODate, closingDay: number, dueDay: number): ISODate {
  const open = invoiceFor(paymentDate, closingDay, dueDay);
  return addMonths(open.invoiceMonth, -1);
}
