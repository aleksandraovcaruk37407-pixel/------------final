/* ==========================================================================
   ПОСЕЩАЕМОСТЬ ПОМОЩНИКОВ: отметки «Пришёл / Ушёл», календарь месяца, график работы.

   Данные (объявлены в app.js, синхронизируются через облако):
     attendance      — одна запись на помощника и день:
                       { id: 'att-<email>-<ГГГГ-ММ-ДД>', email, date, status, in, out, comment, by, updatedAt }
                       status: present | late | absent | dayoff | sick
     helperSchedules — график помощника: { id: 'sch-<email>', email, days: [1..5], start, end, grace }
                       days — дни недели (0 — воскресенье), grace — сколько минут опоздания прощается,
                       from — с какого дня действует (раньше пропуски не считаются)

   Помощник отмечает приход и уход у себя, админ видит календарь и может исправить любой день.
   На деньги посещаемость не влияет — только учёт.
   ========================================================================== */

const ATT_STATUSES = {
    present: { label: 'Был',          icon: '✅' },
    late:    { label: 'Опоздал',      icon: '⏰' },
    absent:  { label: 'Не был',       icon: '❌' },
    dayoff:  { label: 'Отгул',        icon: '🏖️' },
    sick:    { label: 'Больничный',   icon: '🤒' }
};
const ATT_WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const ATT_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// ---------- Расчёты (без DOM — проверяются в отладка/тесты) ----------

function attToMin(time) {
    const m = /^(\d{1,2}):(\d{2})/.exec(time || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function attRecordId(email, date) {
    return 'att-' + email + '-' + date;
}

function attScheduleOf(email, schedules) {
    return (schedules || []).find(s => s && s.email === email) || null;
}

// Рабочий ли день по графику (без графика — нет плановых дней; до даты начала графика from — тоже)
function attIsPlanned(schedule, date) {
    if (!schedule || !Array.isArray(schedule.days)) return false;
    if (schedule.from && date < schedule.from) return false;
    return schedule.days.map(Number).includes(new Date(date + 'T12:00:00').getDay());
}

// Пришёл в time: опоздание по графику (с учётом прощаемых минут)
function attLateMinutes(schedule, time) {
    const start = attToMin(schedule && schedule.start), t = attToMin(time);
    if (start === null || t === null) return 0;
    const late = t - start;
    return late > (parseInt(schedule.grace) || 0) ? late : 0;
}

// Отработано минут: от прихода до ухода (уход за полночь не учитываем)
function attWorkedMinutes(rec) {
    if (!rec || (rec.status !== 'present' && rec.status !== 'late')) return 0;
    const a = attToMin(rec.in), b = attToMin(rec.out);
    return a !== null && b !== null && b > a ? b - a : 0;
}

// Состояние дня для календаря:
//   статус записи; 'open' — пришёл сегодня и ещё не ушёл;
//   'missed' — рабочий день по графику прошёл без отметки; 'planned' — рабочий день впереди; '' — ничего
function attDayState(email, date, records, schedules, today) {
    const rec = (records || []).find(r => r && r.id === attRecordId(email, date));
    if (rec) {
        if ((rec.status === 'present' || rec.status === 'late') && rec.in && !rec.out && date === today) return { rec, state: 'open' };
        return { rec, state: rec.status || 'present' };
    }
    const planned = attIsPlanned(attScheduleOf(email, schedules), date);
    if (!planned) return { rec: null, state: '' };
    return { rec: null, state: date < today ? 'missed' : 'planned' };
}

function attDaysInMonth(mk) {
    const [y, m] = mk.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

// Итоги месяца mk ('ГГГГ-ММ') — только по прошедшим дням и сегодняшнему
function attMonthSummary(email, mk, records, schedules, today) {
    const sum = { worked: 0, minutes: 0, late: 0, absent: 0, missed: 0, dayoff: 0, sick: 0, planned: 0 };
    for (let d = 1; d <= attDaysInMonth(mk); d++) {
        const date = mk + '-' + String(d).padStart(2, '0');
        if (date > today) break;
        const { rec, state } = attDayState(email, date, records, schedules, today);
        if (attIsPlanned(attScheduleOf(email, schedules), date)) sum.planned++;
        if (state === 'present' || state === 'late' || state === 'open') { sum.worked++; sum.minutes += attWorkedMinutes(rec); }
        if (rec && rec.status === 'late') sum.late++;
        if (state === 'absent') sum.absent++;
        if (state === 'missed') sum.missed++;
        if (state === 'dayoff') sum.dayoff++;
        if (state === 'sick') sum.sick++;
    }
    return sum;
}

function attFormatMinutes(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h} ч${m ? ' ' + m + ' мин' : ''}` : `${m} мин`;
}

function attShiftMonth(mk, delta) {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// ---------- Экран ----------

let attMonth = null;          // показываемый месяц 'ГГГГ-ММ'
let attAdminEmail = '';       // помощник, выбранный админом
let attEditing = null;        // { email, date } в окне дня
let attSelDate = null;        // день, выбранный помощником (дела под календарём)

function attToday() { return finTodayStr(); }
function attNowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function attIsAdmin() { return !!(window.currentUserData && window.currentUserData.role === 'admin'); }
function attFindRecord(email, date) { return attendance.find(r => r.id === attRecordId(email, date)); }

function attSaveRecord(email, date, fields) {
    let rec = attFindRecord(email, date);
    if (!rec) { rec = { id: attRecordId(email, date), email, date }; attendance.push(rec); }
    Object.assign(rec, fields, { by: window.currentUserData ? window.currentUserData.email : null, updatedAt: new Date().toISOString() });
    Object.keys(rec).forEach(k => { if (rec[k] === '' || rec[k] === null || rec[k] === undefined) delete rec[k]; });
    return rec;
}

// Помощник: «Пришёл»
function attCheckIn() {
    const email = window.currentUserData.email, today = attToday(), time = attNowTime();
    const late = attLateMinutes(attScheduleOf(email, helperSchedules), time);
    attSaveRecord(email, today, { status: late ? 'late' : 'present', in: time });
    // Админу — о каждом приходе, с опозданием или без
    if (typeof addNotice === 'function') {
        const who = window.currentUserData.displayName || email;
        addNotice('admin', 'attendance', late
            ? `⏰ ${who} пришёл в ${time} — опоздание ${attFormatMinutes(late)}`
            : `▶️ ${who} пришёл в ${time}`, null);
    }
    saveAll();
    renderAttendance();
    showToast(late ? `Приход отмечен: ${time} (опоздание ${attFormatMinutes(late)})` : `Приход отмечен: ${time}`);
}

// Помощник: «Ушёл»
function attCheckOut() {
    const email = window.currentUserData.email, today = attToday(), time = attNowTime();
    const rec = attFindRecord(email, today);
    if (!rec || !rec.in) return;
    attSaveRecord(email, today, { out: time });
    if (typeof addNotice === 'function') {
        addNotice('admin', 'attendance', `🏁 ${window.currentUserData.displayName || email} ушёл в ${time}, отработано ${attFormatMinutes(attWorkedMinutes(rec))}`, null);
    }
    saveAll();
    renderAttendance();
    showToast(`Уход отмечен: ${time}. Отработано ${attFormatMinutes(attWorkedMinutes(rec))}`);
}

function attSetMonth(delta) {
    attMonth = attShiftMonth(attMonth || attToday().slice(0, 7), delta);
    renderAttendance();
}

function attSelectDay(date) {
    attSelDate = date;
    renderAttendance();
}

// Дела помощника под календарём: на выбранный день, а если их нет — ближайшие
function attTasksHTML(email) {
    if (typeof stTasksOf !== 'function' || (typeof stEnabled === 'function' && !stEnabled())) return '';
    const today = attToday(), date = attSelDate || today;
    const human = typeof formatDateHuman === 'function' ? formatDateHuman(new Date(date + 'T12:00:00')) : date;
    const day = stTasksForDate(email, date, false);
    const late = stOpenTasksUntil(email, today, false).filter(t => t.date < today);
    let html = `<div class="st-day"><div class="st-day-head">📌 Дела на ${human}${date === today ? ' (сегодня)' : ''}</div>`;
    html += day.length ? day.map(t => stTaskRowHTML(t, { today })).join('') : '<div class="st-empty">На этот день дел нет</div>';
    html += '</div>';
    if (late.length) html += `<div class="st-day"><div class="st-day-head">🔴 Не сделано в прошлые дни</div>${late.map(t => stTaskRowHTML(t, { today, showDate: true })).join('')}</div>`;
    if (!day.length) {
        const next = stTasksOf(email, false).filter(t => t.date > date && stStatus(t) !== 'done').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
        if (next.length) html += `<div class="st-day"><div class="st-day-head">⏭ Ближайшие дела</div>${next.map(t => stTaskRowHTML(t, { today, showDate: true })).join('')}</div>`;
    }
    return html;
}

// Админу: дела помощника в показанном месяце
function attAdminTasksHTML(email, mk) {
    if (typeof stTasksOf !== 'function' || (typeof stEnabled === 'function' && !stEnabled())) return '';
    const list = stTasksOf(email, false).filter(t => t.date.slice(0, 7) === mk).sort((a, b) => a.date.localeCompare(b.date));
    const add = `<button class="st-toggle st-add" onclick="stOpenTaskModal('')">➕ Задача помощнику</button>`;
    if (!list.length) return `<div class="st-tools">${add}</div>`;
    const done = list.filter(t => stStatus(t) === 'done').length;
    return `<div class="st-tools">${add}</div><div class="st-day"><div class="st-day-head">📌 Дела помощника в этом месяце <span class="st-count">${done} из ${list.length} готово</span></div>
        ${list.map(t => stTaskRowHTML(t, { today: attToday(), showDate: true })).join('')}</div>`;
}

function attSelectHelper(email) {
    attAdminEmail = email;
    renderAttendance();
}

// Карточка «Сегодня» для помощника
function attTodayCard(email) {
    const today = attToday();
    const schedule = attScheduleOf(email, helperSchedules);
    const { rec, state } = attDayState(email, today, attendance, helperSchedules, today);
    const plan = schedule
        ? `График: ${schedule.days.map(d => ATT_WEEKDAYS[d]).join(', ')}, ${safeHTML(schedule.start || '')}–${safeHTML(schedule.end || '')}`
        : 'График не задан';
    let body;
    if (!rec) {
        body = `<div class="att-today-text">${attIsPlanned(schedule, today) ? 'Сегодня рабочий день — вы ещё не отметились' : 'Вы ещё не отметились сегодня'}</div>
            <button class="btn-add att-big-btn" onclick="attCheckIn()">▶️ Пришёл</button>`;
    } else if (state === 'open') {
        body = `<div class="att-today-text">Пришли в <b>${safeHTML(rec.in)}</b>${rec.status === 'late' ? ' (опоздание)' : ''}</div>
            <button class="btn-del att-big-btn" onclick="attCheckOut()">⏹ Ушёл</button>`;
    } else if (rec.status === 'present' || rec.status === 'late') {
        body = `<div class="att-today-text">Сегодня: <b>${safeHTML(rec.in || '?')}–${safeHTML(rec.out || '?')}</b>${attWorkedMinutes(rec) ? ', отработано ' + attFormatMinutes(attWorkedMinutes(rec)) : ''}</div>`;
    } else {
        body = `<div class="att-today-text">Сегодня: ${ATT_STATUSES[rec.status].icon} ${ATT_STATUSES[rec.status].label}</div>`;
    }
    return `<div class="att-today"><div class="att-plan">${plan}</div>${body}</div>`;
}

function attCalendarHTML(email, mk, clickable) {
    const today = attToday();
    const first = new Date(mk + '-01T12:00:00').getDay();
    const offset = (first + 6) % 7; // неделя с понедельника
    let cells = '';
    for (let i = 0; i < offset; i++) cells += '<div class="att-cell empty"></div>';
    for (let d = 1; d <= attDaysInMonth(mk); d++) {
        const date = mk + '-' + String(d).padStart(2, '0');
        const { rec, state } = attDayState(email, date, attendance, helperSchedules, today);
        let text = '';
        if (rec && (rec.status === 'present' || rec.status === 'late')) text = `${safeHTML(rec.in || '?')}${rec.out ? '–' + safeHTML(rec.out) : ''}`;
        else if (rec && ATT_STATUSES[rec.status]) text = ATT_STATUSES[rec.status].icon + ' ' + ATT_STATUSES[rec.status].label;
        else if (state === 'missed') text = 'нет отметки';
        const title = rec && rec.comment ? ` title="${escAttr(rec.comment)}"` : '';
        // Админ открывает окно отметки; помощник выбирает день, чтобы увидеть дела под календарём
        const click = clickable ? ` onclick="attOpenDay('${escAttr(email)}', '${date}')"` : ` onclick="attSelectDay('${date}')"`;
        // Дела на день из плана студии (js/studio-tasks.js)
        const dayTasks = typeof stTasksForDate === 'function' ? stTasksForDate(email, date, false) : [];
        const openTasks = dayTasks.filter(t => stStatus(t) !== 'done').length;
        const tasksMark = dayTasks.length ? `<div class="att-tasks">${openTasks ? '📌 ' + openTasks : '✅'}</div>` : '';
        const selected = !clickable && date === (attSelDate || today);
        cells += `<div class="att-cell att-${state || 'none'}${date === today ? ' today' : ''}${selected ? ' att-selected' : ''} clickable"${click}${title}>
            <div class="att-day">${d}${rec && rec.comment ? ' 💬' : ''}</div><div class="att-text">${text}</div>${tasksMark}</div>`;
    }
    const [y, m] = mk.split('-').map(Number);
    const s = attMonthSummary(email, mk, attendance, helperSchedules, today);
    return `
        <div class="att-month-nav">
            <button class="btn-extra" onclick="attSetMonth(-1)">‹</button>
            <b>${ATT_MONTHS[m - 1]} ${y}</b>
            <button class="btn-extra" onclick="attSetMonth(1)">›</button>
        </div>
        <div class="att-summary">
            <span>✅ Дней: <b>${s.worked}</b>${s.planned ? ' из ' + s.planned : ''}</span>
            <span>🕐 Часов: <b>${attFormatMinutes(s.minutes)}</b></span>
            <span>⏰ Опозданий: <b>${s.late}</b></span>
            <span>❌ Не был: <b>${s.absent + s.missed}</b></span>
            ${s.dayoff ? `<span>🏖️ Отгулов: <b>${s.dayoff}</b></span>` : ''}
            ${s.sick ? `<span>🤒 Больничных: <b>${s.sick}</b></span>` : ''}
        </div>
        <div class="att-grid">
            ${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(w => `<div class="att-weekday">${w}</div>`).join('')}
            ${cells}
        </div>
        <div class="att-legend">
            <span class="att-present">Был</span><span class="att-late">Опоздал</span><span class="att-missed">Не было отметки</span>
            <span class="att-dayoff">Отгул / больничный</span><span class="att-planned">Рабочий день впереди</span>
            <span>📌 дела на день</span>
        </div>`;
}

function renderAttendance() {
    if (!window.currentUserData) return;
    if (!attMonth) attMonth = attToday().slice(0, 7);

    if (!attIsAdmin()) {
        const container = document.getElementById('helperAttendanceContainer');
        if (!container) return;
        const email = window.currentUserData.email;
        container.innerHTML = attTodayCard(email) + attCalendarHTML(email, attMonth, false) + attTasksHTML(email);
        return;
    }

    const container = document.getElementById('adminAttendanceContainer');
    if (!container) return;
    const select = document.getElementById('attHelperSelect');
    if (select && !select.dataset.loaded) {
        select.dataset.loaded = '1';
        loadHelpersForSelect(select, true).then(() => {
            if (!attAdminEmail && select.options.length > 1) attAdminEmail = select.options[1].value;
            select.value = attAdminEmail;
            renderAttendance();
        });
    }
    if (!attAdminEmail) {
        container.innerHTML = '<div style="color:#888;padding:10px;">Выберите помощника</div>';
        return;
    }
    const schedule = attScheduleOf(attAdminEmail, helperSchedules);
    container.innerHTML = `
        <div class="att-plan">
            ${schedule ? `График: ${schedule.days.map(d => ATT_WEEKDAYS[d]).join(', ')}, ${safeHTML(schedule.start || '')}–${safeHTML(schedule.end || '')}` : 'График не задан — пропуски не считаются'}
            <button class="btn-extra" onclick="attOpenSchedule()" style="padding:4px 10px;font-size:12px;margin-left:8px;">🗓 График</button>
        </div>
        <div style="font-size:12px;color:#888;margin-bottom:6px;">Нажмите на день, чтобы исправить отметку</div>
        ${attCalendarHTML(attAdminEmail, attMonth, true)}
        ${attAdminTasksHTML(attAdminEmail, attMonth)}`;
}

// ---------- Окно дня (админ) ----------

function attOpenDay(email, date) {
    attEditing = { email, date };
    const rec = attFindRecord(email, date) || {};
    const schedule = attScheduleOf(email, helperSchedules);
    document.getElementById('attDayTitle').textContent = `${finHelperName(email)} — ${formatDateDDMMYYYY(date)}`;
    document.getElementById('attDayStatus').value = rec.status || 'present';
    document.getElementById('attDayIn').value = rec.in || (schedule && schedule.start) || '';
    document.getElementById('attDayOut').value = rec.out || (schedule && schedule.end) || '';
    document.getElementById('attDayComment').value = rec.comment || '';
    document.getElementById('attDayBy').textContent = rec.by ? `Отметил: ${rec.by}${rec.updatedAt ? ', ' + new Date(rec.updatedAt).toLocaleString('ru-RU') : ''}` : 'Отметки нет';
    document.getElementById('attDayDelete').style.display = rec.id ? '' : 'none';
    attToggleTimes();
    document.getElementById('attDayModal').classList.add('active');
}

function attToggleTimes() {
    const st = document.getElementById('attDayStatus').value;
    document.getElementById('attDayTimes').style.display = st === 'present' || st === 'late' ? '' : 'none';
}

function attCloseDay() {
    document.getElementById('attDayModal').classList.remove('active');
    attEditing = null;
}

function attSaveDay() {
    if (!attEditing) return;
    const status = document.getElementById('attDayStatus').value;
    const withTime = status === 'present' || status === 'late';
    const tIn = withTime ? document.getElementById('attDayIn').value : '';
    const tOut = withTime ? document.getElementById('attDayOut').value : '';
    if (withTime && tIn && tOut && attToMin(tOut) <= attToMin(tIn)) { alert('Уход должен быть позже прихода'); return; }
    attSaveRecord(attEditing.email, attEditing.date, { status, in: tIn, out: tOut, comment: document.getElementById('attDayComment').value.trim() });
    saveAll();
    attCloseDay();
    renderAttendance();
}

function attDeleteDay() {
    if (!attEditing || !confirm('Удалить отметку за этот день?')) return;
    const id = attRecordId(attEditing.email, attEditing.date);
    attendance = attendance.filter(r => r.id !== id);
    saveAll();
    attCloseDay();
    renderAttendance();
}

// ---------- Окно графика (админ) ----------

function attOpenSchedule() {
    if (!attAdminEmail) return;
    const s = attScheduleOf(attAdminEmail, helperSchedules) || { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', grace: 10 };
    document.getElementById('attScheduleTitle').textContent = 'График: ' + finHelperName(attAdminEmail);
    document.getElementById('attScheduleDays').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d =>
        `<label class="att-daycheck"><input type="checkbox" value="${d}" ${s.days.map(Number).includes(d) ? 'checked' : ''}> ${ATT_WEEKDAYS[d]}</label>`).join('');
    document.getElementById('attScheduleStart').value = s.start || '';
    document.getElementById('attScheduleEnd').value = s.end || '';
    document.getElementById('attScheduleGrace').value = s.grace != null ? s.grace : 10;
    document.getElementById('attScheduleModal').classList.add('active');
}

function attCloseSchedule() {
    document.getElementById('attScheduleModal').classList.remove('active');
}

function attSaveSchedule() {
    const days = [...document.querySelectorAll('#attScheduleDays input:checked')].map(i => Number(i.value));
    const start = document.getElementById('attScheduleStart').value;
    const end = document.getElementById('attScheduleEnd').value;
    if (!days.length || !start) { alert('Выберите рабочие дни и время начала'); return; }
    const id = 'sch-' + attAdminEmail;
    const old = attScheduleOf(attAdminEmail, helperSchedules);
    helperSchedules = helperSchedules.filter(s => s.id !== id);
    helperSchedules.push({ id, email: attAdminEmail, days, start, end, grace: parseInt(document.getElementById('attScheduleGrace').value) || 0, from: (old && old.from) || attToday() });
    saveAll();
    attCloseSchedule();
    renderAttendance();
}

// ==========================================================================
// ОТМЕТКА ПОСЕЩЕНИЯ ИЗ КАЛЕНДАРЯ АДМИНА И ТАБЕЛЬ МЕСЯЦА
// В «Списке по дням» и в расписании дня (сетка месяца) у админа — строка на каждого помощника:
// «✅ Был» (время по графику), «❌ Не был», «✏️» (окно дня с точным временем).
// Табель — таблица дни × помощники (как форма Т-13: код дня и часы), скачивается файлом Excel.
// Коды: Я — явка, НН — неявка (не был / нет отметки), ДО — отгул, Б — больничный, В — выходной.
// ==========================================================================

let attHelpersCache = null; // [{ email, name }] — помощники из /users (загружаются один раз)

function attHelpers() {
    const map = new Map();
    (attHelpersCache || []).forEach(h => map.set(h.email, h.name));
    (helperSchedules || []).forEach(s => { if (s && s.email && !map.has(s.email)) map.set(s.email, ''); });
    (attendance || []).forEach(r => { if (r && r.email && !map.has(r.email)) map.set(r.email, ''); });
    if (!attHelpersCache && typeof loadHelpersForSelect === 'function') {
        attHelpersCache = [];
        loadHelpersForSelect(document.createElement('select'), false).then(list => {
            attHelpersCache = (list || []).filter(h => h && h.email).map(h => ({ email: h.email, name: h.displayName || '' }));
            if (typeof renderCalendar === 'function') renderCalendar();
        }).catch(() => {});
    }
    return [...map.entries()].map(([email, name]) => ({ email, name: name && name !== email ? name : finHelperName(email) }));
}

function attPlannedMinutes(schedule) {
    const a = attToMin(schedule && schedule.start), b = attToMin(schedule && schedule.end);
    return a !== null && b !== null && b > a ? b - a : 0;
}

// Быстрая отметка админом: present — время по графику (если графика нет — спрашиваем часы)
function attQuickMark(email, date, status) {
    if (status === 'present') {
        const s = attScheduleOf(email, helperSchedules);
        let tIn = s && s.start, tOut = s && s.end;
        if (!tIn || !tOut) {
            const v = prompt(`Во сколько ${finHelperName(email)} был на работе? Например: 10:00-19:00`, '10:00-19:00');
            if (v === null) return;
            const m = /(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/.exec(v);
            if (!m) { alert('Напишите время так: 10:00-19:00'); return; }
            tIn = m[1].padStart(5, '0'); tOut = m[2].padStart(5, '0');
        }
        attSaveRecord(email, date, { status: 'present', in: tIn, out: tOut });
    } else {
        attSaveRecord(email, date, { status, in: '', out: '' });
    }
    saveAll();
    if (typeof renderAll === 'function') renderAll(); else renderAttendance();
    showToast(`${finHelperName(email)}: ${ATT_STATUSES[status].icon} ${ATT_STATUSES[status].label} — ${formatDateDDMMYYYY(date)}`);
}

// Помощники, о которых стоит спросить в этот день: рабочий день по графику, есть отметка или это сегодня.
// Будущие дни — только если уже что-то отмечено (например, отгул заранее)
function attDayItems(date) {
    if (!attIsAdmin()) return [];
    const today = attToday();
    return attHelpers().map(h => {
        const { rec, state } = attDayState(h.email, date, attendance, helperSchedules, today);
        return { ...h, rec, state };
    }).filter(x => x.rec || x.state === 'missed' || date === today);
}

function attDayItemText(x) {
    if (x.rec && (x.rec.status === 'present' || x.rec.status === 'late'))
        return `${ATT_STATUSES[x.rec.status].icon} ${safeHTML(x.rec.in || '?')}–${safeHTML(x.rec.out || '…')}${attWorkedMinutes(x.rec) ? ' · ' + attFormatMinutes(attWorkedMinutes(x.rec)) : ''}`;
    if (x.rec && ATT_STATUSES[x.rec.status]) return `${ATT_STATUSES[x.rec.status].icon} ${ATT_STATUSES[x.rec.status].label}`;
    const s = attScheduleOf(x.email, helperSchedules);
    return `<span class="ag-att-none">не отмечен</span>${s && s.start ? ` · ${safeHTML(s.start)}–${safeHTML(s.end || '')}` : ''}`;
}

// Строка посещения одного помощника (для «Списка по дням» и расписания дня).
// У каждого помощника своя строка: слева его имя — кнопки ставят отметку именно ему
function attDayRowHTML(x, date, showDate) {
    const e = escAttr(x.email);
    const marked = !!x.rec;
    const btns = marked
        ? `<button class="ag-btn" title="Изменить отметку" onclick="event.stopPropagation(); attOpenDay('${e}', '${date}')">✏️</button>`
        : `<button class="ag-btn ag-ok" title="Был на работе (время по графику)" onclick="event.stopPropagation(); attQuickMark('${e}', '${date}', 'present')">✅ Был</button>` +
          `<button class="ag-btn" title="Не был" onclick="event.stopPropagation(); attQuickMark('${e}', '${date}', 'absent')">❌</button>` +
          `<button class="ag-btn" title="Точное время, опоздание, отгул, больничный" onclick="event.stopPropagation(); attOpenDay('${e}', '${date}')">✏️</button>`;
    return `<div class="ag-row ag-att${marked ? ' ag-att-done' : ''}">
        <span class="ag-tag">👷 ${safeHTML(x.name)}</span>
        <span class="ag-text">${showDate ? formatDateDDMMYYYY(date) + ': ' : ''}${attDayItemText(x)}</span>
        <span class="ag-actions">${btns}</span>
    </div>`;
}

// Пропущенные отметки за последние 7 дней (для блока «Просрочено»)
function attMissedRows(today) {
    if (!attIsAdmin()) return [];
    const rows = [];
    for (let i = 7; i >= 1; i--) {
        const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        attDayItems(ds).filter(x => x.state === 'missed').forEach(x => rows.push(attDayRowHTML(x, ds, true)));
    }
    return rows;
}

// ---------- Табель месяца ----------
let attTabelMonth = null;

function attTabelCode(email, date, today) {
    if (date > today) return { code: '', minutes: 0 };
    const { rec, state } = attDayState(email, date, attendance, helperSchedules, today);
    if (rec && (rec.status === 'present' || rec.status === 'late')) return { code: 'Я', minutes: attWorkedMinutes(rec), late: rec.status === 'late' };
    if (rec && rec.status === 'absent') return { code: 'НН', minutes: 0 };
    if (rec && rec.status === 'dayoff') return { code: 'ДО', minutes: 0 };
    if (rec && rec.status === 'sick') return { code: 'Б', minutes: 0 };
    if (state === 'missed') return { code: 'НН', minutes: 0, missed: true };
    return { code: 'В', minutes: 0 };
}

// Итоги табеля по помощнику за месяц: явки, часы, по графику, недоработано, неявки и т. д.
function attTabelTotals(email, mk, today) {
    const s = attScheduleOf(email, helperSchedules);
    const t = { days: 0, minutes: 0, plannedDays: 0, plannedMinutes: 0, nn: 0, dayoff: 0, sick: 0, late: 0 };
    for (let d = 1; d <= attDaysInMonth(mk); d++) {
        const date = mk + '-' + String(d).padStart(2, '0');
        if (date > today) break;
        const c = attTabelCode(email, date, today);
        if (attIsPlanned(s, date)) { t.plannedDays++; t.plannedMinutes += attPlannedMinutes(s); }
        if (c.code === 'Я') { t.days++; t.minutes += c.minutes; if (c.late) t.late++; }
        if (c.code === 'НН') t.nn++;
        if (c.code === 'ДО') t.dayoff++;
        if (c.code === 'Б') t.sick++;
    }
    t.shortMinutes = Math.max(0, t.plannedMinutes - t.minutes);
    return t;
}

function attHours(min) { return Math.round(min / 6) / 10; } // часы с одним знаком: 7.5

function attOpenTabel(mk) {
    attTabelMonth = mk || attTabelMonth || attToday().slice(0, 7);
    let box = document.getElementById('attTabelModal');
    if (!box) {
        box = document.createElement('div');
        box.id = 'attTabelModal';
        box.className = 'modal-overlay';
        box.addEventListener('click', e => { if (e.target === box) attCloseTabel(); });
        document.body.appendChild(box);
    }
    const today = attToday(), m = attTabelMonth, n = attDaysInMonth(m);
    const [y, mm] = m.split('-').map(Number);
    const helpers = attHelpers();
    let head = '<tr><th class="att-tb-name">Помощник</th>';
    for (let d = 1; d <= n; d++) {
        const wd = new Date(y, mm - 1, d).getDay();
        head += `<th class="${wd === 0 || wd === 6 ? 'att-tb-we' : ''}">${d}<br><small>${ATT_WEEKDAYS[wd]}</small></th>`;
    }
    head += '<th>Дней</th><th>Часов</th><th>По графику</th><th>Не был</th></tr>';
    const body = helpers.map(h => {
        let row = `<tr><td class="att-tb-name">${safeHTML(h.name)}</td>`;
        for (let d = 1; d <= n; d++) {
            const date = m + '-' + String(d).padStart(2, '0');
            const c = attTabelCode(h.email, date, today);
            row += `<td class="att-tb-cell att-tb-${c.code || 'none'}" onclick="attOpenDay('${escAttr(h.email)}', '${date}')" title="${formatDateDDMMYYYY(date)}">${c.code}${c.minutes ? `<br><small>${attHours(c.minutes)}</small>` : ''}</td>`;
        }
        const t = attTabelTotals(h.email, m, today);
        return row + `<td><b>${t.days}</b></td><td><b>${attHours(t.minutes)}</b></td><td>${attHours(t.plannedMinutes)}</td><td>${t.nn}${t.shortMinutes ? `<br><small>−${attHours(t.shortMinutes)} ч</small>` : ''}</td></tr>`;
    }).join('');
    box.innerHTML = `<div class="modal att-tabel-modal">
        <h3>📋 Табель посещаемости</h3>
        <div class="att-month-nav">
            <button class="btn-extra" onclick="attOpenTabel(attShiftMonth(attTabelMonth, -1))">‹</button>
            <b>${ATT_MONTHS[mm - 1]} ${y}</b>
            <button class="btn-extra" onclick="attOpenTabel(attShiftMonth(attTabelMonth, 1))">›</button>
        </div>
        ${helpers.length ? `<div class="att-tb-wrap"><table class="att-tb">${head}${body}</table></div>` : '<div class="fin-muted">Помощников пока нет</div>'}
        <div class="fin-muted">Я — был (снизу часы), НН — не был или нет отметки, ДО — отгул, Б — больничный, В — выходной. Нажмите на клетку, чтобы исправить.</div>
        <div class="form-actions">
            <button class="btn-cancel" onclick="attCloseTabel()">Закрыть</button>
            <button class="btn-save" onclick="attDownloadTabel(attTabelMonth)">⬇️ Скачать (Excel)</button>
        </div>
    </div>`;
    box.classList.add('active');
    document.body.classList.add('modal-open');
}

function attCloseTabel() {
    const box = document.getElementById('attTabelModal');
    if (box) box.classList.remove('active');
    document.body.classList.remove('modal-open');
}

// Окно дня, открытое из табеля или календаря, после сохранения обновляет и их
const _attSaveDayOrig = attSaveDay, _attDeleteDayOrig = attDeleteDay;
attSaveDay = function () { _attSaveDayOrig(); attAfterDayChange(); };
attDeleteDay = function () { _attDeleteDayOrig(); attAfterDayChange(); };
function attAfterDayChange() {
    const box = document.getElementById('attTabelModal');
    if (box && box.classList.contains('active')) attOpenTabel(attTabelMonth);
    if (typeof renderCalendar === 'function') renderCalendar();
}

// Строки табеля для файла (без DOM — проверяется в тестах). Возвращает { tabel, days, legend } — массивы строк
function attTabelRows(helpers, mk, today) {
    const n = attDaysInMonth(mk);
    const [y, m] = mk.split('-').map(Number);
    const last = mk + '-' + String(n).padStart(2, '0');
    const dd = s => s.split('-').reverse().join('.');
    const tabel = [
        ['ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ ПОМОЩНИКОВ'],
        [`Период: ${dd(mk + '-01')} – ${dd(last)} (${ATT_MONTHS[m - 1].toLowerCase()} ${y}). Составлен ${dd(today)}${today < last ? ' — дни после этой даты не заполнены' : ''}`],
        [],
        ['№', 'Помощник', 'Строка', ...Array.from({ length: n }, (_, i) => i + 1), 'Явок, дней', 'Отработано, ч', 'По графику, ч', 'Недоработано, ч', 'Неявки (НН), дней', 'Отгулы (ДО), дней', 'Больничные (Б), дней', 'Опозданий']
    ];
    const days = [['Дата', 'День недели', 'Помощник', 'Отметка', 'Приход', 'Уход', 'Отработано, ч', 'По графику, ч', 'Опоздание, мин', 'Комментарий', 'Кто отметил']];
    helpers.forEach((h, i) => {
        const codes = [], hours = [];
        const s = attScheduleOf(h.email, helperSchedules);
        for (let d = 1; d <= n; d++) {
            const date = mk + '-' + String(d).padStart(2, '0');
            const c = attTabelCode(h.email, date, today);
            codes.push(c.code);
            hours.push(c.minutes ? attHours(c.minutes) : (c.code === 'Я' ? 0 : ''));
            if (date > today) continue;
            const rec = attFindRecord(h.email, date);
            const planned = attIsPlanned(s, date);
            if (!rec && !planned) continue;
            const status = rec && ATT_STATUSES[rec.status] ? ATT_STATUSES[rec.status].label : 'Нет отметки';
            days.push([dd(date), ATT_WEEKDAYS[new Date(date + 'T12:00:00').getDay()], h.name, status,
                (rec && rec.in) || '', (rec && rec.out) || '', rec ? attHours(attWorkedMinutes(rec)) : 0,
                planned ? attHours(attPlannedMinutes(s)) : 0,
                rec && rec.status === 'late' && rec.in ? attLateMinutes(s, rec.in) : '', (rec && rec.comment) || '', (rec && rec.by) || '']);
        }
        const t = attTabelTotals(h.email, mk, today);
        tabel.push([i + 1, h.name, 'код', ...codes, t.days, attHours(t.minutes), attHours(t.plannedMinutes), attHours(t.shortMinutes), t.nn, t.dayoff, t.sick, t.late]);
        tabel.push(['', '', 'часы', ...hours]);
    });
    const legend = [['Код', 'Что значит'], ['Я', 'Был на работе (явка), во второй строке — сколько часов'], ['НН', 'Не был: отмечено «Не был» или в рабочий день по графику нет отметки'],
        ['ДО', 'Отгул (с разрешения)'], ['Б', 'Больничный'], ['В', 'Выходной (не рабочий день по графику)'],
        ['', ''], ['По графику, ч', 'Сколько часов должен был отработать по графику до даты составления'], ['Недоработано, ч', 'По графику минус отработано (если больше нуля)']];
    return { tabel, days, legend };
}

function attLoadXlsx() {
    if (window.XLSX) return Promise.resolve(true);
    return new Promise(resolve => {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        sc.onload = () => resolve(!!window.XLSX);
        sc.onerror = () => resolve(false);
        document.head.appendChild(sc);
    });
}

function attDownloadTabel(mk) {
    const month = mk || attToday().slice(0, 7);
    const data = attTabelRows(attHelpers(), month, attToday());
    const name = `Табель помощников ${month}`;
    attLoadXlsx().then(ok => {
        if (!ok) {
            // Библиотека не загрузилась — простой файл CSV (тоже открывается в Excel)
            const csv = '﻿' + data.tabel.concat([[]], data.days).map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
            a.download = name + '.csv';
            a.click();
            return;
        }
        const X = window.XLSX, wb = X.utils.book_new();
        const n = attDaysInMonth(month);
        const ws = X.utils.aoa_to_sheet(data.tabel);
        ws['!cols'] = [{ wch: 4 }, { wch: 18 }, { wch: 6 }, ...Array.from({ length: n }, () => ({ wch: 4 })), ...Array.from({ length: 8 }, () => ({ wch: 11 }))];
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: n + 10 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: n + 10 } }];
        X.utils.book_append_sheet(wb, ws, 'Табель');
        const ws2 = X.utils.aoa_to_sheet(data.days);
        ws2['!cols'] = [{ wch: 11 }, { wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 7 }, { wch: 7 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 24 }];
        X.utils.book_append_sheet(wb, ws2, 'По дням');
        const ws3 = X.utils.aoa_to_sheet(data.legend);
        ws3['!cols'] = [{ wch: 16 }, { wch: 70 }];
        X.utils.book_append_sheet(wb, ws3, 'Обозначения');
        X.writeFile(wb, name + '.xlsx');
    });
}

window.attQuickMark = attQuickMark;
window.attOpenTabel = attOpenTabel;
window.attCloseTabel = attCloseTabel;
window.attDownloadTabel = attDownloadTabel;
