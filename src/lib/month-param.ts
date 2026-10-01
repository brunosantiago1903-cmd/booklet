import { isMonthKey, monthKeyOf, todayISO, type MonthKey } from "./dates";

/** Lê ?mes=YYYY-MM; sem parâmetro válido, usa o mês atual em São Paulo. */
export function monthFromParam(value: string | string[] | undefined): MonthKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && isMonthKey(raw) ? raw : monthKeyOf(todayISO());
}

export function stringParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw.trim() : undefined;
}
