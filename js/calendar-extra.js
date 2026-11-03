/* ==========================================================================
   КАЛЕНДАРЬ: ЗАМЕТКИ «ДЛЯ КОГО», ОТПУСК, ПРЕДЗАПИСЬ, СВАЙП МЕСЯЦА.
   Всё хранится в общем списке notes (синхронизируется между устройствами, app.js):
     заметка     { id, date, time, text, for?: ['Егор', …] (нет — всем админам), by }
     отпуск      { id, kind: 'vacation', date (с), to (по), who: 'Дауд', email, text }
     предзапись  { id, kind: 'prebook', date, time, client, phone, service, comment, text }
   У отпуска и предзаписи есть text — старые места (push-сводка, виджет iPhone) показывают их как заметку.
   Помощник в отпуске: дни отпуска не считаются пропусками (attendance.js, attDayState).
   ========================================================================== */

// Люди календаря: админы из STUDIO_PEOPLE (studio-tasks.js) и помощники из /users (attendance.js)
function calAdmins() {
    const people = typeof STUDIO_PEOPLE !== 'undefined' ? STUDIO_PEOPLE : {};
    const helpers = typeof STUDIO_HELPERS !== 'undefined' ? STUDIO_HELPERS : [];
    return Object.keys(people).filter(n => !helpers.includes(n)).map(name => ({ name, email: people[name][0] }));
}
function calHelpers() {
    const list = typeof attHelpers === 'function' ? attHelpers() : [];
    const people = typeof STUDIO_PEOPLE !== 'undefined' ? STUDIO_PEOPLE : {};
    // Имя помощника — как в задачах студии, если его почта там есть
    return list.map(h => ({ email: h.email, name: Object.keys(people).find(n => people[n].includes(String(h.email).toLowerCase())) || h.name }));
}
function calMyName() {
    const email = window.currentUserData ? String(window.currentUserData.email || '').toLowerCase() : '';
    return typeof stPersonOf === 'function' ? stPersonOf(email) : null;
}

function calKind(n) { return n && (n.kind === 'vacation' || n.kind === 'prebook') ? n.kind : 'note'; }

// Заметку видят: все админы, если «для кого» не выбрано; иначе — выбранные и тот, кто её написал
function calNoteVisible(n) {
    const list = Array.isArray(n.for) ? n.for : [];
    if (!list.length) return true;
    const me = calMyName();
    const myEmail = window.currentUserData ? String(window.currentUserData.email || '').toLowerCase() : '';
    return (me && list.includes(me)) || (n.by && String(n.by).toLowerCase() === myEmail);
}

// Обычные заметки дня (без отпусков и предзаписей) — для всех старых мест календаря
function calDayNotes(ds) {
    return (typeof notes !== 'undefined' ? notes : []).filter(n => n && calKind(n) === 'note' && n.date === ds && calNoteVisible(n));
}
function calDayVacations(ds) {
    return (typeof notes !== 'undefined' ? notes : []).filter(n => n && n.kind === 'vacation' && n.date <= ds && (n.to || n.date) >= ds);
}
function calDayPrebooks(ds) {
    return (typeof notes !== 'undefined' ? notes : []).filter(n => n && n.kind === 'prebook' && n.date === ds)
        .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
}
// Помощник (или админ) в отпуске в этот день — по почте
function calOnVacation(email, ds) {
    const e = String(email || '').toLowerCase();
    return calDayVacations(ds).some(v => String(v.email || '').toLowerCase() === e);
}

function calForLabel(n) {
    const list = Array.isArray(n.for) ? n.for : [];
    return list.length ? ` <span class="cal-for">👤 ${list.map(safeHTML).join(', ')}</span>` : '';
}
function calNoteHTML(n) {
    return `${safeHTML(n.time ? n.time + ' ' : '')}${safeHTML(n.text)}${calForLabel(n)}`;
}
function calVacationHTML(v) {
    return `🌴 ${safeHTML(v.who || '')} в отпуске ${formatDateDDMMYYYY(v.date)}–${formatDateDDMMYYYY(v.to || v.date)}${v.comment ? ' · ' + safeHTML(v.comment) : ''}`;
}
function calPrebookHTML(p) {
    return `${p.time ? safeHTML(p.time) + ' ' : ''}${safeHTML(p.client || 'клиент')}${p.phone ? ' · ' + safeHTML(p.phone) : ''}${p.service ? ' · ' + safeHTML(p.service) : ''}${p.comment ? ' · ' + safeHTML(p.comment) : ''}`;
}
function calIdAttr(id) { return JSON.stringify(id).replace(/"/g, '&quot;'); }

// Строки для «Списка по дням» и расписания дня: отпуск и предзапись (кнопки «Оформить», ✏️, ✕)
function calExtraRowsHTML(ds, rowFn) {
    const rows = [];
    calDayVacations(ds).forEach(v => rows.push(rowFn('vacation', '🌴 отпуск', calVacationHTML(v),
        `<button class="ag-btn" title="Изменить" onclick="event.stopPropagation(); calOpenVacation(${calIdAttr(v.id)})">✏️</button>` +
        `<button class="ag-btn" title="Удалить отпуск" onclick="event.stopPropagation(); calDeleteItem(${calIdAttr(v.id)})">✕</button>`)));
    calDayPrebooks(ds).forEach(p => rows.push(rowFn('prebook', '📞 предзапись', calPrebookHTML(p),
        `<button class="ag-btn ag-ok" title="Клиент приехал — оформить заказ" onclick="event.stopPropagation(); calPrebookToOrder(${calIdAttr(p.id)})">➕ Заказ</button>` +
        `<button class="ag-btn" title="Изменить" onclick="event.stopPropagation(); calOpenPrebook(null, ${calIdAttr(p.id)})">✏️</button>` +
        `<button class="ag-btn" title="Удалить предзапись" onclick="event.stopPropagation(); calDeleteItem(${calIdAttr(p.id)})">✕</button>`)));
    return rows;
}

// ---------- «Для кого» в окне заметки ----------
function calRenderNoteFor(selected) {
    const box = document.getElementById('noteFor');
    if (!box) return;
    const list = Array.isArray(selected) ? selected : [];
    const people = calAdmins().concat(calHelpers().filter(h => h.name && !calAdmins().some(a => a.name === h.name)));
    box.innerHTML = `<label class="st-who-item"><input type="checkbox" value="" ${list.length ? '' : 'checked'} onchange="calNoteForAll(this)"> Все админы</label>` +
        people.map(p => `<label class="st-who-item"><input type="checkbox" value="${escAttr(p.name)}" ${list.includes(p.name) ? 'checked' : ''} onchange="calNoteForOne()"> ${safeHTML(p.name)}</label>`).join('');
}
function calNoteForAll(input) {
    if (input.checked) document.querySelectorAll('#noteFor input[value]:not([value=""])').forEach(i => { i.checked = false; });
}
function calNoteForOne() {
    const any = [...document.querySelectorAll('#noteFor input:not([value=""])')].some(i => i.checked);
    const all = document.querySelector('#noteFor input[value=""]');
    if (all) all.checked = !any;
}
function calReadNoteFor() {
    return [...document.querySelectorAll('#noteFor input:checked')].map(i => i.value).filter(Boolean);
}

// ---------- Отпуск ----------
let calEditingId = null;
function calOpenVacation(id, date) {
    const v = id != null ? notes.find(n => n.id === id) : null;
    calEditingId = v ? v.id : null;
    const admins = calAdmins();
    const people = admins.map(p => ({ ...p, admin: true })).concat(calHelpers().filter(h => !admins.some(a => a.email === h.email)));
    const sel = document.getElementById('vacWho');
    sel.innerHTML = people.map(p => `<option value="${escAttr(p.email)}" data-name="${escAttr(p.name)}">${safeHTML(p.name)}${p.admin ? ' (админ)' : ' (помощник)'}</option>`).join('');
    const d = date || (typeof selectedDate !== 'undefined' && selectedDate ? formatDate(selectedDate) : formatDate(new Date()));
    if (v) sel.value = v.email;
    else { const me = window.currentUserData && window.currentUserData.email; if (me && people.some(p => p.email === me)) sel.value = me; }
    document.getElementById('vacFrom').value = v ? v.date : d;
    document.getElementById('vacTo').value = v ? (v.to || v.date) : d;
    document.getElementById('vacComment').value = v ? (v.comment || '') : '';
    document.getElementById('vacationModalTitle').textContent = v ? '🌴 Изменить отпуск' : '🌴 Отпуск';
    openModal('vacationModal');
}
function calCloseVacation() { closeModalById('vacationModal'); calEditingId = null; }
function calSaveVacation() {
    const sel = document.getElementById('vacWho');
    const from = document.getElementById('vacFrom').value, to = document.getElementById('vacTo').value || from;
    if (!sel.value || !from) { alert('Выберите, кто и с какого дня'); return; }
    if (to < from) { alert('Дата «по» раньше даты «с»'); return; }
    const who = sel.selectedOptions[0] ? sel.selectedOptions[0].dataset.name : '';
    const comment = document.getElementById('vacComment').value.trim();
    const fields = { kind: 'vacation', date: from, to, who, email: sel.value, comment,
        text: `🌴 Отпуск: ${who} ${formatDateDDMMYYYY(from)}–${formatDateDDMMYYYY(to)}${comment ? ' (' + comment + ')' : ''}`,
        by: window.currentUserData ? window.currentUserData.email : null };
    calUpsert(fields);
    // Помощнику — уведомление в колокольчик
    if (typeof addNotice === 'function' && !calAdmins().some(a => a.email === sel.value))
        addNotice(sel.value, 'vacation', `🌴 Вам поставлен отпуск ${formatDateDDMMYYYY(from)}–${formatDateDDMMYYYY(to)}`, null);
    calCloseVacation();
    calAfterChange(`🌴 Отпуск: ${who}, ${formatDateDDMMYYYY(from)}–${formatDateDDMMYYYY(to)}`);
}

// ---------- Предзапись ----------
function calOpenPrebook(date, id) {
    const p = id != null ? notes.find(n => n.id === id) : null;
    calEditingId = p ? p.id : null;
    const d = date || (typeof selectedDate !== 'undefined' && selectedDate ? formatDate(selectedDate) : formatDate(new Date()));
    document.getElementById('preDate').value = p ? p.date : d;
    document.getElementById('preTime').value = p ? (p.time || '') : '';
    document.getElementById('preClient').value = p ? (p.client || '') : '';
    document.getElementById('prePhone').value = p ? (p.phone || '') : '';
    const svc = document.getElementById('preService');
    svc.innerHTML = '<option value="">— услуга —</option>' + (typeof rates !== 'undefined' ? rates : []).map(r => `<option value="${escAttr(r.service)}">${safeHTML(r.service)}</option>`).join('');
    svc.value = p ? (p.service || '') : '';
    document.getElementById('preComment').value = p ? (p.comment || '') : '';
    document.getElementById('prebookModalTitle').textContent = p ? '📞 Изменить предзапись' : '📞 Предзапись';
    openModal('prebookModal');
}
function calClosePrebook() { closeModalById('prebookModal'); calEditingId = null; }
function calSavePrebook() {
    const date = document.getElementById('preDate').value;
    const client = document.getElementById('preClient').value.trim();
    if (!date || !client) { alert('Укажите день и клиента'); return; }
    const time = document.getElementById('preTime').value, phone = document.getElementById('prePhone').value.trim();
    const service = document.getElementById('preService').value, comment = document.getElementById('preComment').value.trim();
    calUpsert({ kind: 'prebook', date, time, client, phone, service, comment,
        text: `📞 Предзапись: ${client}${phone ? ' ' + phone : ''}${service ? ', ' + service : ''}${comment ? ' (' + comment + ')' : ''}`,
        by: window.currentUserData ? window.currentUserData.email : null });
    calClosePrebook();
    calAfterChange(`📞 Предзапись: ${client}, ${formatDateDDMMYYYY(date)}${time ? ' ' + time : ''}`);
}
// Клиент приехал: открываем новый заказ с его данными, предзапись убираем после сохранения заказа
function calPrebookToOrder(id) {
    const p = notes.find(n => n.id === id);
    if (!p) return;
    openOrderModal(null, p.date);
    setTimeout(() => {
        const set = (elId, v) => { const el = document.getElementById(elId); if (el && v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
        set('orderClient', p.client); set('orderPhone', p.phone);
        const select = document.querySelector('#servicesList .service-row select');
        if (p.service && select && !select.value) { select.value = p.service; if (select.onchange) select.onchange(); }
        window.calPendingPrebookId = p.id;
    }, 60);
}
// Вызывается после сохранения заказа (saveOrder в app.js)
function calPrebookOrderSaved() {
    if (window.calPendingPrebookId == null) return;
    const id = window.calPendingPrebookId;
    window.calPendingPrebookId = null;
    notes = notes.filter(n => n.id !== id);
}

// ---------- Общее ----------
function calUpsert(fields) {
    const existing = calEditingId != null ? notes.find(n => n.id === calEditingId) : null;
    if (existing) {
        Object.keys(existing).forEach(k => { if (k !== 'id') delete existing[k]; });
        Object.assign(existing, fields);
    } else notes.push({ id: Date.now(), ...fields });
    Object.keys(fields).forEach(k => { const n = existing || notes[notes.length - 1]; if (n[k] === '' || n[k] == null) delete n[k]; });
}
function calDeleteItem(id) {
    const n = notes.find(x => x.id === id);
    if (!n || !confirm(`Удалить: ${n.text}?`)) return;
    notes = notes.filter(x => x.id !== id);
    calAfterChange('Удалено');
}
function calAfterChange(message) {
    saveAll();
    renderAll();
    if (message && typeof showToast === 'function') showToast(message, 'success');
}

// ---------- Свайп: листать месяц (неделю) пальцем ----------
function calBindSwipe(el, onSwipe) {
    if (!el || el.dataset.swipe) return;
    el.dataset.swipe = '1';
    let x0 = null, y0 = null, t0 = 0;
    el.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); }, { passive: true });
    el.addEventListener('touchend', e => {
        if (x0 === null) return;
        const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        x0 = null;
        // Горизонтальный жест: длиннее 50 px, заметно шире, чем по вертикали, быстрее секунды
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 1000) onSwipe(dx < 0 ? 1 : -1);
    }, { passive: true });
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', () => {
    calBindSwipe(document.getElementById('calendarGrid'), delta => {
        changeMonth(delta);
        const grid = document.getElementById('calendarGrid');
        if (grid) { grid.classList.remove('cal-slide-left', 'cal-slide-right'); void grid.offsetWidth; grid.classList.add(delta > 0 ? 'cal-slide-left' : 'cal-slide-right'); }
    });
    // Календарь помощника (js/attendance.js)
    calBindSwipe(document.getElementById('helperAttendanceContainer'), delta => { if (typeof attSetMonth === 'function') attSetMonth(delta); });
});

window.calOpenVacation = calOpenVacation;
window.calCloseVacation = calCloseVacation;
window.calSaveVacation = calSaveVacation;
window.calOpenPrebook = calOpenPrebook;
window.calClosePrebook = calClosePrebook;
window.calSavePrebook = calSavePrebook;
window.calPrebookToOrder = calPrebookToOrder;
window.calDeleteItem = calDeleteItem;
window.calNoteForAll = calNoteForAll;
window.calNoteForOne = calNoteForOne;
