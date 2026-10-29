/* ==========================================================================
   ЗАДАЧИ СТУДИИ: план на каждый день из экселя «Календарь студии» (js/studio-plan.js).

   План (window.STUDIO_PLAN) не меняется в программе и в облако не отправляется.
   В облаке хранятся только отметки (studioTaskMarks в app.js, синхронизируются):
     { id: <id задачи из плана>, status: todo | work | done, note, by, updatedAt }

   Плюс задачи съёмки по заказам (stOrderTasks) — только у Егора.
   Каждый видит свои задачи: имя из колонки «Кто» → почта входа (STUDIO_PEOPLE).
   Админ может переключиться на «все задачи». Помощник видит свои дела в «Календаре»
   (бывшая «Посещаемость», js/attendance.js).
   ========================================================================== */

const STUDIO_PEOPLE = {
    'Александра': ['aleksandraovcaruk37407@gmail.com', 'admin@test.local'],
    'Егор': ['egor.wtf38@gmail.com'],
    'Дауд': ['daud_yt_play@yandex.ru', 'helper@test.local']
};
const STUDIO_HELPERS = ['Дауд']; // помощники: уведомление идёт на их почту, админам — в общий колокольчик 'admin'
const STUDIO_STATUSES = {
    todo: { label: 'Не начато', icon: '⬜' },
    work: { label: 'В работе', icon: '🔄' },
    done: { label: 'Готово', icon: '✅' }
};

let stShowAll = false; // админ: показывать задачи всех, а не только свои

function stPersonOf(email) {
    const e = String(email || '').toLowerCase();
    return Object.keys(STUDIO_PEOPLE).find(name => STUDIO_PEOPLE[name].includes(e)) || null;
}

function stMyEmail() {
    return window.currentUserData ? window.currentUserData.email : '';
}

// Съёмка машины («Каждый день» в экселе) — только Егору: в день приёма заказа и в день выдачи.
// Для заказов, принятых с 28.10.2026, чтобы старые заказы не повисли просроченными задачами.
const STUDIO_PHOTO_FROM = '2026-10-28';
function stOrderTasks() {
    const list = [];
    (typeof ordersData !== 'undefined' ? ordersData : []).forEach(o => {
        if (!o || o.id == null || !o.date || o.date < STUDIO_PHOTO_FROM) return;
        const car = `№${o.orderNumber || ''} ${o.client || ''}`.trim();
        list.push({ id: 'photo-in-' + o.id, date: o.date, type: 'Съёмка', who: ['Егор'], orderId: o.id,
            text: `📸 Снять машину при приёме (кусочек «до»): ${car}` });
        const due = (parseInt(o.durationDays) || 0) > 0 && typeof getDeadline === 'function' ? getDeadline(o) : '';
        if (due && due !== o.date) list.push({ id: 'photo-out-' + o.id, date: due, type: 'Съёмка', who: ['Егор'], orderId: o.id,
            text: `📸 Снять машину при выдаче (кусочек «после» + 2–3 горизонтальных фото): ${car}` });
    });
    return list;
}

// Задачи, которые админ поставил в программе: лежат в том же studioTaskMarks с custom: true
function stCustomTasks() {
    return (typeof studioTaskMarks !== 'undefined' ? studioTaskMarks : []).filter(m => m && m.custom && m.date && m.text);
}

function stPlan() {
    return (Array.isArray(window.STUDIO_PLAN) ? window.STUDIO_PLAN : []).concat(stOrderTasks(), stCustomTasks());
}

function stMark(id) {
    return (typeof studioTaskMarks !== 'undefined' ? studioTaskMarks : []).find(m => m && m.id === id) || null;
}

function stStatus(task) {
    const m = stMark(task.id);
    return m && STUDIO_STATUSES[m.status] ? m.status : 'todo';
}

function stNote(task) {
    const m = stMark(task.id);
    return m && m.note != null ? m.note : (task.note || '');
}

// Задачи человека с почтой email (all — задачи всех).
// Задачи, которые он сам поставил другим, тоже видны ему — чтобы следить за ними.
function stTasksOf(email, all) {
    if (all) return stPlan();
    const person = stPersonOf(email);
    const me = String(email || '').toLowerCase();
    return stPlan().filter(t => (person && (t.who || []).includes(person)) || (t.custom && String(t.by || '').toLowerCase() === me));
}

function stTasksForDate(email, date, all) {
    return stTasksOf(email, all).filter(t => t.date === date);
}

// Незавершённые задачи на сегодня и просроченные
function stOpenTasksUntil(email, today, all) {
    return stTasksOf(email, all).filter(t => t.date <= today && stStatus(t) !== 'done');
}

function stSetMark(id, fields) {
    let m = stMark(id);
    if (!m) { m = { id }; studioTaskMarks.push(m); }
    Object.assign(m, fields, { by: stMyEmail() || null, updatedAt: new Date().toISOString() });
    Object.keys(m).forEach(k => { if (m[k] === null || m[k] === undefined) delete m[k]; });
    saveAll();
    stRerender();
}

function stSetStatus(id, status) {
    stSetMark(id, { status });
}

function stEditNote(id) {
    const task = stPlan().find(t => t.id === id);
    if (!task) return;
    const text = prompt('Пометка к задаче:\n' + task.text, stNote(task));
    if (text === null) return;
    stSetMark(id, { note: text.trim() });
}

function stIsAdmin() {
    return !!(window.currentUserData && window.currentUserData.role === 'admin');
}

// ---------- Новая задача (только админ) ----------
function stOpenTaskModal(date) {
    if (!stIsAdmin()) return;
    document.getElementById('studioTaskWho').innerHTML = Object.keys(STUDIO_PEOPLE).map(name =>
        `<label class="st-who-item"><input type="checkbox" value="${escAttr(name)}"> ${safeHTML(name)}</label>`).join('');
    document.getElementById('studioTaskText').value = '';
    document.getElementById('studioTaskNote').value = '';
    document.getElementById('studioTaskDate').value = date || formatDate(new Date());
    document.getElementById('studioTaskError').textContent = '';
    openModal('studioTaskModal');
    setTimeout(() => document.getElementById('studioTaskText').focus(), 50);
}

function stCloseTaskModal() {
    closeModalById('studioTaskModal');
}

function stSaveTask() {
    const who = [...document.querySelectorAll('#studioTaskWho input:checked')].map(i => i.value);
    const text = document.getElementById('studioTaskText').value.trim();
    const date = document.getElementById('studioTaskDate').value;
    const note = document.getElementById('studioTaskNote').value.trim();
    const err = document.getElementById('studioTaskError');
    if (!who.length) { err.textContent = 'Выберите, кому задача'; return; }
    if (!text) { err.textContent = 'Напишите, что сделать'; return; }
    if (!date) { err.textContent = 'Выберите день'; return; }
    const task = { id: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), custom: true, date, text, who,
        type: 'Задача', by: stMyEmail() || null, updatedAt: new Date().toISOString() };
    if (note) task.note = note;
    studioTaskMarks.push(task);
    // Тем, кому поставили задачу, — уведомление в колокольчик
    const me = stPersonOf(stMyEmail());
    const message = `📌 Новая задача на ${formatDateDDMMYYYY(date)}: ${text}`;
    if (typeof addNotice === 'function') {
        who.filter(name => name !== me && STUDIO_HELPERS.includes(name)).forEach(name => addNotice(STUDIO_PEOPLE[name][0], 'studio_task', message, null));
        if (who.some(name => name !== me && !STUDIO_HELPERS.includes(name))) addNotice('admin', 'studio_task', `${message} (для: ${who.join(', ')})`, null);
    }
    saveAll();
    stCloseTaskModal();
    if (typeof showToast === 'function') showToast(`📌 Задача добавлена: ${who.join(', ')}, ${formatDateDDMMYYYY(date)}`, 'success');
    stRerender();
}

function stDeleteTask(id) {
    const i = studioTaskMarks.findIndex(m => m && m.id === id && m.custom);
    if (i < 0 || !confirm('Удалить задачу «' + studioTaskMarks[i].text + '»?')) return;
    studioTaskMarks.splice(i, 1);
    saveAll();
    stRerender();
}

function stToggleAll() {
    stShowAll = !stShowAll;
    stRerender();
}

function stRerender() {
    const active = document.querySelector('.tab-content.active');
    if (!active) return;
    if (active.id === 'tab-calendar' && typeof renderCalendar === 'function') renderCalendar();
    if ((active.id === 'helper-attendance' || active.id === 'tab-helper-admin') && typeof renderAttendance === 'function') renderAttendance();
}

// Одна задача: статус, текст, кто, где, пометка, кнопки
function stTaskRowHTML(task, opts = {}) {
    const status = stStatus(task);
    const note = stNote(task);
    const id = escAttr(task.id);
    const late = opts.today && task.date < opts.today && status !== 'done';
    const meta = [];
    if (opts.showDate) meta.push(formatDateDDMMYYYY(task.date));
    if (opts.showWho || (task.who || []).length > 1 || task.custom) meta.push('👤 ' + (task.who || []).map(safeHTML).join(', '));
    if (task.where) meta.push('📍 ' + safeHTML(task.where));
    if (task.type) meta.push(safeHTML(task.type));
    const next = status === 'done'
        ? `<button class="st-btn" onclick="event.stopPropagation(); stSetStatus('${id}', 'todo')" title="Вернуть в работу">↩️</button>`
        : (status === 'todo' && !opts.compact ? `<button class="st-btn" onclick="event.stopPropagation(); stSetStatus('${id}', 'work')">🔄 В работе</button>` : '') +
          `<button class="st-btn st-done" onclick="event.stopPropagation(); stSetStatus('${id}', 'done')" title="Готово">✅${opts.compact ? '' : ' Готово'}</button>`;
    return `<div class="st-task st-${status}${late ? ' st-late' : ''}">
        <div class="st-main">
            <div class="st-text">${STUDIO_STATUSES[status].icon} ${safeHTML(task.text)}${late ? ` <b class="st-late-label">просрочено с ${formatDateDDMMYYYY(task.date)}</b>` : ''}</div>
            ${meta.length ? `<div class="st-meta">${meta.join(' · ')}</div>` : ''}
            ${note ? `<div class="st-note">💬 ${safeHTML(note)}</div>` : ''}
        </div>
        <div class="st-actions">${next}<button class="st-btn" onclick="event.stopPropagation(); stEditNote('${id}')" title="Пометка">✏️</button>${task.custom && stIsAdmin() ? `<button class="st-btn" onclick="event.stopPropagation(); stDeleteTask('${id}')" title="Удалить задачу">🗑</button>` : ''}</div>
    </div>`;
}

// Список задач дня (для расписания календаря и календаря помощника)
function stDayListHTML(email, date, all, title) {
    const tasks = stTasksForDate(email, date, all);
    if (!tasks.length) return '';
    const done = tasks.filter(t => stStatus(t) === 'done').length;
    return `<div class="st-day">
        <div class="st-day-head">${title || '✔ Задачи студии'} <span class="st-count">${done} из ${tasks.length} готово</span></div>
        ${tasks.map(t => stTaskRowHTML(t, { showWho: all })).join('')}
    </div>`;
}

// Кнопки «➕ Задача» и «мои / все» (только админу)
function stToggleHTML(date) {
    if (!stIsAdmin()) return '';
    return `<div class="st-tools"><button class="st-toggle st-add" onclick="stOpenTaskModal('${escAttr(date || '')}')">➕ Задача</button>` +
        `<button class="st-toggle" onclick="stToggleAll()" title="Переключить: только мои / задачи всех">${stShowAll ? '👥 Показаны задачи всех' : '👤 Показаны мои задачи'}</button></div>`;
}

window.stSetStatus = stSetStatus;
window.stEditNote = stEditNote;
window.stToggleAll = stToggleAll;
window.stOpenTaskModal = stOpenTaskModal;
window.stCloseTaskModal = stCloseTaskModal;
window.stSaveTask = stSaveTask;
window.stDeleteTask = stDeleteTask;
