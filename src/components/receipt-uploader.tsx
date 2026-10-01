"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { processReceipt, registerReceipt } from "@/app/(app)/comprovantes/actions";
import { prepareReceiptFile } from "@/lib/image";
import { createClient } from "@/lib/supabase/browser";
import { CameraIcon, UploadIcon } from "./icons";
import { buttonClass, Notice } from "./ui";

type Stage = "idle" | "preparing" | "uploading" | "reading" | "error";

const STAGE_TEXT: Record<Stage, string> = {
  idle: "",
  preparing: "Preparando o arquivo…",
  uploading: "Enviando…",
  reading: "Lendo o comprovante com IA…",
  error: "",
};

export function ReceiptUploader({ householdId }: { householdId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = stage === "preparing" || stage === "uploading" || stage === "reading";

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        setStage("preparing");
        const prepared = await prepareReceiptFile(file);

        setStage("uploading");
        const path = `${householdId}/${crypto.randomUUID()}.${prepared.extension}`;
        const supabase = createClient();
        const upload = await supabase.storage
          .from("receipts")
          .upload(path, prepared.blob, { contentType: prepared.mimeType, upsert: false });
        if (upload.error) throw new Error(`Falha no envio: ${upload.error.message}`);

        const registered = await registerReceipt({ path, mimeType: prepared.mimeType, fileName: file.name || null });
        if ("error" in registered) throw new Error(registered.error);

        setStage("reading");
        // Mesmo se a leitura falhar, a tela de revisão permite preencher à mão.
        await processReceipt(registered.id);
        router.push(`/comprovantes/${registered.id}`);
      } catch (err) {
        setStage("error");
        setError(err instanceof Error ? err.message : "Não foi possível enviar o comprovante.");
      }
    },
    [householdId, router],
  );

  // Arquivo compartilhado pelo menu "Compartilhar" (Android), guardado pelo service worker.
  useEffect(() => {
    if (searchParams.get("compartilhado") !== "1" || !("caches" in window)) return;
    let cancelled = false;
    (async () => {
      const cache = await caches.open("share-target");
      const response = await cache.match("/shared-receipt");
      if (!response || cancelled) return;
      await cache.delete("/shared-receipt");
      const blob = await response.blob();
      const name = decodeURIComponent(response.headers.get("x-file-name") ?? "comprovante");
      await handleFile(new File([blob], name, { type: blob.type }));
    })().catch(() => setError("Não foi possível abrir o arquivo compartilhado."));
    return () => {
      cancelled = true;
    };
  }, [searchParams, handleFile]);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className={buttonClass("primary", "min-h-24 flex-col text-base")}
        >
          <CameraIcon size={26} /> Tirar foto
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={buttonClass("secondary", "min-h-24 flex-col text-base")}
        >
          <UploadIcon size={26} /> Arquivo ou print
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onChange} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onChange} />

      {busy && (
        <div role="status" className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-3 text-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />
          {STAGE_TEXT[stage]}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
