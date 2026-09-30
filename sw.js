// Service worker: la aplicación funciona sin conexión una vez abierta por primera vez.
const VERSION = 'v3';
const SHELL = `avd-pasos-${VERSION}`;
const PICTOS = 'arasaac-pictos-v1'; // se conserva entre versiones de la aplicación

const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/seed.js', 'js/pictos.js', 'js/ui.js',
  'js/views-user.js', 'js/views-therapist.js', 'js/views-admin.js',
  'fonts/atkinson-400.woff2', 'fonts/atkinson-700.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('avd-pasos-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pictogramas ARASAAC en uso: primero la copia guardada en el dispositivo.
  if (url.hostname === 'static.arasaac.org' && url.pathname.endsWith('_500.png')) {
    e.respondWith(caches.open(PICTOS).then(async cache => {
      const hit = await cache.match(req.url);
      if (hit) return hit;
      const res = await fetch(req.url, { mode: 'cors' });
      if (res.ok) cache.put(req.url, res.clone());
      return res;
    }));
    return;
  }

  // Archivos de la aplicación: con conexión se usa siempre la versión más reciente;
  // sin conexión (o si la red tarda más de 3 s) se sirve la copia guardada.
  if (url.origin === location.origin) {
    e.respondWith(caches.open(SHELL).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
      if (!hit) return fresh;
      const late = new Promise(resolve => setTimeout(() => resolve(hit), 3000));
      return Promise.race([fresh.catch(() => hit), late]);
    }));
  }
});
