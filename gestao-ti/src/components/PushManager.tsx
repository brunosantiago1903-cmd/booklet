"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Registra o service worker e oferece ativar as notificações push. */
export default function PushManager() {
  const [estado, setEstado] = useState<"oculto" | "pedir" | "ativo">("oculto");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (Notification.permission === "granted") setEstado("ativo");
    else setEstado("pedir");
  }, []);

  async function ativar() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setEstado("ativo");
    } catch {
      // silencioso
    }
  }

  if (estado !== "pedir") return null;

  return (
    <button
      onClick={ativar}
      className="fixed bottom-4 right-4 z-50 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-brand-dark"
    >
      🔔 Ativar notificações
    </button>
  );
}
