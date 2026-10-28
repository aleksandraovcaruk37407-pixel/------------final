/* ==========================================================================
   ПОСТОЯННЫЕ КЛИЕНТЫ: подсказка в окне заказа.
   База клиентов собирается из заказов (ordersData в app.js) — отдельно её вести не нужно.
   Клиент — по телефону (последние 10 цифр), без телефона — по имени.
   Постоянный — 2 заказа и больше.
   ========================================================================== */

function clPhoneKey(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    return d.length >= 10 ? d.slice(-10) : '';
}

function clClientBase() {
    const map = new Map();
    (typeof ordersData !== 'undefined' ? ordersData : []).forEach(o => {
        if (!o || !(o.client || o.phone)) return;
        const key = clPhoneKey(o.phone) || 'name:' + String(o.client || '').trim().toLowerCase();
        let c = map.get(key);
        if (!c) { c = { name: '', phone: '', count: 0, lastDate: '', services: [] }; map.set(key, c); }
        c.count++;
        if (!c.lastDate || (o.date || '') >= c.lastDate) {
            c.lastDate = o.date || c.lastDate;
            if (o.client) c.name = o.client;
            if (o.phone) c.phone = o.phone;
            c.services = (o.services || []).map(s => s.serviceName).filter(Boolean);
        }
        if (!c.name && o.client) c.name = o.client;
        if (!c.phone && o.phone) c.phone = o.phone;
    });
    return [...map.values()];
}

function clFind(query, byPhone) {
    const q = String(query || '').trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    if (byPhone ? digits.length < 3 : q.length < 2) return [];
    return clClientBase()
        .filter(c => byPhone ? String(c.phone).replace(/\D/g, '').includes(digits) : String(c.name).toLowerCase().includes(q))
        .sort((a, b) => b.count - a.count || String(b.lastDate).localeCompare(String(a.lastDate)))
        .slice(0, 6);
}

function clInfoText(c) {
    const last = c.lastDate ? `, последний ${formatDateDDMMYYYY(c.lastDate)}` : '';
    return c.count >= 2
        ? `⭐ Постоянный клиент: ${c.count} заказа(ов)${last}${c.services.length ? ' · ' + c.services.join(', ') : ''}`
        : `Был 1 заказ${last}${c.services.length ? ' · ' + c.services.join(', ') : ''}`;
}

function clHide() {
    const box = document.getElementById('clientSuggest');
    if (box) box.remove();
}

function clShow(input, list) {
    clHide();
    if (!list.length) return;
    const box = document.createElement('div');
    box.id = 'clientSuggest';
    box.className = 'client-suggest';
    box.innerHTML = list.map((c, i) =>
        `<div class="client-suggest-item" data-i="${i}">
            <div><b>${safeHTML(c.name || 'без имени')}</b> ${c.count >= 2 ? '<span class="client-star">⭐ постоянный</span>' : ''}</div>
            <div class="client-suggest-sub">${safeHTML(c.phone || 'без телефона')} · заказов: ${c.count}${c.lastDate ? ' · последний ' + formatDateDDMMYYYY(c.lastDate) : ''}</div>
        </div>`).join('');
    // mousedown, а не click: иначе поле теряет фокус и список закрывается раньше выбора
    box.addEventListener('mousedown', e => {
        const item = e.target.closest('.client-suggest-item');
        if (!item) return;
        e.preventDefault();
        clPick(list[Number(item.dataset.i)]);
    });
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(box);
}

function clPick(c) {
    document.getElementById('orderClient').value = c.name || '';
    const phone = document.getElementById('orderPhone');
    phone.value = c.phone || '';
    clHide();
    clSetInfo(c);
}

function clSetInfo(c) {
    let info = document.getElementById('clientInfo');
    const phoneInput = document.getElementById('orderPhone');
    if (!info && phoneInput) {
        info = document.createElement('div');
        info.id = 'clientInfo';
        info.className = 'client-info';
        phoneInput.closest('.form-row').insertAdjacentElement('afterend', info);
    }
    if (info) info.textContent = c ? clInfoText(c) : '';
}

document.addEventListener('input', e => {
    const id = e.target && e.target.id;
    if (id !== 'orderClient' && id !== 'orderPhone') return;
    clSetInfo(null);
    clShow(e.target, clFind(e.target.value, id === 'orderPhone'));
});
document.addEventListener('focusout', e => {
    if (e.target && (e.target.id === 'orderClient' || e.target.id === 'orderPhone')) setTimeout(clHide, 150);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') clHide();
});
