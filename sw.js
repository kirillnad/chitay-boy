// Кэширование игры: файлы с хешами в именах — навсегда, index.html — сначала сеть.
// ВАЖНО: sw.js никогда не кэшируем — иначе старый SW будет отдавать старый sw.js
// и обновления никогда не доходят до устройства.
// При новой версии имена файлов меняются, старый кэш чистится по версии.

const CACHE = 'chitaiboi-v3';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['./']))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Чужие origin (модель распознавания и т.п.) — приложение кэширует само
  if (url.origin !== self.location.origin) return;

  // Сам service worker — ТОЛЬКО сеть, без кэша: иначе обновления мёртвы
  if (url.pathname.endsWith('sw.js')) {
    e.respondWith(fetch(req));
    return;
  }

  // HTML: сначала сеть, при провале — кэш (чтобы подхватить новую версию)
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./')))
    );
    return;
  }

  // JS/CSS/картинки/аудио (хешированные): сначала кэш — мгновенная загрузка
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
