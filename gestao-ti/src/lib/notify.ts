import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export type NotifyPayload = {
  titulo: string;
  corpo: string;
  link?: string;
};

/**
 * Notifica um membro da equipe pelos canais disponíveis (Web Push + WhatsApp)
 * e registra no log de notificações. Falhas em um canal não derrubam o outro.
 */
export async function notificarProfile(profileId: string, payload: NotifyPayload) {
  const admin = createAdminClient();

  // 1) Web Push — envia para todas as assinaturas do usuário
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("profile_id", profileId);

    await Promise.all(
      (subs ?? []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: payload.titulo, body: payload.corpo, link: payload.link })
          );
        } catch (err: any) {
          // 404/410 = assinatura expirada → limpa
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
    );
    await admin.from("notificacoes").insert({
      profile_id: profileId,
      titulo: payload.titulo,
      corpo: payload.corpo,
      canal: "push",
      link: payload.link,
    });
  }

  // 2) WhatsApp — se houver token e telefone do usuário
  const { data: profile } = await admin
    .from("profiles")
    .select("telefone")
    .eq("id", profileId)
    .single();

  if (process.env.WHATSAPP_TOKEN && profile?.telefone) {
    await enviarWhatsApp(profile.telefone, `*${payload.titulo}*\n${payload.corpo}` + (payload.link ? `\n${payload.link}` : ""));
    await admin.from("notificacoes").insert({
      profile_id: profileId,
      titulo: payload.titulo,
      corpo: payload.corpo,
      canal: "whatsapp",
      link: payload.link,
    });
  }
}

/** Envia mensagem de texto via WhatsApp Cloud API (Meta). */
async function enviarWhatsApp(telefoneE164: string, texto: string) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneId || !token) return;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefoneE164,
        type: "text",
        text: { body: texto },
      }),
    });
  } catch {
    // Não interrompe o fluxo se o WhatsApp falhar.
  }
}
