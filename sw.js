/* ==========================================================================
    SERVICE WORKER — PUSH УВЕДОМЛЕНИЯ (FCM)
    Обработка push-уведомлений когда приложение ЗАКРЫТО
    ========================================================================== */

// ========== КОНФИГУРАЦИЯ ==========
const CACHE_NAME = 'auto-atelier-v1';
const NOTIFICATION_KEY = 'push_notification';

// ========== INSTALL — сразу активируем ==========
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker установлен');
  self.skipWaiting();
});

// ========== ACTIVATE — удаляем старые кэши ==========
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker активирован');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Удалён старый кэш:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ========== FETCH — всегда сеть, ноль кэширования ==========
self.addEventListener('fetch', (event) => {
  // Для push-уведомлений не кэшируем
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Офлайн — показываем заглушку
        return new Response('Нет подключения к интернету', {
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
      })
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});

// ========== PUSH — ОБРАБОТКА ВХОДЯЩИХ УВЕДОМЛЕНИЙ ==========
self.addEventListener('push', function(event) {
  console.log('[SW] Push-уведомление получено');
  
  let title = 'Авто-ателье';
  let body = 'Новое уведомление';
  let icon = '/icons/icon-192.png';
  let badge = '/icons/icon-96.png';
  let data = {};
  let clickAction = './';
  
  if (event.data) {
    try {
      const jsonData = event.data.json();
      title = jsonData.title || title;
      body = jsonData.body || body;
      icon = jsonData.icon || icon;
      badge = jsonData.badge || badge;
      data = jsonData.data || {};
      clickAction = jsonData.click_action || './';
    } catch (e) {
      // Если данные не в JSON формате — просто текст
      body = event.data.text();
    }
  }
  
  // Формируем расширенное тело уведомления
  let extendedBody = body;
  if (data.type === 'daily_summary') {
    extendedBody = buildDailySummary(data);
  }
  
  // Показываем уведомление
  const notificationOptions = {
    body: extendedBody,
    icon: icon,
    badge: badge,
    tag: data.type || 'default',
    requireInteraction: true,
    silent: false,
    actions: [
      {
        action: 'open',
        title: '📱 Открыть приложение'
      },
      {
        action: 'dismiss',
        title: '❌ Закрыть'
      }
    ],
    data: {
      url: clickAction,
      type: data.type || 'default',
      timestamp: Date.now(),
      ...data
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// ========== ФОРМИРОВАНИЕ ДНЕВНОГО ОБЗОРА ==========
function buildDailySummary(data) {
  let summary = '';
  
  // Обязательные платежи
  if (data.mandatoryPayments && data.mandatoryPayments.length > 0) {
    summary += '💰 Обязательные платежи:\n';
    data.mandatoryPayments.forEach(payment => {
      summary += `• ${payment.name}: ${payment.amount.toLocaleString()} ₽\n`;
    });
    summary += '\n';
  }
  
  // Заказы
  if (data.orders && data.orders.length > 0) {
    summary += '📋 Заказы на день:\n';
    data.orders.forEach(order => {
      const status = order.paid ? '✅' : order.done ? '🔧' : '⏳';
      summary += `${status} #${order.orderNumber} — ${order.client || 'Без клиента'} — ${order.services?.map(s => s.serviceName).join(', ')}\n`;
    });
    summary += '\n';
  }
  
  // Календарь / записи
  if (data.bookings && data.bookings.length > 0) {
    summary += '📅 Записи в календаре:\n';
    data.bookings.forEach(booking => {
      summary += `• ${booking.time || 'Утро'} — ${booking.name || 'Без имени'}: ${booking.service || ''}\n`;
    });
    summary += '\n';
  }
  
  // Задачи помощников
  if (data.tasks && data.tasks.length > 0) {
    summary += '👥 Задачи помощников:\n';
    data.tasks.forEach(task => {
      const status = task.status === 'completed' ? '✅' : task.status === 'overdue' ? '❌' : '⏳';
      summary += `${status} ${task.description} — ${task.assignedTo}\n`;
    });
  }
  
  return summary.trim();
}

// ========== NOTIFICATION CLICK — обработка клика по уведомлению ==========
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Клик по уведомлению:', event.action);
  
  // Закрываем уведомление
  event.notification.close();
  
  // Получаем все клиенты (окна)
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      // Если есть открытое окно — фокусируем его
      if (clients.length > 0) {
        const client = clients.find(c => c.visibilityState === 'visible') || clients[0];
        return client.focus();
      }
      
      // Если нет открытого окна — открываем новое
      const url = event.notification.data?.url || './';
      return self.clients.openWindow(url);
    })
  );
});

// ========== NOTIFICATION CLOSE — когда пользователь закрывает уведомление ==========
self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Уведомление закрыто:', event.notification.tag);
  // Можно записать в аналитику, что пользователь закрыл уведомление
});

// ========== MESSAGE — обработка сообщений от приложения ==========
self.addEventListener('message', function(event) {
  console.log('[SW] Сообщение от приложения:', event.data);
  
  if (event.data && event.data.type === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'push_test') {
    // Тестовое push-уведомление
    self.registration.showNotification('🧪 Тест', {
      body: 'Push-уведомления работают!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: 'test',
      requireInteraction: true
    });
  }
});

console.log('[SW] Service Worker загружен');
