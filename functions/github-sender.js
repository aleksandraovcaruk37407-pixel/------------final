// Бесплатная отправка push без тарифа Blaze: запускается по расписанию в GitHub Actions
// (.github/workflows/push.yml) примерно раз в 5 минут.
//   1. Читает уведомления программы (atelier_data/helperNotices).
//   2. Новые (которых нет в push_state/sent) отправляет на устройства адресатов.
//   3. В 9:00 по Новосибирску один раз в день шлёт админам утреннюю сводку (заказы, заметки, платежи, задачи дня).
//   4. Напоминает помощникам нажать «Пришёл» (с 13:00 или по графику) и «Ушёл», сообщает о просроченных задачах.
// Доступ к базе — по ключу сервисного аккаунта из секрета репозитория FIREBASE_SERVICE_ACCOUNT.
const logic = require('./push-logic');

const DATABASE_URL = 'https://auto-atelier-1486d-default-rtdb.firebaseio.com';
const TIME_ZONE = 'Asia/Novosibirsk';
const SUMMARY_HOUR = 9;

const toList = v => Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);

// db и messaging передаются снаружи: в GitHub — из firebase-admin, в тестах — поддельные
async function run({ db, messaging, now = Date.now() }) {
  const report = { firstRun: false, sent: 0, skipped: 0, devices: 0, summary: null, reminders: 0 };
  const [noticesSnap, stateSnap] = await Promise.all([
    db.ref('atelier_data/helperNotices').once('value'),
    db.ref('push_state').once('value')
  ]);
  const notices = toList(noticesSnap.val());
  const state = stateSnap.val() || {};

  let recipients = null;
  const loadRecipients = async () => {
    if (!recipients) {
      const [users, tokens] = await Promise.all([db.ref('users').once('value'), db.ref('fcm_tokens').once('value')]);
      recipients = { users: users.val() || {}, tokens: tokens.val() || {} };
    }
    return recipients;
  };

  // Первый запуск: всё, что уже есть, считаем отправленным — старые уведомления не рассылаем
  const { send, skip, next } = logic.pendingNotices(notices, state.sent, now);
  if (!state.sent) {
    report.firstRun = true;
  } else {
    for (const notice of send) {
      const { users, tokens } = await loadRecipients();
      const devices = logic.tokensFor(logic.recipientUids(notice, users), tokens);
      report.devices += await logic.sendToDevices(db, messaging, devices, logic.noticeMessage(notice));
      report.sent++;
    }
    report.skipped = skip.length;
  }
  if (JSON.stringify(next) !== JSON.stringify(state.sent || null)) await db.ref('push_state/sent').set(next);

  let appData = null;
  const loadData = async () => appData || (appData = (await db.ref('atelier_data').once('value')).val() || {});

  // Утренняя сводка админам
  const today = logic.dailyDue(now, TIME_ZONE, SUMMARY_HOUR, state.dailySent);
  if (today) {
    const summary = logic.dailySummary(await loadData(), today);
    if (summary) {
      const { users, tokens } = await loadRecipients();
      const devices = logic.tokensFor(logic.recipientUids({ to: 'admin' }, users), tokens);
      report.devices += await logic.sendToDevices(db, messaging, devices, logic.buildMessage(summary.title, summary.body, 'daily-' + today));
    }
    report.summary = today;
    await db.ref('push_state/dailySent').set(today);
  }

  // Напоминания помощникам «Пришёл» / «Ушёл» и задачи, не выполненные в срок (каждое — один раз)
  if (!report.firstRun) {
    const data = await loadData();
    const { users, tokens } = await loadRecipients();
    const reminded = state.reminders || {};
    const items = [
      ...logic.helperReminders(data, users, now, TIME_ZONE, reminded),
      ...logic.overdueTaskNotices(data, now, TIME_ZONE, reminded)
    ];
    const nextReminded = logic.pruneReminderState(reminded, now);
    for (const it of items) {
      const devices = logic.tokensFor(logic.recipientUids({ to: it.to }, users), tokens);
      report.devices += await logic.sendToDevices(db, messaging, devices, logic.buildMessage(it.title, it.body, it.key));
      nextReminded[it.key] = now;
      report.reminders = (report.reminders || 0) + 1;
    }
    if (JSON.stringify(nextReminded) !== JSON.stringify(state.reminders || {})) await db.ref('push_state/reminders').set(nextReminded);
  }
  return report;
}

async function main() {
  const secret = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!secret) {
    // Секрет ещё не добавлен — не считаем ошибкой, чтобы GitHub не слал письма о сбоях каждые 5 минут
    console.log('Нет секрета FIREBASE_SERVICE_ACCOUNT — отправка push пропущена. См. PUSH_NOTIFICATIONS_INSTRUCTIONS.md');
    return;
  }
  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(secret)), databaseURL: DATABASE_URL });
  try {
    const report = await run({ db: admin.database(), messaging: admin.messaging() });
    console.log(report.firstRun
      ? 'Первый запуск: существующие уведомления отмечены как отправленные'
      : `Отправлено уведомлений: ${report.sent}, напоминаний: ${report.reminders}, доставок на устройства: ${report.devices}, пропущено устаревших: ${report.skipped}`);
    if (report.summary) console.log('Утренняя сводка за', report.summary);
  } finally {
    await admin.app().delete(); // иначе соединение с базой не даст процессу завершиться
  }
}

if (require.main === module) {
  main().catch(e => { console.error('Ошибка отправки push:', e); process.exit(1); });
}

module.exports = { run };
