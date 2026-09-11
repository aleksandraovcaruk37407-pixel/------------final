/* ===== Auto-Atelier Service Worker ===== */
const CACHE_NAME = 'auto-atelier-v3-20260912';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/firebase.js',
  './manifest.json'
];

// Install — кэшируем статические ресурсы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Кэширование статических ресурсов');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate — очищаем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch — стратегия: Cache First, затем Network
self.addEventListener('fetch', (event) => {
  // Пропускаем Firebase API вызовы — они должны быть онлайн
  if (event.request.url.includes('firebase') || event.request.url.includes('gstatic')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Обновляем кэш в фоне (stale-while-revalidate)
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
        }).catch(() => {
          // Если нет сети — не обновляем кэш
        });
        event.waitUntil(fetchPromise);
        return cached;
      }

      // Нет в кэше — запрашиваем из сети
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      }).catch(() => {
        // Офлайн — показываем fallback для HTML-запросов
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Push-уведомления
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const title = data.title || 'Авто-ателье';
  const options = {
    body: data.body || 'Новое уведомление',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: data.actions || [],
    requireInteraction: data.urgent || false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Находим все клиенты (вкладки)
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) {
        // Открываем существующую вкладку
        clients[0].focus();
        clients[0].postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data });
        return;
      }
      // Открываем новую вкладку
      return self.clients.openWindow('./index.html');
    })
  );
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
