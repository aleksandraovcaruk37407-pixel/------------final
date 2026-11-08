// ========== ЗАЯВКИ ПОМОЩНИКА (08.11.2026) ==========
// Помощник больше не пишет в общие данные (atelier_data) — правила базы это запрещают, иначе он мог бы
// поменять кассу, заказы и деньги. Его отметки уходят заявками в helper_actions/<uid>/<id>,
// а устройство админа (и робот на GitHub, functions/github-sender.js) проверяет каждую и вносит
// в общие данные только разрешённое:
//   • свои задачи: «Взял в работу», «Выполнил» (на проверку), «Проблема»;
//   • свой приход/уход за сегодня;
//   • уведомления админу; прочитанные и удалённые свои уведомления.
// Файл общий для браузера (window.haDiff/haApply) и Node (require) — одна проверка везде.
(function (root) {
    const list = v => Array.isArray(v) ? v.filter(x => x != null) : (v && typeof v === 'object' ? Object.values(v).filter(x => x != null) : []);
    const lc = s => String(s || '').trim().toLowerCase();
    const str = (s, max) => String(s == null ? '' : s).slice(0, max);
    const DAY = 86400000;

    function tasksOf(orders) {
        const out = [];
        list(orders).forEach(order => list(order.services).forEach(s => list(s.tasks).forEach(t => { if (t && t.id != null) out.push(t); })));
        return out;
    }
    const problemKey = p => (p && p.at) + '|' + (p && p.text);

    // Что помощник email изменил у себя по сравнению с облаком (cloud — последняя облачная версия).
    // Возвращает список изменений, которые можно отправить заявкой.
    function haDiff(local, cloud, email) {
        const me = lc(email);
        const changes = [];
        local = local || {}; cloud = cloud || {};

        const cloudTasks = new Map(tasksOf(cloud.ordersData).map(t => [String(t.id), t]));
        tasksOf(local.ordersData).filter(t => lc(t.assignedTo) === me).forEach(t => {
            const c = cloudTasks.get(String(t.id)) || {};
            const ch = { k: 'task', id: String(t.id) };
            if (t.startedAt && !c.startedAt) ch.startedAt = t.startedAt;
            if (t.status === 'review' && c.status !== 'review' && c.status !== 'completed') { ch.status = 'review'; ch.submittedAt = t.submittedAt || null; }
            const known = new Set(list(c.problems).map(problemKey));
            const added = list(t.problems).filter(p => !known.has(problemKey(p)));
            if (added.length) ch.problems = added.map(p => ({ at: p.at, text: str(p.text, 500) }));
            if (Object.keys(ch).length > 2) changes.push(ch);
        });

        const cloudAtt = new Map(list(cloud.attendance).map(r => [String(r.id), JSON.stringify(r)]));
        list(local.attendance).filter(r => lc(r.email) === me).forEach(r => {
            if (cloudAtt.get(String(r.id)) !== JSON.stringify(r)) changes.push({ k: 'att', rec: r });
        });

        const cloudNotices = new Map(list(cloud.helperNotices).map(n => [String(n.id), n]));
        const localNotices = new Map(list(local.helperNotices).map(n => [String(n.id), n]));
        localNotices.forEach((n, id) => {
            const c = cloudNotices.get(id);
            if (!c && n.to === 'admin' && lc(n.from) === me) changes.push({ k: 'notice', n });
            else if (c && lc(c.to) === me && n.read && !c.read) changes.push({ k: 'read', id });
        });
        cloudNotices.forEach((c, id) => { if (lc(c.to) === me && !localNotices.has(id)) changes.push({ k: 'del', id }); });
        return changes;
    }

    // Применяет заявку помощника к данным (data.ordersData, data.attendance, data.helperNotices — массивы,
    // меняются на месте). Всё, что помощнику нельзя, молча пропускается. Возвращает число внесённых изменений.
    function haApply(data, action) {
        const by = lc(action && action.by);
        if (!by || !data) return 0;
        const at = Date.parse(action.at) || Date.now();
        let n = 0;
        const tasks = tasksOf(data.ordersData);
        const notices = Array.isArray(data.helperNotices) ? data.helperNotices : (data.helperNotices = list(data.helperNotices));
        const attendance = Array.isArray(data.attendance) ? data.attendance : (data.attendance = list(data.attendance));

        list(action.changes).forEach(ch => {
            if (!ch || typeof ch !== 'object') return;
            if (ch.k === 'task') {
                const t = tasks.find(x => String(x.id) === String(ch.id) && lc(x.assignedTo) === by);
                if (!t || t.status === 'completed') return;
                if (ch.startedAt && !t.startedAt) { t.startedAt = str(ch.startedAt, 40); n++; }
                if (ch.status === 'review' && t.status !== 'review') { t.status = 'review'; t.submittedAt = str(ch.submittedAt || new Date(at).toISOString(), 40); n++; }
                const known = new Set(list(t.problems).map(problemKey));
                const add = list(ch.problems).slice(0, 10).map(p => ({ at: str(p.at, 40), text: str(p.text, 500) })).filter(p => p.text && !known.has(problemKey(p)));
                if (add.length) { t.problems = list(t.problems).concat(add).slice(-30); n++; }
            } else if (ch.k === 'att') {
                const r = ch.rec || {};
                const date = str(r.date, 10);
                // Только своя отметка «пришёл/ушёл» и только около дня заявки (не задним числом)
                if (lc(r.email) !== by || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
                if (Math.abs(Date.parse(date + 'T12:00:00Z') - at) > 1.5 * DAY) return;
                if (r.status !== 'present' && r.status !== 'late') return;
                let rec = attendance.find(x => lc(x.email) === by && x.date === date);
                // День, отмеченный админом иначе (отгул, больничный, не был), помощник не переписывает
                if (rec && rec.status && rec.status !== 'present' && rec.status !== 'late' && rec.status !== 'open') return;
                if (!rec) { rec = { id: 'att-' + r.email + '-' + date, email: r.email, date }; attendance.push(rec); }
                const before = JSON.stringify(rec);
                rec.status = r.status;
                ['in', 'out'].forEach(f => { if (/^\d{2}:\d{2}$/.test(r[f] || '')) rec[f] = r[f]; });
                rec.by = r.email;
                rec.updatedAt = str(r.updatedAt || new Date(at).toISOString(), 40);
                if (JSON.stringify(rec) !== before) n++;
            } else if (ch.k === 'notice') {
                const x = ch.n || {};
                const id = str(x.id, 60);
                if (x.to !== 'admin' || !/^ntc-/.test(id) || notices.some(m => String(m.id) === id)) return;
                notices.push({ id, to: 'admin', from: action.by, type: str(x.type, 40), message: str(x.message, 300),
                    orderNumber: x.orderNumber == null ? null : str(x.orderNumber, 20), read: false, createdAt: str(x.createdAt || new Date(at).toISOString(), 40) });
                n++;
            } else if (ch.k === 'read') {
                const m = notices.find(m => String(m.id) === String(ch.id) && lc(m.to) === by);
                if (m && !m.read) { m.read = true; n++; }
            } else if (ch.k === 'del') {
                const i = notices.findIndex(m => String(m.id) === String(ch.id) && lc(m.to) === by);
                if (i >= 0) { notices.splice(i, 1); n++; }
            }
        });
        return n;
    }

    const api = { haDiff, haApply };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : this);
