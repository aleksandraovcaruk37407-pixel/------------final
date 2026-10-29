/* ==========================================================================
   КАЛЕНДАРЬ: ВИД «СПИСОК ПО ДНЯМ» (основной вид вкладки «Календарь»).
   Дни подряд, начиная с сегодняшнего, — только те, где что-то есть; сверху — просроченное.
   В дне: сдать заказ, приём заказа, задачи помощников, задачи студии, платежи, заметки.
   Сетка месяца осталась — кнопка «📅 Месяц» (renderCalendar в app.js).
   Данные и помощники — из app.js, finance.js, studio-tasks.js.
   ========================================================================== */

const AGENDA_STEP = 7;       // сколько дней показывать и добавлять кнопкой «Показать ещё»
let agendaDays = AGENDA_STEP;
let agendaAddOpen = null;    // день, у которого открыто меню «＋»
let agendaLateOpen = false;  // блок «Просрочено» развёрнут

function calendarView() {
    try { return localStorage.getItem('calendar_view') === 'month' ? 'month' : 'agenda'; } catch (e) { return 'agenda'; }
}

function setCalendarView(view) {
    try { localStorage.setItem('calendar_view', view); } catch (e) {}
    renderCalendar();
}

function agendaActive() {
    const agenda = calendarView() === 'agenda';
    const a = document.getElementById('calAgendaView'), m = document.getElementById('calMonthView');
    if (a) a.style.display = agenda ? '' : 'none';
    if (m) m.style.display = agenda ? 'none' : '';
    document.querySelectorAll('.cal-switch-btn').forEach(b => b.classList.toggle('active', b.dataset.calview === calendarView()));
    return agenda;
}

function agendaAddDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return formatDate(d);
}

function agendaOrderText(o) {
    return `№${safeHTML(o.orderNumber)} ${safeHTML(o.client || 'без клиента')} · ${safeHTML((o.services || []).map(s => s.serviceName).join(', '))}`;
}

function agendaOrderClick(o) {
    return `openOrderModal(${JSON.stringify(o.id).replace(/"/g, '&quot;')})`;
}

// Строка: метка (цвет по смыслу), текст, кнопки справа
function agendaRow(kind, label, html, actions = '', onclick = '') {
    return `<div class="ag-row ag-${kind}"${onclick ? ` onclick="${onclick}"` : ''}>
        <span class="ag-tag">${label}</span><span class="ag-text">${html}</span>${actions ? `<span class="ag-actions">${actions}</span>` : ''}
    </div>`;
}

// Задачи помощников по заказам со сроком в этот день (ещё не приняты)
function agendaHelperTasks(filter) {
    const list = [];
    ordersData.forEach(o => (o.services || []).forEach(s => (s.tasks || []).forEach(t => {
        if (!t.deadline || t.status === 'completed') return;
        const day = String(t.deadline).split('T')[0];
        if (filter(day)) list.push({ t, o, day });
    })));
    return list;
}

function agendaHelperRow({ t, o, day }, today) {
    const who = t.assignedTo ? safeHTML(String(t.assignedTo).split('@')[0]) : 'не назначено';
    const time = String(t.deadline).includes('T') ? ' до ' + String(t.deadline).split('T')[1].slice(0, 5) : '';
    const state = t.status === 'review' ? ' · ждёт проверки' : '';
    const late = day < today ? ` · <b>просрочено с ${formatDateDDMMYYYY(day)}</b>` : '';
    return agendaRow('helper', '👷 помощник', `${who}: ${safeHTML(t.description || 'задача')} (№${safeHTML(o.orderNumber)})${time}${state}${late}`, '', agendaOrderClick(o));
}

function agendaPaymentRow(p, ds, late) {
    return agendaRow('pay', '💳 платёж', `${safeHTML(p.name)} — ${formatMoney(p.amount)}${late ? ` · <b>просрочен с ${formatDateDDMMYYYY(ds)}</b>` : ''}`,
        `<button class="ag-btn ag-ok" onclick="event.stopPropagation(); finPayFromCalendar('${escAttr(p.id)}', '${ds}')">Оплатил</button>`);
}

// Всё, что есть на день (без просроченного — оно отдельным блоком сверху)
function agendaDayRows(ds, today) {
    const rows = [];
    const { start, due } = calendarOrdersForDate(ds);
    due.filter(o => !isOrderDone(o)).forEach(o => rows.push(agendaRow('due', '🏁 сдать', agendaOrderText(o),
        `<button class="ag-btn" onclick="event.stopPropagation(); openMoveOrderModal(${JSON.stringify(o.id).replace(/"/g, '&quot;')})">Перенести</button>`, agendaOrderClick(o))));
    start.forEach(o => rows.push(agendaRow(isOrderDone(o) ? 'done' : 'start', isOrderDone(o) ? '✅ готов' : '📥 приём', agendaOrderText(o), '', agendaOrderClick(o))));
    agendaHelperTasks(day => day === ds).forEach(x => rows.push(agendaHelperRow(x, today)));
    if (typeof stTasksForDate === 'function') stTasksForDate(stMyEmail(), ds, stShowAll).forEach(t => rows.push(stTaskRowHTML(t, { showWho: stShowAll, compact: true })));
    if (typeof finPaymentsForDate === 'function') finPaymentsForDate(ds).forEach(({ p, status }) => {
        if (status.state === 'paid') return;
        if (status.state === 'overdue' && ds < today) return; // покажется в «Просрочено»
        rows.push(agendaPaymentRow(p, ds, false));
    });
    notes.filter(n => n.date === ds).forEach(n => rows.push(agendaRow('note', '📝 заметка', `${safeHTML(n.time ? n.time + ' ' : '')}${safeHTML(n.text)}`,
        `<button class="ag-btn" title="Удалить заметку" onclick="event.stopPropagation(); deleteNote(${JSON.stringify(n.id).replace(/"/g, '&quot;')})">✕</button>`)));
    return rows;
}

// Просроченное: заказы не сданы в срок, задачи, платежи этого месяца
function agendaOverdueRows(today) {
    const rows = [];
    ordersData.filter(o => !isOrderDone(o) && (parseInt(o.durationDays) || 0) > 0 && getDeadline(o) && getDeadline(o) < today && orderMatchesServiceFilter(o))
        .sort((a, b) => getDeadline(a).localeCompare(getDeadline(b)))
        .forEach(o => rows.push(agendaRow('late', '🔴 не сдан', `${agendaOrderText(o)} · <b>срок был ${formatDateDDMMYYYY(getDeadline(o))}</b>`, '', agendaOrderClick(o))));
    agendaHelperTasks(day => day < today).forEach(x => rows.push(agendaHelperRow(x, today)));
    if (typeof stOpenTasksUntil === 'function') stOpenTasksUntil(stMyEmail(), today, stShowAll).filter(t => t.date < today)
        .sort((a, b) => a.date.localeCompare(b.date)).forEach(t => rows.push(stTaskRowHTML(t, { today, showDate: true, showWho: stShowAll, compact: true })));
    if (typeof finPaymentsForDate === 'function') {
        const now = new Date(today + 'T12:00:00');
        for (let d = 1; d < now.getDate(); d++) {
            const ds = formatDate(new Date(now.getFullYear(), now.getMonth(), d));
            finPaymentsForDate(ds).forEach(({ p, status }) => { if (status.state === 'overdue') rows.push(agendaPaymentRow(p, ds, true)); });
        }
    }
    return rows;
}

function agendaDayTitle(ds, today) {
    const human = formatDateHuman(new Date(ds + 'T12:00:00'));
    if (ds === today) return `Сегодня · ${human}`;
    if (ds === agendaAddDays(today, 1)) return `Завтра · ${human}`;
    return human.charAt(0).toUpperCase() + human.slice(1);
}

function agendaAddMenu(ds) {
    const id = JSON.stringify(ds).replace(/"/g, '&quot;');
    return `<div class="ag-add-menu">
        <button class="ag-btn" onclick="openOrderModal(null, ${id})">➕ Заказ</button>
        <button class="ag-btn" onclick="openNoteModal(${id})">📝 Заметка</button>
        ${typeof stIsAdmin === 'function' && stIsAdmin() ? `<button class="ag-btn" onclick="stOpenTaskModal(${id})">📌 Задача</button>` : ''}
    </div>`;
}

function renderAgenda() {
    const box = document.getElementById('calAgendaView');
    if (!box) return;
    const today = formatDate(new Date());
    let html = `<div class="ag-tools">
        <button class="ag-btn ag-main" onclick="openOrderModal(null)">➕ Заказ</button>
        <button class="ag-btn" onclick="openNoteModal('${today}')">📝 Заметка</button>
        ${typeof stToggleHTML === 'function' ? stToggleHTML(today).replace('<div class="st-tools">', '').replace(/<\/div>$/, '') : ''}
    </div>`;

    const late = agendaOverdueRows(today);
    // Просроченное свёрнуто до трёх строк, чтобы список не уезжал вниз
    if (late.length) {
        const LIMIT = 3;
        const rows = agendaLateOpen ? late : late.slice(0, LIMIT);
        const more = late.length > LIMIT
            ? `<button class="ag-btn ag-toggle" onclick="agendaToggleLate()">${agendaLateOpen ? '▲ Свернуть' : `▼ Показать все (${late.length})`}</button>` : '';
        html += `<div class="ag-day ag-day-late"><div class="ag-day-head">🔴 Просрочено <span class="ag-count">${late.length}</span></div>${rows.join('')}${more}</div>`;
    }

    let shown = 0;
    for (let i = 0; i < agendaDays; i++) {
        const ds = agendaAddDays(today, i);
        const rows = agendaDayRows(ds, today);
        if (!rows.length && ds !== today) continue;
        shown++;
        html += `<div class="ag-day${ds === today ? ' ag-today' : ''}">
            <div class="ag-day-head">${agendaDayTitle(ds, today)}
                <button class="ag-plus" title="Добавить на этот день" onclick="agendaToggleAdd('${ds}')">＋</button></div>
            ${agendaAddOpen === ds ? agendaAddMenu(ds) : ''}
            ${rows.length ? rows.join('') : '<div class="ag-empty">На сегодня дел нет 👍</div>'}
        </div>`;
    }
    const until = formatDateDDMMYYYY(agendaAddDays(today, agendaDays - 1));
    html += `<div class="ag-more">${shown <= 1 ? `<div class="ag-empty">До ${until} больше ничего не запланировано</div>` : ''}
        <button class="ag-btn" onclick="agendaMore()">▼ Показать ещё неделю (сейчас до ${until})</button></div>`;
    box.innerHTML = html;
}

function agendaToggleAdd(ds) {
    agendaAddOpen = agendaAddOpen === ds ? null : ds;
    renderAgenda();
}

function agendaToggleLate() {
    agendaLateOpen = !agendaLateOpen;
    renderAgenda();
}

function agendaMore() {
    agendaDays += AGENDA_STEP;
    renderAgenda();
}

window.setCalendarView = setCalendarView;
window.agendaToggleAdd = agendaToggleAdd;
window.agendaMore = agendaMore;
window.agendaToggleLate = agendaToggleLate;
