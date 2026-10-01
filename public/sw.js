// Service worker do Finanças: página offline e recebimento de comprovantes pelo menu Compartilhar (Android).
const CACHE = "financas-v1";
const SHARE_CACHE = "share-target";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE && key !== SHARE_CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

async function handleShare(request) {
  const target = (path) => Response.redirect(new URL(path, self.location.origin).href, 303);
  try {
    const formData = await request.formData();
    const file = formData.get("receipt");
    if (!file || typeof file === "string") return target("/comprovantes");
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(
      "/shared-receipt",
      new Response(file, {
        headers: {
          "content-type": file.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(file.name || "comprovante"),
        },
      }),
    );
    return target("/comprovantes?compartilhado=1");
  } catch {
    return target("/comprovantes?compartilhado=falhou");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(handleShare(request));
    return;
  }

  // Navegação: sempre rede (dados financeiros não ficam em cache); sem rede, página offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
  }
});
