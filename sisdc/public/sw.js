// Service Worker do SISDC (PWA Offline-First).
//
// Responsabilidades:
//  - Cache do "app shell" (HTML/CSS/JS) para abrir sem rede.
//  - Estrategia network-first para GETs de API (cai no cache quando offline).
//  - Background Sync: reenvia a outbox quando a conexao retorna.
//
// Em producao, gere a lista de assets com Workbox/Vite PWA em vez da lista fixa.

const CACHE = 'sisdc-shell-v1';
const APP_SHELL = [
    '/',
    '/painel/mapa',
    '/offline.html',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)),
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
        ),
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Nao interceptamos o POST de sync (precisa de rede; a outbox cuida do offline).
    if (request.method !== 'GET') return;

    event.respondWith(
        fetch(request)
            .then((resp) => {
                const copia = resp.clone();
                caches.open(CACHE).then((cache) => cache.put(request, copia));
                return resp;
            })
            .catch(() => caches.match(request).then((c) => c || caches.match('/offline.html'))),
    );
});

// Background Sync: o navegador reativa o SW quando ha conexao.
self.addEventListener('sync', (event) => {
    if (event.tag === 'sisdc-sync-cadastros') {
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                // Pede a uma aba ativa para rodar o ciclo de sync (acesso ao IndexedDB/token).
                clients.forEach((client) => client.postMessage({ tipo: 'EXECUTAR_SYNC' }));
            }),
        );
    }
});
