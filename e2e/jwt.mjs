import { createHmac } from "node:crypto";
export const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function sign(payload) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
export function verify(token) {
  const [head, body, sig] = token.split(".");
  if (!sig) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  if (expected !== sig) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload;
}
if (process.argv[2] === "keys") {
  const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
  console.log(`ANON=${sign({ role: "anon", iss: "supabase-e2e", exp })}`);
  console.log(`SERVICE=${sign({ role: "service_role", iss: "supabase-e2e", exp })}`);
}
