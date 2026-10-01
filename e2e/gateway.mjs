// Gateway local no formato do Supabase: /auth/v1 → GoTrue, /rest/v1 → PostgREST,
// /storage/v1 → Storage simulado que aplica o RLS de storage.objects no Postgres.
import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verify } from "./jwt.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "package.json"));
const pg = require("pg");
const pool = new pg.Pool({ connectionString: process.env.E2E_DB_URL });
const DATA = path.join(here, ".cache", "storage");
const SIGN_SECRET = "storage-sign-secret";

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
}

function proxy(req, res, port, stripPrefix) {
  const target = req.url.slice(stripPrefix.length) || "/";
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  const upstream = http.request({ host: "127.0.0.1", port, method: req.method, path: target, headers }, (up) => {
    const outHeaders = { ...up.headers };
    for (const key of Object.keys(outHeaders)) if (key.toLowerCase().startsWith("access-control-")) delete outHeaders[key];
    res.writeHead(up.statusCode ?? 502, outHeaders);
    up.pipe(res);
  });
  upstream.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: err.message }));
  });
  req.pipe(upstream);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function claimsFrom(req) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers.apikey;
  return token ? verify(String(token)) : null;
}

async function asRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const role = ["anon", "authenticated", "service_role"].includes(claims.role) ? claims.role : "anon";
    await client.query(`set local role ${role}`);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

function filePath(bucket, name) {
  const full = path.resolve(DATA, bucket, name);
  if (!full.startsWith(DATA)) throw new Error("path traversal");
  return full;
}

function signToken(bucket, name, exp) {
  return createHmac("sha256", SIGN_SECRET).update(`${bucket}/${name}:${exp}`).digest("hex") + `.${exp}`;
}

async function storage(req, res, rest) {
  const url = new URL(req.url, "http://x");
  const parts = rest.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);

  // GET /object/sign/:bucket/:path?token=  (link assinado, sem JWT)
  if (req.method === "GET" && parts[0] === "object" && parts[1] === "sign") {
    const [bucket, ...nameParts] = parts.slice(2);
    const name = nameParts.join("/");
    const token = url.searchParams.get("token") ?? "";
    const exp = Number(token.split(".")[1]);
    if (token !== signToken(bucket, name, exp) || exp * 1000 < Date.now()) return json(res, 400, { message: "invalid token" });
    const meta = await pool.query("select mimetype from storage.objects where bucket_id=$1 and name=$2", [bucket, name]);
    const data = await readFile(filePath(bucket, name));
    res.writeHead(200, { "content-type": meta.rows[0]?.mimetype ?? "application/octet-stream" });
    return res.end(data);
  }

  const claims = claimsFrom(req);
  if (!claims) return json(res, 401, { statusCode: "401", error: "Unauthorized", message: "invalid jwt" });

  // POST /object/sign/:bucket/:path  {expiresIn}
  if (req.method === "POST" && parts[0] === "object" && parts[1] === "sign") {
    const [bucket, ...nameParts] = parts.slice(2);
    const name = nameParts.join("/");
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const found = await asRole(claims, (c) =>
      c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [bucket, name]),
    );
    if (found.rowCount === 0) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    const exp = Math.floor(Date.now() / 1000) + Number(body.expiresIn ?? 60);
    return json(res, 200, { signedURL: `/object/sign/${bucket}/${name}?token=${signToken(bucket, name, exp)}` });
  }

  // DELETE /object/:bucket {prefixes}
  if (req.method === "DELETE" && parts[0] === "object" && parts.length === 2) {
    const bucket = parts[1];
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const deleted = await asRole(claims, (c) =>
      c.query("delete from storage.objects where bucket_id=$1 and name = any($2) returning name", [bucket, body.prefixes ?? []]),
    );
    for (const row of deleted.rows) await rm(filePath(bucket, row.name), { force: true });
    return json(res, 200, deleted.rows.map((r) => ({ name: r.name, bucket_id: bucket })));
  }

  if (parts[0] === "object" && parts.length >= 3) {
    const [bucket, ...nameParts] = parts.slice(1);
    const name = nameParts.join("/");

    if (req.method === "POST" || req.method === "PUT") {
      const raw = await readBody(req);
      const request = new Request("http://x", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body: raw });
      let bytes = raw;
      let mimetype = req.headers["content-type"];
      if (String(req.headers["content-type"]).startsWith("multipart/form-data")) {
        const form = await request.formData();
        const file = [...form.values()].find((v) => typeof v !== "string");
        bytes = Buffer.from(await file.arrayBuffer());
        mimetype = file.type;
      }
      const bucketRow = await pool.query("select allowed_mime_types, file_size_limit from storage.buckets where id=$1", [bucket]);
      const limits = bucketRow.rows[0];
      if (!limits) return json(res, 400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
      if (limits.allowed_mime_types && !limits.allowed_mime_types.includes(mimetype)) {
        return json(res, 400, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${mimetype} is not supported` });
      }
      if (limits.file_size_limit && bytes.length > Number(limits.file_size_limit)) {
        return json(res, 400, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
      }
      try {
        const inserted = await asRole(claims, (c) =>
          c.query("insert into storage.objects (bucket_id, name, owner, mimetype) values ($1, $2, $3, $4) returning id", [
            bucket,
            name,
            claims.sub ?? null,
            mimetype,
          ]),
        );
        await mkdir(path.dirname(filePath(bucket, name)), { recursive: true });
        await writeFile(filePath(bucket, name), bytes);
        return json(res, 200, { Id: inserted.rows[0].id, Key: `${bucket}/${name}` });
      } catch (err) {
        return json(res, 400, { statusCode: "403", error: "Unauthorized", message: `new row violates row-level security policy: ${err.message}` });
      }
    }

    if (req.method === "GET") {
      const found = await asRole(claims, (c) =>
        c.query("select mimetype from storage.objects where bucket_id=$1 and name=$2", [bucket, name]),
      );
      if (found.rowCount === 0) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      const data = await readFile(filePath(bucket, name));
      res.writeHead(200, { "content-type": found.rows[0].mimetype ?? "application/octet-stream" });
      return res.end(data);
    }
  }
  return json(res, 404, { message: `storage route not implemented: ${req.method} ${rest}` });
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD");
    res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "*");
    res.writeHead(204);
    return res.end();
  }
  try {
    if (req.url.startsWith("/auth/v1")) return proxy(req, res, 9999, "/auth/v1");
    if (req.url.startsWith("/rest/v1")) return proxy(req, res, 3001, "/rest/v1");
    if (req.url.startsWith("/storage/v1")) return await storage(req, res, req.url.slice("/storage/v1".length));
    json(res, 404, { message: "not found" });
  } catch (err) {
    json(res, 500, { message: err.message });
  }
});
server.listen(54321, "127.0.0.1", () => console.log("gateway em http://127.0.0.1:54321"));
