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
        const click = clickable ? ` onclick="attOpenDay('${escAttr(email)}', '${date}')"` : '';
        cells += `<div class="att-cell att-${state || 'none'}${date === today ? ' today' : ''}${clickable ? ' clickable' : ''}"${click}${title}>
            <div class="att-day">${d}${rec && rec.comment ? ' 💬' : ''}</div><div class="att-text">${text}</div></div>`;
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
        </div>`;
}

function renderAttendance() {
    if (!window.currentUserData) return;
    if (!attMonth) attMonth = attToday().slice(0, 7);

    if (!attIsAdmin()) {
        const container = document.getElementById('helperAttendanceContainer');
        if (!container) return;
        const email = window.currentUserData.email;
        container.innerHTML = attTodayCard(email) + attCalendarHTML(email, attMonth, false);
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
        ${attCalendarHTML(attAdminEmail, attMonth, true)}`;
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
