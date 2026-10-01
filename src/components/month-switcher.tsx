import Link from "next/link";
import { addMonthsToKey, formatMonthBR, type MonthKey } from "@/lib/dates";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

/** Navegação de mês por links (?mes=YYYY-MM), preservando os demais filtros. */
export function MonthSwitcher({
  month,
  basePath,
  params = {},
}: {
  month: MonthKey;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const href = (target: MonthKey) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    search.set("mes", target);
    return `${basePath}?${search.toString()}`;
  };
  const linkClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2";
  return (
    <div className="flex items-center gap-1">
      <Link href={href(addMonthsToKey(month, -1))} className={linkClass} aria-label="Mês anterior">
        <ChevronLeftIcon />
      </Link>
      <span className="min-w-28 text-center text-sm font-semibold capitalize">{formatMonthBR(month)}</span>
      <Link href={href(addMonthsToKey(month, 1))} className={linkClass} aria-label="Próximo mês">
        <ChevronRightIcon />
      </Link>
    </div>
  );
}
