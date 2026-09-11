/* ===== Auto-Atelier Service Worker — NO CACHING ===== */
// Этот SW не кэширует ничего — всегда загружает с сервера

// Install — сразу активируем
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — удаляем ВСЕ кэши и освобождаем клиентов
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch — всегда сеть, ноль кэширования
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
