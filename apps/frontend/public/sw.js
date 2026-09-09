const CACHE_NAME = 'itp-cache-v1';
const OFFLINE_URLS = ['/login', '/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Apenas requests GET, ignora extensões de browser e requests de API
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  // /backend-api/* é o proxy do Next pro backend (next.config.mjs) — inclui
  // rotas de OAuth (SSO Microsoft) que redirecionam pra domínio externo.
  // fetch() seguindo redirect cross-origin numa requisição de navegação
  // interceptada pelo SW cancela silenciosamente — nunca intercepta essa rota.
  if (url.pathname.startsWith('/backend-api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Armazena em cache recursos estáticos do Next.js (_next/static)
        if (url.pathname.startsWith('/_next/static/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
