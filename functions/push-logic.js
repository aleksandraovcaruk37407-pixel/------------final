// Логика push-уведомлений без Firebase — её проверяют тесты (отладка/тесты/test-push.js)
// и использует песочница, а index.js только читает базу и отправляет сообщения.

// Админы — как в index.html (window.ADMIN_EMAILS) и database.rules.json
const ADMIN_EMAILS = ['egor.wtf38@gmail.com', 'aleksandraovcaruk37407@gmail.com'];

// Уведомление старше этого не отправляем: оно могло «вернуться» при слиянии данных с устройства
const NOTICE_MAX_AGE_MS = 15 * 60 * 1000;

const toList = v => Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);

// Новые уведомления: есть после записи, не было до неё, созданы недавно и не «только в программе»
function findNewNotices(before, after, nowMs) {
  const old = new Set(toList(before).map(n => n.id));
  return toList(after).filter(n => n.id && !old.has(n.id) && n.to && !IN_APP_ONLY_TYPES.includes(n.type) &&
    nowMs - Date.parse(n.createdAt || 0) <= NOTICE_MAX_AGE_MS);
}

function isAdminUser(user) {
  return !!user && (user.role === 'admin' || ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()));
}

// uid получателей: 'admin' — все админы, кроме того, кто сам это сделал (notice.from), иначе — пользователь с этим email
function recipientUids(notice, users) {
  const from = String(notice.from || '').toLowerCase();
  const list = Object.entries(users || {}).filter(([, u]) => !from || String(u && u.email || '').toLowerCase() !== from);
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

const money = n => Math.round(Number(n) || 0).toLocaleString('ru-RU') + ' ₽';
const shortList = (items, max = 4) => items.slice(0, max).join('; ') + (items.length > max ? `; ещё ${items.length - max}` : '');

// Платёж месяца mk: дата (день платежа, но не позже конца месяца) и оплачен ли он (операция кассы с paymentId и month)
function paymentDue(payment, mk) {
  const [y, m] = mk.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Math.max(1, parseInt(payment.day) || 1), last);
  return `${mk}-${String(day).padStart(2, '0')}`;
}
function paymentPaid(payment, mk, cash) {
  return toList(cash).some(o => o.paymentId === payment.id && o.month === mk);
}

// Утренняя сводка для админов по данным atelier_data на дату today ('ГГГГ-ММ-ДД') — то же, что в календаре на этот день:
// заказы, заметки, платежи и задачи помощников; null — нечего сообщить
function dailySummary(data, today) {
  data = data || {};
  const orders = toList(data.ordersData);
  const addDays = (date, n) => {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const isDone = o => o.done === true || o.done === 'true' || o.done === 1;
  const name = o => '№' + o.orderNumber + (o.client ? ' ' + o.client : '');
  // Заказы дня в календаре (дата заказа) и срок сдачи — как getDeadline в app.js: дата + durationDays
  const dayOrders = orders.filter(o => o.date === today && !isDone(o));
  const due = orders.filter(o => o.date && !isDone(o) && parseInt(o.durationDays) > 0 && addDays(o.date, parseInt(o.durationDays)) === today);
  const notes = toList(data.notes).filter(n => n.date === today)
    .sort((x, y) => String(x.time || '').localeCompare(String(y.time || '')));
  const mk = today.slice(0, 7);
  const payments = toList(data.payments).filter(p => !paymentPaid(p, mk, data.cashOps));
  const payToday = payments.filter(p => paymentDue(p, mk) === today);
  const payOverdue = payments.filter(p => paymentDue(p, mk) < today);
  const tasks = [];
  orders.forEach(o => toList(o.services).forEach(sv => toList(sv.tasks).forEach(t => tasks.push({ ...t, orderNumber: o.orderNumber }))));
  const todayTasks = tasks.filter(t => String(t.deadline || '').slice(0, 10) === today && t.status !== 'completed' && t.status !== 'cancelled');
  const review = tasks.filter(t => t.status === 'review');

  const lines = [];
  if (dayOrders.length) lines.push(`🚗 Заказы на сегодня: ${shortList(dayOrders.map(name))}`);
  if (due.length) lines.push(`📋 Сдать сегодня: ${shortList(due.map(name))}`);
  if (notes.length) lines.push(`📝 Заметки: ${shortList(notes.map(n => (n.time ? n.time + ' ' : '') + String(n.text || '').slice(0, 60)))}`);
  if (payToday.length) lines.push(`💳 Платежи сегодня: ${shortList(payToday.map(p => `${p.name} ${money(p.amount)}`))}`);
  if (payOverdue.length) lines.push(`⚠️ Просрочены платежи: ${shortList(payOverdue.map(p => `${p.name} ${money(p.amount)}`))}`);
  const taskNames = todayTasks.map(t => String(t.description || '').slice(0, 40)).filter(Boolean);
  if (todayTasks.length) lines.push(`👷 Задачи помощников на сегодня: ${todayTasks.length}${taskNames.length ? ' — ' + shortList(taskNames, 3) : ''}`);
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

// Закупка, склад и «Взял в работу» — только в программе (колокольчик), push не отправляем. Тот же список — в js/app.js
const IN_APP_ONLY_TYPES = ['purchase', 'stock', 'task_started'];

// Что отправить сейчас (send) и что пропустить как устаревшее или «только в программе» (skip);
// next — новое содержимое push_state/sent: только уведомления, которые ещё есть в программе (остальные забываем), плюс метка _init
function pendingNotices(notices, sent, nowMs) {
  sent = sent || {};
  const send = [], skip = [], next = { _init: sent._init || nowMs };
  toList(notices).forEach(n => {
    if (!n.id || !n.to) return;
    const key = sentKey(n.id);
    if (sent[key]) { next[key] = sent[key]; return; }
    const fresh = nowMs - Date.parse(n.createdAt || 0) <= SENDER_MAX_AGE_MS;
    (fresh && !IN_APP_ONLY_TYPES.includes(n.type) ? send : skip).push(n);
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

// Дата, время 'ЧЧ:ММ' и минуты от полуночи в часовом поясе timeZone
function localDateTime(nowMs, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(nowMs)).map(p => [p.type, p.value]));
  const time = `${parts.hour}:${parts.minute}`;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// Рабочий день помощника по умолчанию (если у него нет графика или в графике не указано время)
const WORK_START = '13:00';
const WORK_END = '21:00';

// Напоминания помощникам нажать «Пришёл» (с начала рабочего дня) и «Ушёл» (после конца, если приход отмечен).
// Каждое — один раз в день (ключ в sent). Без графика — каждый день; с графиком — только в его рабочие дни.
function helperReminders(data, users, nowMs, timeZone, sent) {
  data = data || {}; sent = sent || {};
  const { date, minutes } = localDateTime(nowMs, timeZone);
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const schedules = toList(data.helperSchedules), records = toList(data.attendance);
  const out = [];
  Object.values(users || {}).filter(u => u && u.role === 'helper' && u.email && !isAdminUser(u)).forEach(u => {
    const email = String(u.email);
    const sch = schedules.find(x => x && String(x.email).toLowerCase() === email.toLowerCase());
    if (sch && Array.isArray(sch.days) && !sch.days.map(Number).includes(weekday)) return;
    if (sch && sch.from && date < sch.from) return;
    const start = toMin(sch && sch.start) ?? toMin(WORK_START), end = toMin(sch && sch.end) ?? toMin(WORK_END);
    const rec = records.find(r => r && r.id === `att-${email}-${date}`) || records.find(r => r && r.email === email && r.date === date);
    if (rec && ['dayoff', 'sick', 'absent'].includes(rec.status)) return;
    const inKey = sentKey(`in-${email}-${date}`), outKey = sentKey(`out-${email}-${date}`);
    if (!(rec && rec.in) && minutes >= start && minutes < end && !sent[inKey]) {
      out.push({ key: inKey, to: email, title: '⏰ Рабочий день начался', body: `Начало в ${sch && sch.start || WORK_START}. Не забудьте нажать «Пришёл» в программе.` });
    }
    if (rec && rec.in && !rec.out && minutes >= end && !sent[outKey]) {
      out.push({ key: outKey, to: email, title: '🏁 Рабочий день закончился', body: `Конец в ${sch && sch.end || WORK_END}. Не забудьте нажать «Ушёл» в программе.` });
    }
  });
  return out;
}

// Задачи, срок которых прошёл, а помощник их не сдал: одно уведомление помощнику на задачу.
// Только за последние сутки — чтобы при первом запуске не прислать старые просрочки разом.
function overdueTaskNotices(data, nowMs, timeZone, sent) {
  sent = sent || {};
  const { date, time } = localDateTime(nowMs, timeZone);
  const now = `${date}T${time}`;
  const dayAgo = (() => { const d = localDateTime(nowMs - 24 * 3600 * 1000, timeZone); return `${d.date}T${d.time}`; })();
  const out = [];
  toList((data || {}).ordersData).forEach(o => toList(o.services).forEach(sv => toList(sv.tasks).forEach(t => {
    if (!t || !t.assignedTo || !t.deadline || !t.id) return;
    if (['completed', 'review', 'overdue', 'cancelled'].includes(t.status)) return;
    const deadline = String(t.deadline).length > 10 ? String(t.deadline).slice(0, 16) : `${t.deadline}T23:59`;
    const key = sentKey(`ovd-${t.id}`);
    if (deadline < now && deadline >= dayAgo && !sent[key]) {
      out.push({ key, to: t.assignedTo, title: '❌ Задача не выполнена в срок', body: `${t.description || 'Задача'} (Заказ #${o.orderNumber}). Срок был ${deadline.replace('T', ' ')}.` });
    }
  })));
  return out;
}

// Ключи напоминаний старше трёх дней больше не нужны
function pruneReminderState(sent, nowMs) {
  const next = {};
  Object.entries(sent || {}).forEach(([k, at]) => { if (nowMs - Number(at) < 3 * 24 * 3600 * 1000) next[k] = at; });
  return next;
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

module.exports = { ADMIN_EMAILS, IN_APP_ONLY_TYPES, NOTICE_MAX_AGE_MS, SENDER_MAX_AGE_MS, findNewNotices, recipientUids, tokensFor, buildMessage, noticeMessage, isDeadTokenError, dailySummary,
  sentKey, pendingNotices, localDateHour, localDateTime, dailyDue, helperReminders, overdueTaskNotices, pruneReminderState, WORK_START, WORK_END, sendToDevices };
