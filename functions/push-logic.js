// Логика push-уведомлений без Firebase — её проверяют тесты (отладка/тесты/test-push.js)
// и использует песочница, а index.js только читает базу и отправляет сообщения.

// Админы — как в index.html (window.ADMIN_EMAILS) и database.rules.json
const ADMIN_EMAILS = ['egor.wtf38@gmail.com', 'aleksandraovcaruk37407@gmail.com'];

// Уведомление старше этого не отправляем: оно могло «вернуться» при слиянии данных с устройства
const NOTICE_MAX_AGE_MS = 15 * 60 * 1000;

const toList = v => Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);

// Новые уведомления: есть после записи, не было до неё, и созданы недавно
function findNewNotices(before, after, nowMs) {
  const old = new Set(toList(before).map(n => n.id));
  return toList(after).filter(n => n.id && !old.has(n.id) && n.to &&
    nowMs - Date.parse(n.createdAt || 0) <= NOTICE_MAX_AGE_MS);
}

function isAdminUser(user) {
  return !!user && (user.role === 'admin' || ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()));
}

// uid получателей: 'admin' — все админы, иначе — пользователь с этим email
function recipientUids(notice, users) {
  const list = Object.entries(users || {});
  if (notice.to === 'admin') return list.filter(([, u]) => isAdminUser(u)).map(([uid]) => uid);
  const email = String(notice.to).toLowerCase();
  return list.filter(([, u]) => String(u && u.email || '').toLowerCase() === email).map(([uid]) => uid);
}

// Токены устройств этих пользователей: fcm_tokens/<uid>/<ключ устройства> = { token, ... }
function tokensFor(uids, fcmTokens) {
  const out = [];
  uids.forEach(uid => Object.entries((fcmTokens || {})[uid] || {}).forEach(([key, t]) => {
    if (t && typeof t.token === 'string' && t.token) out.push({ uid, key, token: t.token });
  }));
  return out;
}

// Сообщение FCM: только data — уведомление показывает наш sw.js (значения — строки)
function buildMessage(title, body, tag) {
  return {
    data: { title: String(title), body: String(body).slice(0, 500), tag: String(tag || 'atelier'), url: './' },
    webpush: { headers: { Urgency: 'high', TTL: String(24 * 3600) } }
  };
}

function noticeMessage(notice) {
  return buildMessage('Авто-ателье', notice.message || 'Новое уведомление', notice.id);
}

// Ошибки, после которых токен устройства больше не годится — его удаляем
function isDeadTokenError(code) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}

// Утренняя сводка для админов по данным atelier_data на дату today ('ГГГГ-ММ-ДД'); null — нечего сообщить
function dailySummary(data, today) {
  data = data || {};
  const orders = toList(data.ordersData);
  const addDays = (date, n) => {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const isDone = o => o.done === true || o.done === 'true' || o.done === 1;
  // Срок заказа — как getDeadline в app.js: дата + durationDays
  const due = orders.filter(o => o.date && !isDone(o) && parseInt(o.durationDays) > 0 && addDays(o.date, parseInt(o.durationDays)) === today);
  const tasks = [];
  orders.forEach(o => toList(o.services).forEach(s => toList(s.tasks).forEach(t => tasks.push({ ...t, orderNumber: o.orderNumber }))));
  const todayTasks = tasks.filter(t => String(t.deadline || '').slice(0, 10) === today && t.status !== 'completed');
  const review = tasks.filter(t => t.status === 'review');

  const lines = [];
  if (due.length) lines.push(`📋 Сдать сегодня: ${due.map(o => '№' + o.orderNumber + ' ' + (o.client || '')).join(', ')}`);
  if (todayTasks.length) lines.push(`👷 Задачи помощников на сегодня: ${todayTasks.length}`);
  if (review.length) lines.push(`🕓 Ждут проверки: ${review.length}`);
  if (!lines.length) return null;
  return { title: '📅 План на сегодня', body: lines.join('\n') };
}

// ---------- Отправитель по расписанию (GitHub Actions, github-sender.js) ----------
// Он запускается раз в несколько минут и помнит отправленное в push_state/sent: { <ключ id>: время }.

// Старше суток не отправляем: устройство долго было без связи, новость уже неактуальна
const SENDER_MAX_AGE_MS = 24 * 3600 * 1000;

// id уведомления → ключ Firebase (в ключах нельзя . # $ [ ] /)
function sentKey(id) {
  return String(id).replace(/[.#$[\]/]/g, '_');
}

// Что отправить сейчас (send) и что пропустить как устаревшее (skip); next — новое содержимое push_state/sent:
// только уведомления, которые ещё есть в программе (остальные забываем), плюс метка _init
function pendingNotices(notices, sent, nowMs) {
  sent = sent || {};
  const send = [], skip = [], next = { _init: sent._init || nowMs };
  toList(notices).forEach(n => {
    if (!n.id || !n.to) return;
    const key = sentKey(n.id);
    if (sent[key]) { next[key] = sent[key]; return; }
    (nowMs - Date.parse(n.createdAt || 0) <= SENDER_MAX_AGE_MS ? send : skip).push(n);
    next[key] = nowMs;
  });
  return { send, skip, next };
}

// Дата ('ГГГГ-ММ-ДД') в часовом поясе timeZone и час
function localDateHour(nowMs, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(nowMs)).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// Пора ли утренняя сводка: с hour часов по местному времени, один раз в день. Возвращает дату или null
function dailyDue(nowMs, timeZone, hour, lastSentDate) {
  const { date, hour: h } = localDateHour(nowMs, timeZone);
  return h >= hour && lastSentDate !== date ? date : null;
}

// Отправка на устройства (db и messaging — из firebase-admin); недействительные токены удаляются
async function sendToDevices(db, messaging, devices, message) {
  if (!devices.length) return 0;
  const res = await messaging.sendEachForMulticast({ ...message, tokens: devices.map(d => d.token) });
  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success && isDeadTokenError(r.error && r.error.code)) dead.push(devices[i]);
    else if (!r.success) console.warn('Не отправлено', devices[i].uid, r.error && r.error.code);
  });
  await Promise.all(dead.map(d => db.ref(`fcm_tokens/${d.uid}/${d.key}`).remove()));
  return res.successCount;
}

module.exports = { ADMIN_EMAILS, NOTICE_MAX_AGE_MS, SENDER_MAX_AGE_MS, findNewNotices, recipientUids, tokensFor, buildMessage, noticeMessage, isDeadTokenError, dailySummary,
  sentKey, pendingNotices, localDateHour, dailyDue, sendToDevices };
