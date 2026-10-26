/* ==========================================================================
    SERVICE WORKER — показ push-уведомлений, когда программа закрыта

    Отправитель (functions/github-sender.js или functions/index.js) присылает сообщение FCM только с данными:
      { data: { title, body, tag, url } }
    Здесь из него делается системное уведомление; нажатие открывает программу.
    Файлы не кэшируются — программа всегда загружается из сети.
    ========================================================================== */

// Пути — от папки программы (на GitHub Pages она не в корне сайта)
const SCOPE = self.registration.scope;
const ICON = new URL('icons/icon-192.png', SCOPE).href;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  // Старые кэши прошлых версий больше не нужны
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

// Без сети при открытии программы — понятное сообщение вместо ошибки браузера
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response('Нет подключения к интернету', {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }))
  );
});

// Содержимое push: сообщение FCM ({ data: {...} } или { notification: {...} }) либо простой текст
function readPush(event) {
  if (!event.data) return {};
  try {
    const json = event.data.json();
    return { ...(json.notification || {}), ...(json.data || {}) };
  } catch (e) {
    return { body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const msg = readPush(event);
  event.waitUntil(self.registration.showNotification(msg.title || 'Авто-ателье', {
    body: msg.body || 'Новое уведомление',
    icon: ICON,
    badge: ICON,
    // tag = id уведомления: если программа уже показала его сама, push заменит его без второго сигнала
    tag: msg.tag || 'atelier',
    data: { url: new URL(msg.url || './', SCOPE).href }
  }));
});

// Нажатие: открытая программа выходит на передний план, иначе открывается новое окно
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || SCOPE;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find(c => c.url.startsWith(SCOPE));
      return client ? client.focus() : self.clients.openWindow(url);
    })
  );
});
