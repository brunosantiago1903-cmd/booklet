import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatCents } from "@/lib/money";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 text-sm font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none select-none";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent-strong text-accent-ink hover:bg-accent",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-accent-text hover:bg-surface-2",
  danger: "bg-surface text-critical-text border border-line hover:bg-surface-2",
};

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return cx(buttonBase, buttonVariants[variant], extra);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-2xl border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 pb-4 pt-2">
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <Link
            href={back}
            aria-label="Voltar"
            className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

const fieldInput =
  "w-full rounded-xl border border-line bg-surface px-3 min-h-11 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:bg-surface-2 disabled:text-ink-2";

export function inputClass(extra?: string) {
  return cx(fieldInput, extra);
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-critical-text">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: { icon: <InfoIcon size={18} className="text-accent-text" />, label: "Informação" },
    success: { icon: <CheckIcon size={18} className="text-good-text" />, label: "Sucesso" },
    warning: { icon: <AlertIcon size={18} className="text-warning-text" />, label: "Atenção" },
    error: { icon: <AlertIcon size={18} className="text-critical-text" />, label: "Erro" },
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm", className)}
    >
      <span className="mt-0.5 shrink-0" aria-label={styles.label}>
        {styles.icon}
      </span>
      <div className="min-w-0 text-ink">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Valor com sinal: receitas em verde com "+", despesas em tinta com "−". */
export function Amount({
  cents,
  kind,
  className,
}: {
  cents: number;
  kind?: "income" | "expense" | "transfer" | "neutral";
  className?: string;
}) {
  const positive = cents > 0;
  const tone =
    kind === "transfer" || kind === "neutral" ? "text-ink-2" : positive ? "text-good-text" : "text-ink";
  const sign = cents > 0 && kind !== "neutral" ? "+" : cents < 0 ? "−" : "";
  return (
    <span className={cx("tabular whitespace-nowrap font-semibold", tone, className)}>
      {sign}
      {formatCents(Math.abs(cents))}
    </span>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "good" | "warning" | "critical";
  children: ReactNode;
}) {
  const styles = {
    neutral: "bg-surface-2 text-ink-2",
    accent: "bg-accent-track text-accent-text",
    good: "bg-surface-2 text-good-text",
    warning: "bg-surface-2 text-warning-text",
    critical: "bg-surface-2 text-critical-text",
  }[tone];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", styles)}>
      {children}
    </span>
  );
}

/** Medidor (limite do cartão, orçamento): trilho claro do mesmo azul; estado com ícone + rótulo. */
export function Meter({
  ratio,
  label,
  state = "ok",
}: {
  ratio: number;
  label: string;
  state?: "ok" | "warning" | "over";
}) {
  const width = `${Math.min(100, Math.max(0, ratio * 100)).toFixed(1)}%`;
  const fill = state === "over" ? "bg-critical" : state === "warning" ? "bg-warning" : "bg-accent";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      className="h-2 w-full overflow-hidden rounded-full bg-accent-track"
    >
      <div className={cx("h-full rounded-full", fill)} style={{ width }} />
    </div>
  );
}
