import "server-only";
import webpush from "web-push";
import { sql } from "@/lib/db";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch {
    // Chaves ausentes/ inválidas (ex.: durante o build) — push fica desativado.
  }
}

export type NotifyPayload = {
  titulo: string;
  corpo: string;
  link?: string;
};

/**
 * Notifica um membro da equipe pelos canais disponíveis (Web Push + WhatsApp)
 * e registra no log. Falha em um canal não derruba o outro.
 */
export async function notificarUsuario(usuarioId: string, payload: NotifyPayload) {
  // 1) Web Push
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
      select id, endpoint, p256dh, auth from push_subscriptions where usuario_id = ${usuarioId}
    `;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: payload.titulo, body: payload.corpo, link: payload.link })
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await sql`delete from push_subscriptions where id = ${s.id}`;
          }
        }
      })
    );
    await sql`insert into notificacoes (usuario_id, titulo, corpo, canal, link)
      values (${usuarioId}, ${payload.titulo}, ${payload.corpo}, 'push', ${payload.link ?? null})`;
  }

  // 2) WhatsApp
  if (process.env.WHATSAPP_TOKEN) {
    const [u] = await sql<{ telefone: string | null }[]>`
      select telefone from usuarios where id = ${usuarioId} limit 1
    `;
    if (u?.telefone) {
      await enviarWhatsApp(
        u.telefone,
        `*${payload.titulo}*\n${payload.corpo}` + (payload.link ? `\n${payload.link}` : "")
      );
      await sql`insert into notificacoes (usuario_id, titulo, corpo, canal, link)
        values (${usuarioId}, ${payload.titulo}, ${payload.corpo}, 'whatsapp', ${payload.link ?? null})`;
    }
  }
}

/** Envia texto via WhatsApp Cloud API (Meta). */
async function enviarWhatsApp(telefoneE164: string, texto: string) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) return;
  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefoneE164,
        type: "text",
        text: { body: texto },
      }),
    });
  } catch {
    // não interrompe o fluxo
  }
}
