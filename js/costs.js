/* ==========================================================================
   СЕБЕСТОИМОСТЬ ЗАКАЗА — один расчёт для всей программы.

   Им пользуются окно заказа, сохранение заказа, «Деньги»/«Итоги», закупка и
   склад. Раньше у каждого места была своя формула, и суммы расходились.

   costOrderLines(order, refs) → строки материалов заказа:
     { kind, group, code, name, unit, qty, price, sum, service }
       kind  — fabric | paint | film | marker | item | extra
       group — раздел в закупке: «Ткань», «Краска», «Пленка», имя маркера
               (ВИБРОПОГЛОЩЕНИЕ и т.п.) или «Прочие расходники»
       name  — название позиции на складе (по нему считаются остатки)
   refs = { rates, colors, paints, films, extraRef, materialTypes }

   Цена: если в заказе записана своя цена (> 0) — берётся она, иначе цена из
   справочника. Поэтому старые заказы не меняются, когда меняется справочник.
   Количество расходника услуги: поправленное в заказе, иначе норма из
   справочника — на заказ или на метр ткани/плёнки.
   ========================================================================== */

function costNum(v) { return parseFloat(v) || 0; }

function costSameName(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

// Включён ли в услуге маркер (Ткань, Краска, Пленка для аквапринта, ВИБРОПОГЛОЩЕНИЕ…)
function costServiceUses(svc, markerName) {
    return !!svc && (svc.items || []).some(item => item.enabled !== false && costSameName(item.name, markerName));
}

function costServiceMeters(inst) {
    return costNum(inst && inst.fabric && inst.fabric.meters) || costNum(inst && inst.film && inst.film.meters);
}

// Расходник услуги, который считается отдельной строкой (а не маркером)
function costIsOrdinaryItem(item, svc, refs) {
    if (!item || item.enabled === false || item.customMarker) return false;
    if (['Ткань', 'Краска', 'Пленка для аквапринта'].some(m => costSameName(item.name, m))) return false;
    return !(refs.materialTypes || []).some(mt => costSameName(mt.name, item.name));
}

// Количество расходника услуги в заказе: поправленное в заказе, иначе норма из справочника.
// Включённый расходник всегда считается по норме — его не нужно вписывать в каждый заказ
// (старая галочка «Вручную» больше не обнуляет его).
function costItemQty(item, inst) {
    const manual = (inst && inst.manualItems) || {};
    if (manual[item.name] !== undefined && manual[item.name] !== '') return costNum(manual[item.name]);
    return item.perMeter ? costNum(item.quantity) * costServiceMeters(inst) : costNum(item.quantity);
}

// Цена расходника услуги в заказе: своя цена заказа или цена из справочника услуги
function costItemPrice(item, inst) {
    const own = costNum(inst && inst.itemPrices && inst.itemPrices[item.name]);
    return own > 0 ? own : costNum(item.price);
}

function costParseExtra(order) {
    if (order && order.extraData && typeof order.extraData === 'object') return order.extraData;
    try { return JSON.parse((order && order.extraData) || '{}') || {}; } catch (e) { return {}; }
}

function costOrderLines(order, refs) {
    const lines = [];
    const push = (line) => {
        line.qty = costNum(line.qty);
        line.price = costNum(line.price);
        line.sum = line.qty * line.price;
        if (line.qty > 0) lines.push(line);
    };
    const findByCode = (list, code) => (list || []).find(r => String(r.code || '') === String(code || ''));
    ((order && order.services) || []).forEach(inst => {
        if (!inst) return;
        const svc = (refs.rates || []).find(r => r.service === inst.serviceName);
        if (!svc) return;
        const service = inst.serviceName;
        if (costServiceUses(svc, 'Ткань') && inst.fabric && inst.fabric.code) {
            const ref = findByCode(refs.colors, inst.fabric.code);
            push({ kind: 'fabric', group: 'Ткань', code: inst.fabric.code, unit: 'м', service,
                name: ref ? `${ref.name} ${ref.code}` : `Ткань ${inst.fabric.code}`,
                qty: inst.fabric.meters, price: costNum(inst.fabric.price) > 0 ? inst.fabric.price : (ref && ref.price) });
        }
        if (costServiceUses(svc, 'Краска') && inst.paint && inst.paint.code) {
            const ref = findByCode(refs.paints, inst.paint.code);
            push({ kind: 'paint', group: 'Краска', code: inst.paint.code, unit: 'мл', service,
                name: ref ? ref.name : `Краска ${inst.paint.code}`,
                qty: inst.paint.qty, price: costNum(inst.paint.price) > 0 ? inst.paint.price : (ref && ref.price) });
        }
        if (costServiceUses(svc, 'Пленка для аквапринта') && inst.film && inst.film.code) {
            const ref = findByCode(refs.films, inst.film.code);
            push({ kind: 'film', group: 'Пленка', code: inst.film.code, unit: 'м', service,
                name: ref ? ref.name : `Плёнка ${inst.film.code}`,
                qty: inst.film.meters, price: costNum(inst.film.price) > 0 ? inst.film.price : (ref && ref.price) });
        }
        (svc.items || []).forEach(item => {
            if (!costIsOrdinaryItem(item, svc, refs)) return;
            push({ kind: 'item', group: 'Прочие расходники', code: '', name: item.name, unit: item.unit || 'шт', service,
                qty: costItemQty(item, inst), price: costItemPrice(item, inst) });
        });
        (refs.materialTypes || []).forEach(mt => {
            const data = inst[mt.name];
            if (!costServiceUses(svc, mt.name) || !data || !data.code) return;
            const art = (mt.articles || []).find(a => a.code === data.code);
            push({ kind: 'marker', group: mt.name, code: data.code, unit: data.unit || mt.unit || 'шт', service,
                name: art ? art.name : data.code,
                // sheets и m2 — поля из старых версий окна заказа
                qty: data.qty !== undefined && data.qty !== '' ? data.qty : (data.sheets || data.m2),
                price: costNum(data.price) > 0 ? data.price : (art && art.price) });
        });
    });
    const extra = costParseExtra(order);
    const extraPrices = (order && order.extraPrices) || {};
    Object.keys(extra).forEach(key => {
        const ref = (refs.extraRef || []).find(e => e.name === key);
        if (!ref) return;
        push({ kind: 'extra', group: 'Прочие расходники', code: '', name: key, unit: ref.unit || 'шт', service: '',
            qty: extra[key], price: costNum(extraPrices[key]) > 0 ? extraPrices[key] : ref.price });
    });
    return lines;
}

function costOrderTotal(order, refs) {
    return costOrderLines(order, refs).reduce((s, l) => s + l.sum, 0);
}

// Сумма строк многих заказов по названию позиции (для закупки и склада)
function costSumLines(orders, refs) {
    const byName = new Map();
    (orders || []).forEach(order => costOrderLines(order, refs).forEach(l => {
        const key = l.group + '\u0000' + l.name;
        const cur = byName.get(key) || { group: l.group, name: l.name, code: l.code, unit: l.unit, qty: 0, price: 0, sum: 0 };
        cur.qty += l.qty;
        cur.sum += l.sum;
        if (l.price > 0) cur.price = l.price;
        byName.set(key, cur);
    }));
    return [...byName.values()];
}
