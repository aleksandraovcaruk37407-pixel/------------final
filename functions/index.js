// Облачные функции: push-уведомления на телефоны и компьютеры (Firebase Cloud Messaging).
// Логика (кому и что отправлять) — в push-logic.js, здесь только чтение базы и отправка.
// Выкладка: firebase deploy --only functions (нужен тариф Blaze).
// Бесплатная замена без Blaze — github-sender.js по расписанию GitHub Actions. Включайте что-то одно, иначе push придут дважды.
const { setGlobalOptions } = require('firebase-functions/v2');
const { onValueWritten } = require('firebase-functions/v2/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const logic = require('./push-logic');

admin.initializeApp();
const db = admin.database();

// База auto-atelier-1486d-default-rtdb находится в us-central1 — функции рядом с ней
setGlobalOptions({ region: 'us-central1', maxInstances: 3 });

// Часовой пояс ателье (Новосибирск, UTC+7) — для утренней сводки
const TIME_ZONE = 'Asia/Novosibirsk';

const sendToDevices = (devices, message) => logic.sendToDevices(db, admin.messaging(), devices, message);

async function loadRecipients() {
  const [users, tokens] = await Promise.all([db.ref('users').once('value'), db.ref('fcm_tokens').once('value')]);
  return { users: users.val() || {}, tokens: tokens.val() || {} };
}

// Новое уведомление в программе (задача, «сдал на проверку», штраф, выплата, опоздание) → push адресату
exports.pushOnNotice = onValueWritten('/atelier_data/helperNotices', async (event) => {
  const fresh = logic.findNewNotices(event.data.before.val(), event.data.after.val(), Date.now());
  if (!fresh.length) return;
  const { users, tokens } = await loadRecipients();
  for (const notice of fresh) {
    const devices = logic.tokensFor(logic.recipientUids(notice, users), tokens);
    const sent = await sendToDevices(devices, logic.noticeMessage(notice));
    console.log(`Уведомление ${notice.id} → ${notice.to}: устройств ${devices.length}, доставлено ${sent}`);
  }
});

// Утренняя сводка админам в 9:00: заказы со сроком сегодня, задачи помощников, задачи на проверке
exports.dailySummary = onSchedule({ schedule: '0 9 * * *', timeZone: TIME_ZONE }, async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date()); // ГГГГ-ММ-ДД
  const summary = logic.dailySummary((await db.ref('atelier_data').once('value')).val(), today);
  if (!summary) return;
  const { users, tokens } = await loadRecipients();
  const devices = logic.tokensFor(logic.recipientUids({ to: 'admin' }, users), tokens);
  await sendToDevices(devices, logic.buildMessage(summary.title, summary.body, 'daily-' + today));
});
