// Service Worker do SISDC (PWA Offline-First).
//
// Estratégias:
//  - Assets versionados do Vite (/build/*): cache-first (imutáveis, com hash).
//    Como agora são SAME-ORIGIN (não mais CDNs), o cache funciona de fato offline.
//  - Navegações (HTML): network-first com fallback ao cache e, por fim, /offline.html.
//  - Demais GET same-origin: stale-while-revalidate.
//  - Cross-origin (ex.: tiles do mapa): passa direto (precisam de rede).
//  - Background Sync: reenvia a fila (outbox) quando a conexão volta.

// IMPORTANTE: ao publicar correções no app, suba esta versão. A troca do nome
// dispara o `activate`, que apaga os caches antigos e força o aparelho a baixar
// o código novo (evita celular preso numa versão velha em cache).
const CACHE = 'sisdc-v4';
const PRECACHE = ['/offline.html', '/manifest.json'];

self.addEventListener('install', (event) => {
    // Não chamamos skipWaiting() aqui: a nova versão fica em "waiting" e a
    // página avisa o usuário ("Nova versão — Atualizar"). Só assumimos o
    // controle quando ele confirmar (mensagem SKIP_WAITING abaixo).
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

// A página pede para a versão em espera assumir imediatamente (botão Atualizar).
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return; // POST de sync depende de rede (outbox cuida do offline)

    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;

    // Cross-origin (tiles, etc.): não intercepta.
    if (!sameOrigin) return;

    // Assets imutáveis do Vite: cache-first.
    if (url.pathname.startsWith('/build/')) {
        event.respondWith(
            caches.match(request).then((hit) => hit || fetch(request).then((resp) => {
                const copia = resp.clone();
                caches.open(CACHE).then((c) => c.put(request, copia));
                return resp;
            })),
        );
        return;
    }

    // Navegações: network-first, fallback ao cache e à página offline.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((resp) => {
                    const copia = resp.clone();
                    caches.open(CACHE).then((c) => c.put(request, copia));
                    return resp;
                })
                .catch(() => caches.match(request).then((hit) => hit || caches.match('/offline.html'))),
        );
        return;
    }

    // Demais GET same-origin: stale-while-revalidate.
    event.respondWith(
        caches.match(request).then((hit) => {
            const rede = fetch(request).then((resp) => {
                const copia = resp.clone();
                caches.open(CACHE).then((c) => c.put(request, copia));
                return resp;
            }).catch(() => hit);
            return hit || rede;
        }),
    );
});

// Background Sync: o navegador reativa o SW quando há conexão.
self.addEventListener('sync', (event) => {
    if (event.tag === 'sisdc-sync-cadastros') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => client.postMessage({ tipo: 'EXECUTAR_SYNC' }));
            }),
        );
    }
});
