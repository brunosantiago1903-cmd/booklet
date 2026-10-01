"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CardIcon, HomeIcon, ListIcon, MoreIcon, PlusIcon } from "./icons";
import { cx } from "./ui";

const ITEMS = [
  { href: "/", label: "Início", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/lancamentos", label: "Lançamentos", icon: ListIcon, match: (p: string) => p.startsWith("/lancamentos") },
  { href: "/comprovantes", label: "Adicionar", icon: PlusIcon, match: (p: string) => p.startsWith("/comprovantes"), primary: true },
  { href: "/contas", label: "Contas", icon: CardIcon, match: (p: string) => p.startsWith("/contas") },
  {
    href: "/mais",
    label: "Mais",
    icon: MoreIcon,
    match: (p: string) => p.startsWith("/mais") || p.startsWith("/categorias"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around px-2">
        {ITEMS.map(({ href, label, icon: Icon, match, primary }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-accent-text" : "text-ink-2",
                )}
              >
                {primary ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-strong text-accent-ink shadow-sm">
                    <Icon size={22} />
                  </span>
                ) : (
                  <Icon size={22} />
                )}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
