const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();
const messaging = admin.messaging();

// ========== ЕЖЕДНЕВНОЕ УТРОЕННОЕ УВЕДОМЛЕНИЕ ==========
// Запускается каждый день в 8:00 по UTC (11:00 MSK)
exports.dailyMorningNotification = functions.pubsub.schedule('0 8 * * *').onRun(async (context) => {
  console.log('[FCM] Запуск ежедневного утреннего уведомления');
  
  try {
    // Получаем все токены админов
    const tokensSnapshot = await db.ref('fcm_tokens').once('value');
    if (!tokensSnapshot.exists()) {
      console.log('[FCM] Нет токенов для отправки');
      return null;
    }
    
    const adminTokens = [];
    const allTokens = tokensSnapshot.val();
    
    for (const userId in allTokens) {
      for (const tokenKey in allTokens[userId]) {
        const tokenData = allTokens[userId][tokenKey];
        if (tokenData.role === 'admin' && tokenData.token) {
          adminTokens.push({
            token: tokenData.token,
            userId: userId,
            email: tokenData.email
          });
        }
      }
    }
    
    if (adminTokens.length === 0) {
      console.log('[FCM] Нет токенов админов');
      return null;
    }
    
    // Получаем данные для уведомления
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 1. Обязательные платежи
    const budgetSnapshot = await db.ref('budget_data').once('value');
    const budgetData = budgetSnapshot.val() || {};
    const mandatoryPayments = (budgetData.mandatoryPayments || []).map(mp => ({
      name: mp.name,
      amount: mp.target,
      day: mp.day,
      paid: mp.paid || false,
      icon: mp.icon || '💰'
    }));
    
    // 2. Заказы на сегодня
    const ordersSnapshot = await db.ref('orders_data').once('value');
    const allOrders = ordersSnapshot.val() || [];
    const todayOrders = allOrders.filter(order => {
      if (!order.date) return false;
      return order.date === todayStr;
    }).map(order => ({
      orderNumber: order.orderNumber,
      client: order.client,
      services: (order.services || []).map(s => s.serviceName),
      paid: order.paid || false,
      done: order.done || false,
      clientPrice: order.clientPrice
    }));
    
    // 3. Записи в календаре на сегодня
    const bookingsSnapshot = await db.ref('calendar_bookings').once('value');
    const allBookings = bookingsSnapshot.val() || [];
    const todayBookings = allBookings.filter(booking => {
      if (!booking.date) return false;
      return booking.date === todayStr;
    }).map(booking => ({
      name: booking.name,
      phone: booking.phone,
      service: booking.service,
      time: booking.time || 'Утро'
    }));
    
    // 4. Задачи помощников на сегодня
    const tasksSnapshot = await db.ref('tasks').once('value');
    const allTasks = tasksSnapshot.val() || [];
    const todayTasks = Object.values(allTasks).filter(task => {
      if (!task.deadline) return false;
      return task.deadline === todayStr;
    }).map(task => ({
      description: task.description,
      assignedTo: task.assignedTo,
      status: task.status,
      pay: task.pay
    }));
    
    // 5. Заметки на сегодня
    const notesSnapshot = await db.ref('notes_data').once('value');
    const allNotes = notesSnapshot.val() || [];
    const todayNotes = allNotes.filter(note => {
      if (!note.date) return false;
      return note.date === todayStr;
    }).map(note => ({
      text: note.text,
      time: note.time
    }));
    
    // Формируем тело уведомления
    let body = '';
    
    if (mandatoryPayments.length > 0) {
      const unpaidPayments = mandatoryPayments.filter(p => !p.paid);
      if (unpaidPayments.length > 0) {
        body += `💰 ${unpaidPayments.length} обязательных платежей:\n`;
        unpaidPayments.forEach(p => {
          body += `${p.icon} ${p.name}: ${p.amount.toLocaleString()} ₽\n`;
        });
        body += '\n';
      }
    }
    
    if (todayOrders.length > 0) {
      body += `📋 ${todayOrders.length} заказов на сегодня:\n`;
      todayOrders.forEach(order => {
        const status = order.paid ? '✅' : order.done ? '🔧' : '⏳';
        body += `${status} #${order.orderNumber} — ${order.client || 'Без клиента'}\n`;
      });
      body += '\n';
    }
    
    if (todayBookings.length > 0) {
      body += `📅 ${todayBookings.length} записей в календаре:\n`;
      todayBookings.forEach(booking => {
        body += `• ${booking.time || 'Утро'} — ${booking.name || 'Без имени'}: ${booking.service || ''}\n`;
      });
      body += '\n';
    }
    
    if (todayTasks.length > 0) {
      body += `👥 ${todayTasks.length} задач помощников:\n`;
      todayTasks.forEach(task => {
        const status = task.status === 'completed' ? '✅' : task.status === 'overdue' ? '❌' : '⏳';
        body += `${status} ${task.description}\n`;
      });
    }
    
    if (!body) {
      body = '✅ На сегодня всё спокойно! Хорошего дня!';
    }
    
    // Формируем payload для push
    const payload = {
      notification: {
        title: `📅 План на день — ${today.toLocaleDateString('ru-RU')}`,
        body: body.substring(0, 400) // FCM limit for body
      },
      data: {
        type: 'daily_summary',
        url: './',
        mandatoryPayments: mandatoryPayments,
        orders: todayOrders,
        bookings: todayBookings,
        tasks: todayTasks,
        notes: todayNotes,
        date: todayStr
      },
      android: {
        priority: 'high',
        notification: {
          channel: 'daily_notifications',
          icon: 'notification',
          color: '#1a3c5e',
          defaultSound: true,
          defaultVibrateTimings: true,
          imageUrl: ''
        }
      },
      apns: {
        payload: {
          aps: {
            badge: adminTokens.length,
            sound: 'default',
            category: 'UNIFORM'
          }
        },
        headers: {
          'apns-priority': '10',
          'apns-expiration': '0'
        }
      }
    };
    
    // Отправляем всем админам
    const tokens = adminTokens.map(t => t.token);
    
    if (tokens.length === 0) {
      console.log('[FCM] Нет токенов для отправки');
      return null;
    }
    
    // Разбиваем на чанки по 500 (лимит FCM)
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) {
      chunks.push(tokens.slice(i, i + 500));
    }
    
    let totalSent = 0;
    
    for (const chunk of chunks) {
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: chunk,
          ...payload
        });
        
        console.log(`[FCM] Отправлено: ${response.successCount}, Ошибки: ${response.failureCount}`);
        totalSent += response.successCount;
        
        // Обрабатываем ошибки (невалидные токены)
        if (response.responses) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const error = resp.error;
              const token = chunk[idx];
              
              // Удаляем невалидные токены
              if (error.code === 'messaging/invalid-registration-token' ||
                  error.code === 'messaging/registration-token-not-registered') {
                console.log('[FCM] Удалён невалидный токен:', token);
                // TODO: удалить токен из базы данных
              }
            }
          });
        }
      } catch (error) {
        console.error('[FCM] Ошибка отправки чанка:', error);
      }
    }
    
    console.log(`[FCM] Всего отправлено: ${totalSent} уведомлений`);
    
    // Записываем в лог
    await db.ref('notifications_log').push({
      type: 'daily_summary',
      date: todayStr,
      sentAt: new Date().toISOString(),
      sentTo: totalSent,
      ordersCount: todayOrders.length,
      paymentsCount: mandatoryPayments.length,
      bookingsCount: todayBookings.length,
      tasksCount: todayTasks.length
    });
    
    return { success: true, sent: totalSent };
    
  } catch (error) {
    console.error('[FCM] Ошибка ежедневного уведомления:', error);
    return null;
  }
});

// ========== ТЕСТОВОЕ УВЕДОМЛЕНИЕ ==========
exports.sendTestNotification = functions.https.onCall(async (data, context) => {
  // Требует авторизации
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  
  try {
    const tokensSnapshot = await db.ref('fcm_tokens').once('value');
    const allTokens = tokensSnapshot.val() || {};
    
    const tokens = [];
    for (const userId in allTokens) {
      for (const tokenKey in allTokens[userId]) {
        const tokenData = allTokens[userId][tokenKey];
        if (tokenData.token) {
          tokens.push(tokenData.token);
        }
      }
    }
    
    if (tokens.length === 0) {
      throw new Error('Нет доступных токенов');
    }
    
    const payload = {
      notification: {
        title: '🧪 Тест',
        body: 'Push-уведомления работают!'
      },
      data: {
        type: 'test',
        url: './'
      }
    };
    
    const response = await messaging.sendEachForMulticast({
      tokens: tokens,
      ...payload
    });
    
    return { success: true, sent: response.successCount };
    
  } catch (error) {
    console.error('[FCM] Ошибка тестового уведомления:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ========== ОЧИСТКА СТАРЫХ ТОКЕНОВ ==========
exports.cleanupExpiredTokens = functions.pubsub.schedule('0 0 1 * *').onRun(async (context) => {
  // Запускается 1-го числа каждого месяца в 00:00 UTC
  console.log('[FCM] Очистка старых токенов');
  
  try {
    const tokensSnapshot = await db.ref('fcm_tokens').once('value');
    const allTokens = tokensSnapshot.val() || {};
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let deletedCount = 0;
    
    for (const userId in allTokens) {
      for (const tokenKey in allTokens[userId]) {
        const tokenData = allTokens[userId][tokenKey];
        if (tokenData.lastUpdated) {
          const lastUpdated = new Date(tokenData.lastUpdated);
          if (lastUpdated < thirtyDaysAgo) {
            await db.ref(`fcm_tokens/${userId}/${tokenKey}`).remove();
            deletedCount++;
          }
        }
      }
    }
    
    console.log(`[FCM] Удалено ${deletedCount} старых токенов`);
    return { deleted: deletedCount };
    
  } catch (error) {
    console.error('[FCM] Ошибка очистки:', error);
    return null;
  }
});
