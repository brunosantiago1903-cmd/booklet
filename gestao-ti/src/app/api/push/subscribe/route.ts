import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });

  const sub = await req.json();
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ erro: "inscrição inválida" }, { status: 400 });
  }

  await sql`
    insert into push_subscriptions (usuario_id, endpoint, p256dh, auth)
    values (${userId}, ${endpoint}, ${p256dh}, ${auth})
    on conflict (endpoint) do update set usuario_id = excluded.usuario_id
  `;
  return NextResponse.json({ ok: true });
}
