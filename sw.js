// Service Worker mínimo. Cache-first para estáticos + cacheo dinámico
// de lo que se va pidiendo (JS/CSS de los módulos), así queda disponible offline.
// NO cachea las llamadas a Firebase (dejá que vayan siempre a la red).
const CACHE = 'alquileres-v6';
const ESTATICOS = [
  './index.html',
  './login.html',
  './assets/styles/tokens.css',
  './assets/styles/styles.css',
  './assets/styles/notificaciones.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Solo GET, y no interceptar Firebase / Google APIs
  if (e.request.method !== 'GET') return;
  if (url.includes('firebase') || url.includes('googleapis') || url.includes('gstatic')) return;

  e.respondWith(
    caches.match(e.request).then((cacheada) => {
      if (cacheada) return cacheada;
      return fetch(e.request).then((respuesta) => {
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return respuesta;
      }).catch(() => cacheada);
    })
  );
});

