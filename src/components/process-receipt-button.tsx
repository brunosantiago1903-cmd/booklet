"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { processReceipt } from "@/app/(app)/comprovantes/actions";
import { SparklesIcon } from "./icons";
import { buttonClass, Notice } from "./ui";

export function ProcessReceiptButton({ id, label = "Ler com IA" }: { id: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await processReceipt(id);
            if (!result.ok) setError(result.error);
            router.refresh();
          })
        }
        className={buttonClass("primary")}
      >
        <SparklesIcon size={18} /> {pending ? "Lendo…" : label}
      </button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
