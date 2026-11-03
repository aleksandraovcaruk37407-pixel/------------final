// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: calendar-alt;

/* ==========================================================================
   ВИДЖЕТ «КАЛЕНДАРЬ АТЕЛЬЕ» ДЛЯ iPHONE (приложение Scriptable, бесплатное).
   Показывает на главном экране дела на сегодня из программы авто-ателье:
   админу — просроченное, сдать/принять, задачи помощников, платежи, свои задачи;
   помощнику — свои задачи и отметку прихода. Нажатие открывает календарь программы.

   Вход: при первом запуске в Scriptable спросит почту и пароль от программы.
   Пароль НЕ сохраняется — в связке ключей iPhone хранится только ключ входа (как в браузере).
   Сменить пользователя: запустить скрипт в Scriptable → «Выйти».
   ========================================================================== */

const API_KEY = 'AIzaSyDGsjB5bhSL2keL0xTIOJib3ZB9HEqGyMs';
const DB = 'https://auto-atelier-1486d-default-rtdb.firebaseio.com';
const SITE = 'https://aleksandraovcaruk37407-pixel.github.io/------------final/';
const KEY = 'atelier_widget_refresh';

// ==ЛОГИКА== (без Scriptable — проверяется на компьютере: отладка/тесты/test-widget-iphone.js)
const W_PEOPLE = {
    'Александра': ['aleksandraovcaruk37407@gmail.com', 'admin@test.local'],
    'Егор': ['egor.wtf38@gmail.com'],
    'Дауд': ['daud_yt_play@yandex.ru', 'helper@test.local']
};
const W_PHOTO_FROM = '2026-10-28';

function wArr(v) {
    if (Array.isArray(v)) return v.filter(x => x != null);
    if (v && typeof v === 'object') return Object.values(v).filter(x => x != null);
    return [];
}
function wDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function wDDMM(s) { return s ? `${s.slice(8, 10)}.${s.slice(5, 7)}` : ''; }
function wDone(o) { return o.done === true || o.done === 'true' || o.done === 1; }
function wDeadline(o) {
    if (!o.date || !(parseInt(o.durationDays) > 0)) return '';
    const d = new Date(o.date);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + (parseInt(o.durationDays) || 0));
    return d.toISOString().slice(0, 10);
}
function wPerson(email) {
    const e = String(email || '').toLowerCase();
    return Object.keys(W_PEOPLE).find(n => W_PEOPLE[n].includes(e)) || null;
}
function wMoney(n) { return String(Math.round(parseFloat(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }

// План студии из js/studio-plan.js (строки вида {"id": ...},)
function wParsePlan(text) {
    const out = [];
    // Задачи студии выключены в программе (window.STUDIO_ENABLED = false) — в виджете их тоже нет
    if (/STUDIO_ENABLED\s*=\s*false/.test(String(text || ''))) { out.disabled = true; return out; }
    String(text || '').split('\n').forEach(line => {
        const m = line.trim().replace(/,$/, '');
        if (m.startsWith('{') && m.endsWith('}')) { try { out.push(JSON.parse(m)); } catch (e) {} }
    });
    return out;
}

// Задачи студии: план + съёмка машины Егору по заказам + задачи, поставленные в программе
function wStudioTasks(data, plan) {
    const marks = wArr(data.studioTaskMarks);
    const status = t => { const m = marks.find(x => x.id === t.id); return m && m.status ? m.status : 'todo'; };
    const custom = marks.filter(m => m.custom && m.date && m.text);
    // Выключатель гасит только план из экселя и съёмку — задачи, поставленные в программе, видны всегда
    if (plan.disabled) return { list: custom, status };
    const list = plan.slice();
    wArr(data.ordersData).forEach(o => {
        if (o.id == null || !o.date || o.date < W_PHOTO_FROM) return;
        const car = `№${o.orderNumber || ''} ${o.client || ''}`.trim();
        list.push({ id: 'photo-in-' + o.id, date: o.date, who: ['Егор'], text: `📸 Снять машину при приёме: ${car}` });
        const due = wDeadline(o);
        if (due && due !== o.date) list.push({ id: 'photo-out-' + o.id, date: due, who: ['Егор'], text: `📸 Снять машину при выдаче: ${car}` });
    });
    custom.forEach(m => list.push(m));
    return { list, status };
}

// Строки виджета: { icon, text, late } — по важности; плюс счётчики для маленького виджета
function wBuildToday(data, plan, email, role, today) {
    const rows = [];
    const add = (icon, text, late, rank) => rows.push({ icon, text, late: !!late, rank });
    const orders = wArr(data.ordersData);
    const isAdmin = role === 'admin';
    const me = String(email || '').toLowerCase();
    const person = wPerson(email);
    const counts = { late: 0, due: 0, start: 0, tasks: 0, pay: 0 };

    if (isAdmin) {
        orders.filter(o => !wDone(o) && wDeadline(o) && wDeadline(o) < today).forEach(o => {
            counts.late++; add('🔴', `Не сдан №${o.orderNumber} ${o.client || ''} (срок ${wDDMM(wDeadline(o))})`, true, 0);
        });
        orders.filter(o => !wDone(o) && wDeadline(o) === today).forEach(o => {
            counts.due++; add('🏁', `Сдать №${o.orderNumber} ${o.client || ''}`, false, 1);
        });
        orders.filter(o => o.date === today).forEach(o => {
            counts.start++; add('📥', `Приём №${o.orderNumber} ${o.client || ''}`, false, 2);
        });
    }
    // Задачи помощникам по заказам: админ — все, помощник — свои
    orders.forEach(o => wArr(o.services).forEach(s => wArr(s.tasks).forEach(t => {
        if (!t.deadline || t.status === 'completed') return;
        if (!isAdmin && String(t.assignedTo || '').toLowerCase() !== me) return;
        const day = String(t.deadline).split('T')[0];
        if (day > today) return;
        const who = isAdmin && t.assignedTo ? String(t.assignedTo).split('@')[0] + ': ' : '';
        const time = String(t.deadline).includes('T') ? ' до ' + String(t.deadline).split('T')[1].slice(0, 5) : '';
        counts.tasks++;
        add('👷', `${who}${t.description || 'задача'} (№${o.orderNumber})${day < today ? ' — просрочено' : time}${t.status === 'review' ? ' — на проверке' : ''}`, day < today, day < today ? 0 : 3);
    })));
    // Задачи студии: свои, на сегодня и просроченные
    const st = wStudioTasks(data, plan);
    st.list.filter(t => person && (t.who || []).includes(person) && t.date <= today && st.status(t) !== 'done')
        .forEach(t => { counts.tasks++; add('📌', t.text + (t.date < today ? ` (с ${wDDMM(t.date)})` : ''), t.date < today, t.date < today ? 1 : 4); });
    if (isAdmin) {
        // Обязательные платежи этого месяца: до сегодня включительно, не оплаченные
        const mk = today.slice(0, 7);
        const [y, m] = mk.split('-').map(Number);
        const dim = new Date(y, m, 0).getDate();
        const cash = wArr(data.cashOps);
        wArr(data.payments).forEach(p => {
            const due = `${mk}-${String(Math.min(Math.max(1, parseInt(p.day) || 1), dim)).padStart(2, '0')}`;
            if (due > today || cash.some(o => o.paymentId === p.id && o.month === mk)) return;
            counts.pay++; add('💳', `${p.name} ${wMoney(p.amount)}${due < today ? ' — просрочен' : ''}`, due < today, due < today ? 1 : 5);
        });
    } else {
        // Помощник: отметка прихода
        const rec = wArr(data.attendance).find(a => a && a.email && a.email.toLowerCase() === me && a.date === today);
        if (!rec) add('🕘', 'Не забудьте отметить приход', false, 0);
        else if (rec.in && !rec.out) add('▶️', `Пришли в ${rec.in}`, false, 9);
    }
    wDayNotes(data, email, role, today).forEach(n => add(n.icon, n.text, false, n.rank));
    rows.sort((a, b) => a.rank - b.rank);
    return { rows, counts };
}

// Заметки дня, как в программе (js/calendar-extra.js): заметка «для кого» — только им и автору,
// предзапись 📞 — админам, отпуск 🌴 — каждый его день
function wDayNotes(data, email, role, today) {
    const me = String(email || '').toLowerCase(), person = wPerson(email), isAdmin = role === 'admin';
    const out = [];
    wArr(data.notes).forEach(n => {
        if (n.kind === 'vacation') {
            if (n.date <= today && (n.to || n.date) >= today && (isAdmin || String(n.email || '').toLowerCase() === me))
                out.push({ icon: '🌴', text: `${n.who || ''} в отпуске до ${wDDMM(n.to || n.date)}`, rank: 6 });
        } else if (n.kind === 'prebook') {
            if (isAdmin && n.date === today) out.push({ icon: '📞', text: `${n.time ? n.time + ' ' : ''}${n.client || ''}${n.service ? ', ' + n.service : ''}`, rank: 2 });
        } else if (n.date === today) {
            const forList = wArr(n.for);
            const mine = forList.length ? (person && forList.includes(person)) || String(n.by || '').toLowerCase() === me : isAdmin;
            if (mine) out.push({ icon: '📝', text: `${n.time ? n.time + ' ' : ''}${n.text}`, rank: 6 });
        }
    });
    return out;
}

// Месяц для большого виджета: по каждому дню — есть ли дела и важные метки
function wBuildMonth(data, plan, email, role, today) {
    const [y, m] = today.slice(0, 7).split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(y, m - 1, 1 - offset + i);
        const ds = wDate(d);
        const r = wBuildToday(data, plan, email, role, ds);
        // Просроченное «на сегодня» тянется из прошлых дней — в сетке месяца считаем только дела этого дня
        const own = r.rows.filter(x => !x.late && x.icon !== '🕘' && x.icon !== '▶️');
        days.push({ ds, day: d.getDate(), inMonth: d.getMonth() === m - 1, today: ds === today, count: own.length,
            due: r.counts.due > 0, vacation: own.some(x => x.icon === '🌴'), prebook: own.some(x => x.icon === '📞') });
        if (i >= 34 && d.getMonth() !== m - 1 && d.getDay() === 0) break; // хватит 5 недель
    }
    return { title: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][m - 1] + ' ' + y, days };
}
// ==КОНЕЦ ЛОГИКИ==

// ---------- Вход и чтение данных ----------
async function wPost(url, body, form) {
    const r = new Request(url);
    r.method = 'POST';
    r.headers = { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' };
    r.body = form ? body : JSON.stringify(body);
    return r.loadJSON();
}

async function wLogin() {
    const a = new Alert();
    a.title = 'Календарь ателье';
    a.message = 'Войдите тем же логином, что и в программе. Пароль не сохраняется.';
    a.addTextField('Почта', '');
    a.addSecureTextField('Пароль', '');
    a.addAction('Войти');
    a.addCancelAction('Отмена');
    if (await a.present() === -1) return null;
    const res = await wPost(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        { email: a.textFieldValue(0).trim(), password: a.textFieldValue(1), returnSecureToken: true });
    if (!res.refreshToken) {
        const code = (res.error && res.error.message) || '';
        const e = new Alert(); e.title = 'Не получилось войти';
        e.message = /INVALID|PASSWORD|EMAIL/.test(code) ? 'Неверная почта или пароль' : /TOO_MANY/.test(code) ? 'Слишком много попыток, подождите пару минут' : 'Нет связи, попробуйте ещё раз';
        e.addAction('OK'); await e.present();
        return null;
    }
    Keychain.set(KEY, res.refreshToken);
    return res.refreshToken;
}

async function wSession() {
    if (!Keychain.contains(KEY)) return null;
    const res = await wPost(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
        'grant_type=refresh_token&refresh_token=' + encodeURIComponent(Keychain.get(KEY)), true);
    if (!res.id_token) return null;
    if (res.refresh_token) Keychain.set(KEY, res.refresh_token);
    return { token: res.id_token, uid: res.user_id };
}

async function wLoad() {
    const s = await wSession();
    if (!s) return { error: 'login' };
    const get = path => new Request(`${DB}/${path}.json?auth=${s.token}`).loadJSON();
    const user = await get('users/' + s.uid) || {};
    const data = await get('atelier_data') || {};
    if (data.error) return { error: 'Нет доступа к данным' };
    let plan = [];
    try { plan = wParsePlan(await new Request(SITE + 'js/studio-plan.js').loadString()); } catch (e) {}
    const role = user.role || 'helper';
    const today = wDate(new Date());
    return { role, email: user.email || '', ...wBuildToday(data, plan, user.email, role, today), month: wBuildMonth(data, plan, user.email, role, today) };
}

// ---------- Виджет ----------
const C = { bg: new Color('#ffffff'), bgDark: new Color('#1c1c1e'), title: new Color('#1a3c5e'), titleDark: new Color('#8ab4f8'),
    text: Color.dynamic(new Color('#222222'), new Color('#f2f2f7')), muted: Color.dynamic(new Color('#6c757d'), new Color('#a1a1aa')), late: new Color('#dc3545') };

function wWidget(res) {
    const w = new ListWidget();
    w.backgroundColor = Color.dynamic(C.bg, C.bgDark);
    w.url = SITE + 'index.html?widget=1';
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    w.setPadding(12, 14, 12, 14);
    const family = config.widgetFamily || 'large';
    const now = new Date();
    const head = w.addText(`📅 Сегодня, ${now.getDate()} ${['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][now.getMonth()]}`);
    head.font = Font.boldSystemFont(family === 'small' ? 13 : 15);
    head.textColor = Color.dynamic(C.title, C.titleDark);
    w.addSpacer(6);

    if (res.error) {
        const t = w.addText(res.error === 'login' ? 'Откройте Scriptable и запустите «Календарь ателье», чтобы войти' : res.error);
        t.font = Font.systemFont(12); t.textColor = C.muted;
        return w;
    }
    if (family === 'small') {
        const c = res.counts;
        [['🔴 просрочено', c.late], ['🏁 сдать', c.due], ['📥 приём', c.start], ['📌 задач', c.tasks], ['💳 платежей', c.pay]]
            .filter(([, n]) => n > 0).slice(0, 4).forEach(([label, n]) => {
                const t = w.addText(`${label}: ${n}`); t.font = Font.mediumSystemFont(13); t.textColor = label.startsWith('🔴') ? C.late : C.text;
            });
        if (!res.rows.length) { const t = w.addText('Дел нет 👍'); t.font = Font.systemFont(13); t.textColor = C.muted; }
        w.addSpacer();
        return w;
    }
    // Большой виджет: месяц сеткой (день нажимается — открывается календарь на этом дне) и дела сегодня
    if ((family === 'large' || family === 'extraLarge') && res.month) {
        wMonthGrid(w, res.month);
        w.addSpacer(6);
    }
    const max = family === 'medium' ? 4 : res.month && family !== 'small' && family !== 'medium' ? 4 : 11;
    if (!res.rows.length) { const t = w.addText('На сегодня дел нет 👍'); t.font = Font.systemFont(14); t.textColor = C.muted; }
    res.rows.slice(0, max).forEach(r => {
        const t = w.addText(`${r.icon} ${r.text}`);
        t.font = Font.systemFont(family === 'medium' ? 13 : 14);
        t.textColor = r.late ? C.late : C.text;
        t.lineLimit = 1;
        w.addSpacer(3);
    });
    if (res.rows.length > max) { const t = w.addText(`и ещё ${res.rows.length - max}…`); t.font = Font.systemFont(12); t.textColor = C.muted; }
    w.addSpacer();
    return w;
}

function wMonthGrid(w, month) {
    const t = w.addText(month.title);
    t.font = Font.semiboldSystemFont(12); t.textColor = C.muted;
    w.addSpacer(2);
    const head = w.addStack();
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(n => {
        const c = head.addStack(); c.size = new Size(40, 14); c.centerAlignContent();
        const x = c.addText(n); x.font = Font.systemFont(9); x.textColor = C.muted;
    });
    for (let r = 0; r < month.days.length / 7; r++) {
        const row = w.addStack();
        month.days.slice(r * 7, r * 7 + 7).forEach(d => {
            const c = row.addStack(); c.size = new Size(40, 24); c.layoutVertically(); c.centerAlignContent();
            c.url = SITE + 'index.html?widget=1&date=' + d.ds;
            if (d.today) { c.backgroundColor = new Color('#185FA5'); c.cornerRadius = 8; }
            else if (d.vacation) { c.backgroundColor = new Color('#20c997', 0.2); c.cornerRadius = 8; }
            const line = c.addStack(); line.addSpacer();
            const n = line.addText(String(d.day));
            n.font = d.today ? Font.boldSystemFont(12) : Font.systemFont(12);
            n.textColor = d.today ? Color.white() : d.inMonth ? C.text : C.muted;
            line.addSpacer();
            const dots = c.addStack(); dots.addSpacer();
            const mark = d.count ? (d.due ? '🏁' : d.prebook ? '📞' : '•') : ' ';
            const m = dots.addText(mark); m.font = Font.systemFont(7); m.textColor = d.today ? Color.white() : C.title;
            dots.addSpacer();
        });
    }
}

async function main() {
    if (config.runsInApp) {
        if (!Keychain.contains(KEY)) { if (!await wLogin()) return; }
        const menu = new Alert();
        menu.title = 'Календарь ателье';
        menu.message = 'Добавьте виджет на экран: удерживайте пустое место → «+» → Scriptable → выберите этот скрипт.';
        menu.addAction('Показать виджет');
        menu.addAction('Выйти (сменить пользователя)');
        menu.addCancelAction('Закрыть');
        const choice = await menu.present();
        if (choice === 1) { Keychain.remove(KEY); return; }
        if (choice !== 0) return;
        const w = wWidget(await wLoad());
        await w.presentLarge();
        return;
    }
    Script.setWidget(wWidget(await wLoad().catch(e => ({ error: 'Нет связи: ' + e.message }))));
}

await main();
Script.complete();
