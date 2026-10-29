/* ==========================================================================
   ФИНАНСЫ: касса (реальные деньги), копилки, платежи месяца, отчёт и план.

   Распределение («водопад») за каждый месяц:
     Выручка (оплаты заказов и предоплаты по дате получения + приходы «Оплата за работу», внесённые вручную)
     − Налог (% от выручки)                         → копилка «Налог»
       Самозанятый (НПД): 4% от всех денег от частных людей, в т. ч. предоплат, по дню получения;
       бонус 10 000 ₽ у владелицы уже кончился, поэтому без вычета 1%. Налог за месяц платится до 28-го следующего.
     − Мелкие расходники (% от выручки: перчатки, палочки, ветошь, скотч…) → копилка «Мелкие расходники»
     − Материалы и помощники (по оплаченным заказам)
     = Маржинальная прибыль
     − Постоянные расходы бизнеса (платежи типа «Бизнес» + прочие бизнес-траты)
     = Прибыль бизнеса
     − Резерв (%, пока не накоплено N месяцев постоянных расходов) → «Резерв»
     − Развитие бизнеса (%)                                         → «Развитие»
     = Зарплата владельца (остаток)
     − Личные накопления (%) и инвестиции (% от зарплаты)          → копилки
     − Личные платежи (тип «Личное» + прочие личные траты)
     = Свободный остаток

   Копилки не хранятся числами: «начислено» каждый раз считается из заказов,
   «потрачено» — из расходов кассы, помеченных копилкой. Поэтому они одинаковы
   на всех устройствах и не «растут» от повторных отметок «Оплачено».
   ========================================================================== */

const FIN_DEFAULTS = {
    id: 'settings',
    taxPercent: 4,        // налог, % от выручки
    suppliesPercent: 3,   // мелкие расходники, % от выручки (их не списать на заказ, но деньги на них нужны)
    reservePercent: 10,   // резерв бизнеса, % от прибыли бизнеса
    reserveMonths: 2,     // цель резерва: столько месяцев постоянных расходов
    devPercent: 5,        // развитие бизнеса, % от прибыли бизнеса
    savingsPercent: 10,   // личные накопления, % от зарплаты владельца
    investPercent: 5      // инвестиции, % от зарплаты владельца
};

const FIN_FUNDS = {
    tax:     { name: 'Налог',              icon: '💰' },
    supplies:{ name: 'Мелкие расходники',  icon: '🧤' },
    reserve: { name: 'Резерв бизнеса',     icon: '🛟' },
    dev:     { name: 'Развитие бизнеса',   icon: '🚀' },
    savings: { name: 'Личные накопления',  icon: '👤' },
    invest:  { name: 'Инвестиции',         icon: '📈' }
};

const FIN_CATEGORIES = {
    income:    'Оплата заказа',
    materials: 'Материалы',
    purchase:  'Закупка материалов',
    helpers:   'Помощникам',
    business:  'Бизнес',
    personal:  'Личное',
    tax:       'Налог',
    other:     'Прочее'
};

const FIN_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// ========== ЧИСТЫЕ ФУНКЦИИ РАСЧЁТА (без DOM) ==========

function finNum(v) { return parseFloat(v) || 0; }
function finMonthKey(dateStr) { return String(dateStr || '').slice(0, 7); }
function finDaysInMonth(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function finShiftMonth(mk, delta) {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function finMonthTitle(mk) { const [y, m] = mk.split('-').map(Number); return `${FIN_MONTHS[m - 1]} ${y}`; }

function finSettingsFrom(list) {
    const stored = (list || []).find(s => s && s.id === 'settings');
    return { ...FIN_DEFAULTS, ...(stored || {}) };
}

// Стоимость работы помощников по заказу (задачи), иначе — поле заказа.
// Просроченная задача не оплачивается (за неё ещё и штраф), поэтому в стоимость не входит.
function finHelperCost(order) {
    let sum = 0, hasTasks = false;
    (order.services || []).forEach(s => (s.tasks || []).forEach(t => {
        hasTasks = true;
        if (t.status !== 'overdue' && t.status !== 'cancelled') sum += finNum(t.helperPay);
    }));
    return hasTasks ? sum : finNum(order.helperPay);
}

// Штрафы за просроченные задачи заказа: помощник их «возвращает» из своих начислений
function finOrderPenalties(order) {
    let sum = 0;
    (order.services || []).forEach(s => (s.tasks || []).forEach(t => {
        if (t.status === 'overdue') sum += finNum(t.penalty);
    }));
    return sum;
}

// Сколько бизнес на самом деле платит помощникам за заказ: оплата задач − штрафы по ним
function finHelperNetCost(order) {
    return finHelperCost(order) - finOrderPenalties(order);
}

// ========== НОМЕРА ЗАКАЗОВ ==========
// Следующий номер — по всем заказам (они синхронизируются), а не по счётчику устройства:
// раньше телефон и компьютер выдавали одинаковые номера, а новое устройство начинало с №1.
function finNextOrderNumber(orders, localLast) {
    const max = (orders || []).reduce((m, o) => Math.max(m, parseInt(o.orderNumber) || 0), 0);
    return Math.max(max, parseInt(localLast) || 0) + 1;
}

// Порядок создания: id — метка времени (число или строка из цифр)
function finOrderCreatedKey(order) {
    const n = Number(order.id);
    return isNaN(n) ? Infinity : n;
}

// Исправляет одинаковые номера: номер остаётся у заказа, созданного раньше,
// остальные получают следующие свободные номера. Правило однозначное — все устройства
// приходят к одной и той же нумерации. Возвращает список {id, from, to} изменённых.
function finFixDuplicateOrderNumbers(orders) {
    const byNumber = new Map();
    (orders || []).forEach(o => {
        const n = parseInt(o.orderNumber) || 0;
        if (!byNumber.has(n)) byNumber.set(n, []);
        byNumber.get(n).push(o);
    });
    const toRenumber = [];
    byNumber.forEach((list, n) => {
        if (list.length < 2 && n > 0) return;
        list.sort((a, b) => finOrderCreatedKey(a) - finOrderCreatedKey(b) || String(a.id).localeCompare(String(b.id)));
        // У номера 0 / без номера переназначаем всех, у остальных — всех, кроме первого
        toRenumber.push(...(n > 0 ? list.slice(1) : list));
    });
    if (!toRenumber.length) return [];
    toRenumber.sort((a, b) => finOrderCreatedKey(a) - finOrderCreatedKey(b) || String(a.id).localeCompare(String(b.id)));
    let next = finNextOrderNumber(orders, 0);
    return toRenumber.map(o => {
        const change = { id: o.id, from: o.orderNumber, to: next };
        o.orderNumber = next++;
        return change;
    });
}

// ========== НАЧИСЛЕНИЯ ПОМОЩНИКАМ ==========
// Начислено — оплата выполненных задач; штраф — за просроченные и выписанные отдельно
// (penalties — список helperPenalties из app.js); выплачено — расходы кассы
// «Помощникам» с этим помощником + выплаты до 25.10.2026 (paidBefore — список helperPaidBefore из app.js:
// тогда выплаты записывались только на устройстве админа и в кассу не попадали).
function finHelperPaidData(email, cash, paidBefore) {
    const fromCash = (cash || []).filter(o => o.category === 'helpers' && o.helper === email)
        .reduce((sum, o) => sum + finNum(o.expense), 0);
    const before = (paidBefore || []).filter(p => p && p.helper === email)
        .reduce((sum, p) => sum + finNum(p.amount), 0);
    return fromCash + before;
}

// Перенос старых выплат из budgetData.helperPayments (только на устройстве админа) в список paidBefore.
// id однозначный, поэтому повторный перенос ничего не задваивает. Возвращает true, если список изменился.
function finMigrateHelperPayments(budget, paidBefore) {
    const map = budget && budget.helperPayments;
    if (!map || typeof map !== 'object') return false;
    const ids = new Set(paidBefore.map(p => p.id));
    let changed = false;
    Object.keys(map).forEach(email => {
        (map[email] || []).filter(p => p && !p.cashOpId && finNum(p.amount) > 0).forEach(p => {
            const id = 'hpb-' + email + '-' + (p.date || '');
            if (!ids.has(id)) {
                paidBefore.push({ id, helper: email, amount: finNum(p.amount), date: p.date || null, paidBy: p.paidBy || null });
                ids.add(id); changed = true;
            }
        });
    });
    return changed;
}

function finHelperAccrualsData(orders, cash, paidBefore, mk, penalties) {
    const byHelper = new Map();
    const get = email => {
        if (!byHelper.has(email)) byHelper.set(email, { email, earned: 0, penalties: 0, done: 0, overdue: 0, pending: 0, pendingPay: 0, review: 0, reviewPay: 0, monthEarned: 0, monthDone: 0 });
        return byHelper.get(email);
    };
    (orders || []).forEach(order => (order.services || []).forEach(s => (s.tasks || []).forEach(t => {
        if (!t.assignedTo) return;
        const h = get(t.assignedTo);
        if (t.status === 'completed') {
            h.earned += finNum(t.helperPay); h.done++;
            if (mk && finMonthKey(t.completedAt) === mk) { h.monthEarned += finNum(t.helperPay); h.monthDone++; }
        } else if (t.status === 'overdue') {
            h.penalties += finNum(t.penalty); h.overdue++;
        } else if (t.status === 'review') {
            // Помощник отметил выполненной, ждёт подтверждения админа — ещё не начислено
            h.review++; h.reviewPay += finNum(t.helperPay);
        } else {
            h.pending++; h.pendingPay += finNum(t.helperPay);
        }
    })));
    (penalties || []).forEach(p => { if (p && p.helperEmail) get(p.helperEmail).penalties += finNum(p.amount); });
    // Помощники, которым платили, но задач уже нет
    (cash || []).forEach(o => { if (o.category === 'helpers' && o.helper) get(o.helper); });
    (paidBefore || []).forEach(p => { if (p && p.helper) get(p.helper); });
    return [...byHelper.values()].map(h => {
        const paid = finHelperPaidData(h.email, cash, paidBefore);
        const net = h.earned - h.penalties;
        return { ...h, paid, net, owed: net - paid };
    }).sort((a, b) => b.owed - a.owed);
}

// Операция кассы «оплата заказа»: приход по каждому оплаченному заказу
function finIncomeOpId(order) { return 'inc-' + order.id; }

// Предоплаты заказа: order.prepayments = [{ id, date, amount }]
function finPrepayments(order) {
    return (Array.isArray(order.prepayments) ? order.prepayments : []).filter(p => p && p.id && finNum(p.amount) > 0);
}
function finPrepayOpId(order, p) { return 'pre-' + order.id + '-' + p.id; }
function finPrepaidSum(order) { return finPrepayments(order).reduce((sum, p) => sum + finNum(p.amount), 0); }
// Сколько клиент ещё должен: у оплаченного 0, иначе цена минус предоплаты
function finOrderRemaining(order) {
    if (order.paid === true || order.paid === 'true') return 0;
    return Math.max(0, finNum(order.clientPrice) - finPrepaidSum(order));
}

// Плановая дата платежа в месяце (31-е в коротком месяце → последний день)
function finPaymentDate(payment, mk) {
    const day = Math.min(Math.max(1, parseInt(payment.day) || 1), finDaysInMonth(mk));
    return `${mk}-${String(day).padStart(2, '0')}`;
}

// Статус платежа в месяце: оплачен (операция кассы с paymentId и month) / просрочен / к оплате
function finPaymentStatus(payment, mk, cash, today) {
    const op = (cash || []).find(o => o.paymentId === payment.id && o.month === mk);
    const due = finPaymentDate(payment, mk);
    if (op) return { state: 'paid', op, due };
    if (today && due < today) return { state: 'overdue', due };
    return { state: 'due', due };
}

// Остаток долга по платежу: сумма долга − выплачено до учёта − все оплаты в кассе
function finDebtRemaining(payment, cash) {
    if (!finNum(payment.debtTotal)) return null;
    const paid = (cash || []).filter(o => o.paymentId === payment.id).reduce((s, o) => s + finNum(o.expense), 0);
    return Math.max(0, finNum(payment.debtTotal) - finNum(payment.debtPaidBefore) - paid);
}

/**
 * Помесячный расчёт «водопада» и копилок.
 * data: { orders, cash, payments, settings, getOrderCost, today, penalties?, fromMonth?, toMonth? }
 * penalties — штрафы, выписанные помощникам отдельно (helperPenalties): уменьшают «Помощникам» в месяце штрафа
 * Возвращает { months: {mk: {...}}, funds: {key: {accrued, spent, balance}}, reserveTarget }
 */
function finCompute(data) {
    const s = data.settings;
    const t = s.taxPercent / 100, r = s.reservePercent / 100, d = s.devPercent / 100;
    const sv = s.savingsPercent / 100, iv = s.investPercent / 100, sp = finNum(s.suppliesPercent) / 100;
    const ordersById = new Map((data.orders || []).map(o => [String(o.id), o]));
    const cash = data.cash || [];
    const payments = data.payments || [];

    const fixedPlanned = payments.filter(p => p.type === 'business').reduce((sum, p) => sum + finNum(p.amount), 0);
    const personalPlanned = payments.filter(p => p.type === 'personal').reduce((sum, p) => sum + finNum(p.amount), 0);
    const reserveTarget = fixedPlanned * s.reserveMonths;

    // Месяцы от первой оплаты заказа до текущего (раньше бизнес в приложении не вёлся —
    // иначе каждый «пустой» месяц показывал бы убыток на сумму всех плановых платежей)
    const todayMk = finMonthKey(data.today);
    const incomeMonths = cash.filter(o => o.category === 'income' && o.date).map(o => finMonthKey(o.date)).sort();
    const firstMk = incomeMonths.length && incomeMonths[0] < todayMk ? incomeMonths[0] : todayMk;
    const lastMk = [todayMk, data.toMonth || todayMk, incomeMonths[incomeMonths.length - 1] || todayMk].sort().pop();
    const months = [];
    for (let mk = firstMk; mk <= lastMk; mk = finShiftMonth(mk, 1)) months.push(mk);

    const spentBefore = (fund, mkLimit) => cash
        .filter(o => o.fund === fund && finMonthKey(o.date) < mkLimit)
        .reduce((sum, o) => sum + finNum(o.expense), 0);

    const result = { months: {}, funds: {}, reserveTarget, fixedPlanned, personalPlanned };
    Object.keys(FIN_FUNDS).forEach(k => { result.funds[k] = { accrued: 0, spent: 0, balance: 0 }; });

    let reserveAccrued = 0;
    months.forEach(mk => {
        const inMonth = o => finMonthKey(o.date) === mk;
        // Выручка — приходы «оплата заказа» в этом месяце
        const incomeOps = cash.filter(o => inMonth(o) && o.category === 'income');
        const revenue = incomeOps.reduce((sum, o) => sum + finNum(o.income), 0);
        // Переменные расходы — по тем же заказам (один раз — по приходу «оплата заказа», не по предоплатам)
        let materials = 0, helpers = 0, helperPenalties = 0;
        const finalOps = incomeOps.filter(o => !o.prepay);
        finalOps.forEach(o => {
            const order = ordersById.get(String(o.orderId));
            if (!order) return;
            materials += data.getOrderCost(order);
            helpers += finHelperCost(order);
            helperPenalties += finOrderPenalties(order);
        });
        // Штрафы помощникам — бизнес столько не платит: за просрочку по оплаченным заказам и выписанные в этом месяце
        (data.penalties || []).forEach(p => { if (p && finMonthKey(p.createdAt) === mk) helperPenalties += finNum(p.amount); });
        helpers -= helperPenalties;
        // Налог считается с копейками, как в «Мой налог»
        const tax = Math.round(revenue * t * 100) / 100;
        const supplies = Math.round(revenue * sp * 100) / 100;
        const marginal = revenue - tax - supplies - materials - helpers;
        // Постоянные расходы бизнеса: план по платежам + прочие траты бизнеса, не из копилок
        const extraOps = cash.filter(o => inMonth(o) && !o.paymentId && !o.fund && finNum(o.expense) > 0);
        const otherBusiness = extraOps.filter(o => o.category === 'business' || o.category === 'other' || !o.category)
            .reduce((sum, o) => sum + finNum(o.expense), 0);
        const otherPersonal = extraOps.filter(o => o.category === 'personal').reduce((sum, o) => sum + finNum(o.expense), 0);
        const fixed = fixedPlanned + otherBusiness;
        const businessProfit = marginal - fixed;

        let reserve = 0, dev = 0, salary = businessProfit;
        if (businessProfit > 0) {
            const reserveBalance = reserveAccrued - spentBefore('reserve', mk);
            reserve = Math.min(businessProfit * r, Math.max(0, reserveTarget - reserveBalance));
            dev = businessProfit * d;
            salary = businessProfit - reserve - dev;
        }
        reserveAccrued += reserve;
        const savings = salary > 0 ? salary * sv : 0;
        const invest = salary > 0 ? salary * iv : 0;
        const personal = personalPlanned + otherPersonal;
        const free = salary - savings - invest - personal;

        result.months[mk] = {
            revenue, tax, supplies, materials, helpers, helperPenalties, marginal, fixed, otherBusiness, businessProfit,
            reserve, dev, salary, savings, invest, personal, otherPersonal, free,
            ordersPaid: finalOps.length
        };
        const f = result.funds;
        f.tax.accrued += tax; f.supplies.accrued += supplies; f.reserve.accrued += reserve; f.dev.accrued += dev;
        f.savings.accrued += savings; f.invest.accrued += invest;
    });

    Object.keys(result.funds).forEach(k => {
        const fund = result.funds[k];
        fund.spent = cash.filter(o => o.fund === k).reduce((sum, o) => sum + finNum(o.expense), 0);
        fund.balance = fund.accrued - fund.spent;
    });
    return result;
}

// Сумма «водопада» за период из нескольких месяцев
function finSumMonths(computed, fromMk, toMk) {
    const keys = ['revenue', 'tax', 'supplies', 'materials', 'helpers', 'helperPenalties', 'marginal', 'fixed', 'businessProfit',
        'reserve', 'dev', 'salary', 'savings', 'invest', 'personal', 'free', 'ordersPaid'];
    const sum = {};
    keys.forEach(k => { sum[k] = 0; });
    Object.keys(computed.months).forEach(mk => {
        if (mk < fromMk || mk > toMk) return;
        keys.forEach(k => { sum[k] += computed.months[mk][k]; });
    });
    return sum;
}

/**
 * План месяца: сколько нужно выручки, чтобы покрыть бизнес- и личные платежи,
 * отложить в резерв/развитие и личные копилки.
 */
function finPlan(computed, settings, mk, today) {
    const s = settings;
    const t = s.taxPercent / 100 + finNum(s.suppliesPercent) / 100; // налог и мелкие расходники — доли выручки
    const d = s.devPercent / 100, sv = s.savingsPercent / 100, iv = s.investPercent / 100;
    const reserveFull = computed.funds.reserve.balance >= computed.reserveTarget && computed.reserveTarget > 0;
    const r = reserveFull ? 0 : s.reservePercent / 100;

    // Доля материалов и помощников в выручке — по последним 3 месяцам с выручкой
    let rev = 0, varCost = 0, n = 0;
    Object.keys(computed.months).sort().reverse().forEach(k => {
        const m = computed.months[k];
        if (n < 3 && m.revenue > 0) { rev += m.revenue; varCost += m.materials + m.helpers; n++; }
    });
    const variableShare = rev > 0 ? Math.min(0.9, varCost / rev) : 0.15;

    const F = computed.fixedPlanned, P = computed.personalPlanned;
    const salaryNeeded = P / Math.max(0.05, 1 - sv - iv);
    const profitNeeded = salaryNeeded / Math.max(0.05, 1 - r - d);
    const revenueNeeded = (F + profitNeeded) / Math.max(0.05, 1 - t - variableShare);

    const m = computed.months[mk] || { revenue: 0 };
    const days = finDaysInMonth(mk);
    const todayMk = finMonthKey(today);
    let daysPassed = days;
    if (mk === todayMk) daysPassed = Math.max(1, parseInt(String(today).slice(8, 10)) || 1);
    else if (mk > todayMk) daysPassed = 0;
    const projected = daysPassed > 0 ? m.revenue / daysPassed * days : 0;

    return {
        revenueNeeded, profitNeeded, salaryNeeded, variableShare, reserveFull,
        actual: m.revenue, projected,
        progress: revenueNeeded > 0 ? Math.min(100, m.revenue / revenueNeeded * 100) : 0,
        shortfall: Math.max(0, revenueNeeded - m.revenue),
        perDayNeeded: (mk === todayMk && days - daysPassed > 0) ? Math.max(0, revenueNeeded - m.revenue) / (days - daysPassed + 1) : 0
    };
}

/**
 * Приводит кассу в соответствие с заказами (вызывается при каждом сохранении):
 *  - у оплаченного заказа есть ровно один приход «оплата заказа» на его сумму;
 *  - у неоплаченного или удалённого заказа такого прихода нет.
 * migration=true — для заказов, оплаченных до появления даты оплаты, датой считается дата заказа.
 * Возвращает true, если что-то изменилось.
 */
function finReconcileData(orders, cash, today, migration) {
    let changed = false;
    // id прихода → { date, desc, amount, orderId, prepay }: какие приходы по заказам должны быть в кассе
    const expected = new Map();
    orders.forEach(order => {
        const isPaid = order.paid === true || order.paid === 'true';
        const client = order.client || 'без клиента';
        // Предоплаты — свой приход на дату внесения, остаются и у неоплаченного заказа
        finPrepayments(order).forEach(p => expected.set(finPrepayOpId(order, p), {
            date: p.date || today, amount: finNum(p.amount), prepay: true, orderId: String(order.id),
            desc: `Предоплата по заказу №${order.orderNumber} (${client})`
        }));
        if (isPaid) {
            if (!order.paidAt) { order.paidAt = migration ? (order.date || today) : today; changed = true; }
            // Приход «оплата заказа» есть всегда (даже 0 ₽ при полной предоплате): по нему считаются материалы и помощники
            const prepaid = finPrepaidSum(order);
            expected.set(finIncomeOpId(order), {
                date: order.paidAt, amount: Math.max(0, finNum(order.clientPrice) - prepaid), orderId: String(order.id),
                desc: prepaid > 0 ? `Доплата по заказу №${order.orderNumber} (${client})` : `Оплата заказа №${order.orderNumber} (${client})`
            });
        } else if (order.paidAt) {
            delete order.paidAt; changed = true;
        }
    });
    // Убираем приходы по неоплаченным/удалённым заказам и отменённым предоплатам
    for (let i = cash.length - 1; i >= 0; i--) {
        const op = cash[i];
        if (op.category === 'income' && op.orderId != null && !expected.has(op.id)) { cash.splice(i, 1); changed = true; }
    }
    // Добавляем/обновляем приходы
    expected.forEach((e, id) => {
        const op = cash.find(o => o.id === id);
        if (!op) {
            cash.push({ id, date: e.date, desc: e.desc, income: e.amount, expense: 0, category: 'income', orderId: e.orderId, ...(e.prepay ? { prepay: true } : {}) });
            changed = true;
        } else if (finNum(op.income) !== e.amount || op.desc !== e.desc || (e.prepay && op.date !== e.date)) {
            op.income = e.amount; op.desc = e.desc; if (e.prepay) op.date = e.date; changed = true;
        }
    });
    return changed;
}

// Старые записи распределения («Налог 4% №5 (Иванов)» и т. п.) — это были не траты
const FIN_LEGACY_DISTRIBUTION = /^(Налог 4%|Личные расходы|Бизнес|Инвестиции|Обязательный платёж: .+) №\d+ \(.*\)$/;

// Старый приход «Оплата заказа №N» без категории: теперь приход по оплаченному заказу
// создаётся автоматически (finReconcileData), иначе оплата посчиталась бы дважды
const FIN_LEGACY_ORDER_INCOME = /^Оплата заказа №\d+/;

function finRemoveLegacyDistribution(cash) {
    let changed = false;
    for (let i = cash.length - 1; i >= 0; i--) {
        const op = cash[i], desc = op.desc || '';
        if (op.category) continue;
        if (FIN_LEGACY_DISTRIBUTION.test(desc) || (FIN_LEGACY_ORDER_INCOME.test(desc) && finNum(op.income) > 0)) {
            cash.splice(i, 1); changed = true;
        }
    }
    return changed;
}

// Перенос старых «обязательных платежей» и «долгов» в платежи месяца
const FIN_BUSINESS_IDS = ['rent_place', 'mobile', 'marketing'];
function finPaymentsFromLegacy(budget) {
    if (!budget || !Array.isArray(budget.mandatoryPayments)) return [];
    const debts = Array.isArray(budget.debts) ? budget.debts : [];
    return budget.mandatoryPayments.map(mp => {
        const debt = debts.find(dbt => dbt.id === mp.id);
        const item = {
            id: 'pay-' + mp.id,
            name: mp.name,
            amount: finNum(mp.amount || mp.target),
            day: parseInt(mp.day) || 1,
            type: FIN_BUSINESS_IDS.includes(mp.id) ? 'business' : 'personal',
            icon: mp.icon || '📌'
        };
        if (debt && finNum(debt.total)) { item.debtTotal = finNum(debt.total); item.debtPaidBefore = finNum(debt.paid); }
        return item;
    });
}

// ========== СВЯЗЬ С ПРИЛОЖЕНИЕМ ==========
// Переменные ordersData, cashOps, payments, financeSettings объявлены в app.js (общая глобальная область).

function finTodayStr() { return formatDate(new Date()); }
function finSettings() { return finSettingsFrom(financeSettings); }

function finComputeNow() {
    return finCompute({
        orders: ordersData, cash: cashOps, payments, settings: finSettings(),
        getOrderCost, today: finTodayStr(), penalties: finHelperPenalties()
    });
}

// Вызывается из saveAll: касса всегда соответствует отметкам «Оплачено»
function finReconcile() {
    return finReconcileData(ordersData, cashOps, finTodayStr(), false);
}

/**
 * Одноразовый перенос старых данных. fromCloud=true — после загрузки из облака:
 * тогда же переносим старые обязательные платежи, если в облаке ещё нет новых.
 * Возвращает true, если данные изменились (их нужно отправить в облако).
 */
function finMigrate(fromCloud) {
    let changed = false;
    const firstRun = !localStorage.getItem('fin_migrated_v1');
    if (finRemoveLegacyDistribution(cashOps)) changed = true;
    if (finReconcileData(ordersData, cashOps, finTodayStr(), firstRun)) changed = true;
    if (firstRun) localStorage.setItem('fin_migrated_v1', '1');
    if (fromCloud && (!payments || payments.length === 0) && typeof budgetData !== 'undefined' && budgetData) {
        const migrated = finPaymentsFromLegacy(budgetData);
        if (migrated.length) { payments = migrated; changed = true; }
    }
    return changed;
}

// ========== ВКЛАДКА «ДЕНЬГИ» ==========
let finPaymentsMonth = null;
let finCashDay = null; // выбранный день в «Касса за день»; null — сегодня

// Касса за день: все операции этой даты, приход и расход
function finCashDayData(cash, day) {
    const ops = cash.filter(o => o.date === day);
    return {
        ops,
        income: ops.reduce((sum, o) => sum + finNum(o.income), 0),
        expense: ops.reduce((sum, o) => sum + finNum(o.expense), 0)
    };
}
function finSetCashDay(delta) {
    const d = new Date((finCashDay || finTodayStr()) + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    finCashDay = formatDate(d);
    renderFinance();
}

// Раздел вкладки «Деньги»: заголовок нажимается — раздел сворачивается/разворачивается.
// Что открыто — помнит устройство (fin_open_<key>); по умолчанию открыты только касса за день и платежи.
const FIN_OPEN_DEFAULT = { day: true, payments: true };
function finSectionOpen(key) {
    try { const v = localStorage.getItem('fin_open_' + key); if (v !== null) return v === '1'; } catch (e) {}
    return !!FIN_OPEN_DEFAULT[key];
}
function finToggleSection(key, open) {
    try { localStorage.setItem('fin_open_' + key, open ? '1' : '0'); } catch (e) {}
}
function finSection(key, title, aside, body) {
    return `<details class="fin-section" ${finSectionOpen(key) ? 'open' : ''} ontoggle="finToggleSection('${key}', this.open)">
        <summary class="fin-section-head"><span>${title}</span>${aside ? `<span class="fin-section-aside">${aside}</span>` : ''}</summary>
        <div class="fin-section-body">${body}</div>
    </details>`;
}

// Разделы в разметке (вкладка «Помощники»): <details data-key="…" data-open="1"> — то же запоминание
function finInitStaticSections() {
    document.querySelectorAll('details[data-key]').forEach(d => {
        const key = d.dataset.key;
        if (d.dataset.open === '1' && !(key in FIN_OPEN_DEFAULT)) FIN_OPEN_DEFAULT[key] = true;
        d.open = finSectionOpen(key);
        d.addEventListener('toggle', () => finToggleSection(key, d.open));
    });
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', finInitStaticSections);

// Налог самозанятого: за прошлый месяц платится до 28-го текущего.
// Возвращает { mk, amount, due, paid } — сумма налога прошлого месяца и сколько из копилки «Налог» уже заплачено после его конца
function finTaxToPay(computed, today) {
    const mk = finShiftMonth(finMonthKey(today), -1);
    const amount = (computed.months[mk] || {}).tax || 0;
    const due = `${finMonthKey(today)}-28`;
    const paid = cashOps.filter(o => (o.fund === 'tax' || o.category === 'tax') && finMonthKey(o.date) === finMonthKey(today))
        .reduce((sum, o) => sum + finNum(o.expense), 0);
    return { mk, amount, due, paid, left: Math.max(0, Math.round(amount) - paid) };
}

function renderFinance() {
    const root = document.getElementById('financeRoot');
    if (!root) return;
    const today = finTodayStr();
    if (!finPaymentsMonth) finPaymentsMonth = finMonthKey(today);
    const mk = finPaymentsMonth;
    const computed = finComputeNow();
    const balance = cashOps.reduce((sum, o) => sum + finNum(o.income) - finNum(o.expense), 0);
    const fundsTotal = Object.values(computed.funds).reduce((sum, f) => sum + Math.max(0, f.balance), 0);
    const free = balance - fundsTotal;

    // --- Сводка (всегда видна) ---
    const taxDue = finTaxToPay(computed, today);
    const curTax = (computed.months[finMonthKey(today)] || {}).tax || 0;
    let html = `
        <div class="fin-cards">
            <div class="fin-card"><div class="fin-card-label">💵 В кассе</div><div class="fin-card-value ${balance < 0 ? 'neg' : ''}">${formatMoney(balance)}</div></div>
            <div class="fin-card"><div class="fin-card-label">🐷 Отложено в копилках</div><div class="fin-card-value">${formatMoney(fundsTotal)}</div></div>
            <div class="fin-card"><div class="fin-card-label">✅ Можно тратить</div><div class="fin-card-value ${free < 0 ? 'neg' : 'pos'}">${formatMoney(free)}</div></div>
        </div>
        ${free < 0 ? `<div class="fin-warn">⚠️ Денег в кассе меньше, чем должно лежать в копилках, — не хватает ${formatMoney(-free)}.</div>` : ''}
        <div class="fin-tax-line">
            ${taxDue.left > 0
                ? `💰 Налог за ${finMonthTitle(taxDue.mk).toLowerCase()}: <b>${formatMoney(taxDue.left)}</b> — заплатить до ${formatDateDDMMYYYY(taxDue.due)} в «Мой налог»
                   <button class="fin-pay-btn" onclick="openAddCashModal({fund:'tax', amount:${taxDue.left}, desc:'Налог НПД за ${finMonthTitle(taxDue.mk).toLowerCase()}'})">Заплатила</button>`
                : taxDue.amount > 0 ? `💰 Налог за ${finMonthTitle(taxDue.mk).toLowerCase()} оплачен ✅` : `💰 Налога за ${finMonthTitle(taxDue.mk).toLowerCase()} нет`}
            <span class="fin-muted"> · за этот месяц уже набежало ${formatMoney(curTax)}</span>
        </div>`;

    // --- Касса за день ---
    const day = finCashDay || today;
    const dayData = finCashDayData(cashOps, day);
    html += finSection('day', '📅 Касса за день', `${formatMoney(dayData.income - dayData.expense)}`, `
            <div class="fin-day-nav">
                <button onclick="finSetCashDay(-1)" title="Предыдущий день">◀</button>
                <input type="date" id="finCashDayInput" value="${day}" onchange="finCashDay = this.value || null; renderFinance()">
                <button onclick="finSetCashDay(1)" title="Следующий день">▶</button>
                ${day !== today ? `<button onclick="finCashDay = null; renderFinance()">Сегодня</button>` : ''}
            </div>
            <div class="fin-day-totals">
                <div><span>➕ Пришло</span><b class="pos">${formatMoney(dayData.income)}</b></div>
                <div><span>➖ Ушло</span><b class="neg">${formatMoney(dayData.expense)}</b></div>
                <div><span>= Итог дня</span><b class="${dayData.income - dayData.expense < 0 ? 'neg' : ''}">${formatMoney(dayData.income - dayData.expense)}</b></div>
            </div>
            ${dayData.ops.length ? dayData.ops.map(o => `<div class="fin-op"><div>${safeHTML(o.desc)}</div>
                <b class="${finNum(o.income) > 0 ? 'pos' : 'neg'}">${finNum(o.income) > 0 ? '+' + formatMoney(o.income) : '−' + formatMoney(o.expense)}</b><span></span></div>`).join('')
                : `<div class="fin-muted">В этот день денег не было</div>`}`);

    // --- Кто сколько должен ---
    const debtors = ordersData.filter(o => finOrderRemaining(o) > 0)
        .sort((a, b) => finOrderRemaining(b) - finOrderRemaining(a));
    const debtTotal = debtors.reduce((sum, o) => sum + finOrderRemaining(o), 0);
    html += finSection('debtors', '🧾 Кто сколько должен', debtTotal > 0 ? `<b class="neg">${formatMoney(debtTotal)}</b>` : 'никто', `
            ${debtors.length ? debtors.slice(0, 15).map(o => `<div class="fin-pay fin-due"><div class="fin-pay-main">
                <span class="fin-pay-name">№${safeHTML(o.orderNumber)} ${safeHTML(o.client || '')}${o.phone ? ' · ' + safeHTML(o.phone) : ''}</span>
                <b class="neg">${formatMoney(finOrderRemaining(o))}</b></div>
                <div class="fin-pay-sub"><span>цена ${formatMoney(o.clientPrice)}${finPrepaidSum(o) ? ` · внесено ${formatMoney(finPrepaidSum(o))}` : ''}${o.done === true || o.done === 'true' ? ' · заказ выполнен' : ''}</span>
                <span class="fin-pay-actions"><button onclick="openOrderModal(${escAttr(JSON.stringify(o.id))})">Открыть</button></span></div></div>`).join('')
                : `<div class="fin-muted">Все заказы оплачены</div>`}
            ${debtors.length > 15 ? `<div class="fin-muted">и ещё ${debtors.length - 15} — фильтр «💳 Не оплачено» во вкладке «Заказы»</div>` : ''}`);

    // --- Помощникам: начислено, штрафы, выплачено, к выплате ---
    const helpers = finHelperAccrualsData(ordersData, cashOps, finHelperPaidBefore(), mk, finHelperPenalties());
    const owedTotal = helpers.reduce((sum, h) => sum + Math.max(0, h.owed), 0);
    let helpersHTML = '';
    if (!helpers.length) helpersHTML += `<div class="fin-muted">Задач помощникам ещё не было</div>`;
    helpers.forEach(h => {
        const how = finPayLink(h.email), qr = finPayQr(h.email);
        helpersHTML += `
            <div class="fin-pay ${h.owed > 0 ? 'fin-due' : 'fin-paid'}">
                <div class="fin-pay-main">
                    <span class="fin-pay-name">👷 ${safeHTML(finHelperName(h.email))}</span>
                    <b class="${h.owed > 0 ? 'neg' : ''}">${h.owed > 0 ? 'к выплате ' + formatMoney(h.owed) : h.owed < 0 ? 'переплата ' + formatMoney(-h.owed) : h.net > 0 ? 'всё выплачено' : 'пока не начислено'}</b>
                </div>
                <div class="fin-pay-sub">
                    <span>
                        за ${finMonthTitle(mk).toLowerCase()}: ${formatMoney(h.monthEarned)} (задач ${h.monthDone})<br>
                        всего начислено ${formatMoney(h.earned)} (задач ${h.done})${h.penalties ? ` − штрафы ${formatMoney(h.penalties)} (${h.overdue})` : ''} · выплачено ${formatMoney(h.paid)}
                        ${h.review ? `<br>🕓 на проверке: задач ${h.review} на ${formatMoney(h.reviewPay)} — подтвердите во вкладке «Задачи»` : ''}
                        ${h.pending ? `<br>в работе: задач ${h.pending} на ${formatMoney(h.pendingPay)}` : ''}
                    </span>
                    <span class="fin-pay-actions">
                        ${h.owed > 0 ? `<button class="fin-pay-btn" onclick="finPayHelper('${escAttr(h.email)}')">Выплатить</button>` : ''}
                        <button class="fin-link-btn" onclick="finSetPayLink('${escAttr(h.email)}')" title="Ссылка для перевода из банка помощника или номер СБП">${!how ? '🔗 как переводить?' : finIsPayPhone(how) ? '📱 номер СБП ✓' : '🔗 ссылка банка ✓'}</button>
                        <button class="fin-link-btn" onclick="finPickPayQr('${escAttr(h.email)}')" title="Картинка QR-кода из банка помощника">${qr ? '🔳 QR ✓' : '🔳 QR-код'}</button>
                    </span>
                </div>
            </div>`;
    });
    html += finSection('helpers', '👷 Помощникам', owedTotal > 0 ? `к выплате <b class="neg">${formatMoney(owedTotal)}</b>` : 'долгов нет', helpersHTML);

    // --- Платежи месяца ---
    const groups = { business: '🏢 Бизнес', personal: '🏠 Личное' };
    const mTotals = finMonthPaymentsTotals(mk);
    let payHTML = `
        <div class="fin-month-nav">
            <button onclick="finSetMonth(-1)">◀</button><b>${finMonthTitle(mk)}</b><button onclick="finSetMonth(1)">▶</button>
            <button class="btn-add fin-add" onclick="openPaymentModal()">➕ Платёж</button>
        </div>`;
    Object.keys(groups).forEach(type => {
        const list = payments.filter(p => p.type === type).sort((a, b) => (parseInt(a.day) || 0) - (parseInt(b.day) || 0));
        const total = list.reduce((sum, p) => sum + finNum(p.amount), 0);
        const paidSum = list.filter(p => finPaymentStatus(p, mk, cashOps, today).state === 'paid').reduce((sum, p) => sum + finNum(p.amount), 0);
        payHTML += `<div class="fin-group"><div class="fin-group-head"><b>${groups[type]}</b><span>оплачено ${formatMoney(paidSum)} из ${formatMoney(total)}</span></div>`;
        if (!list.length) payHTML += `<div class="fin-muted">Нет платежей</div>`;
        list.forEach(p => {
            const st = finPaymentStatus(p, mk, cashOps, today);
            const debt = finDebtRemaining(p, cashOps);
            const label = st.state === 'paid' ? `✅ оплачено ${formatDateDDMMYYYY(st.op.date)}`
                : st.state === 'overdue' ? `🔴 просрочен с ${formatDateDDMMYYYY(st.due)}` : `🕒 до ${formatDateDDMMYYYY(st.due)}`;
            payHTML += `
                <div class="fin-pay fin-${st.state}">
                    <div class="fin-pay-main">
                        <span class="fin-pay-name">${safeHTML(p.icon || '📌')} ${safeHTML(p.name)}</span>
                        <b>${formatMoney(p.amount)}</b>
                    </div>
                    <div class="fin-pay-sub">
                        <span>${label}${debt !== null ? ` · долг: осталось ${formatMoney(debt)}${finNum(p.amount) > 0 && debt > 0 ? ` (~${Math.ceil(debt / finNum(p.amount))} мес.)` : ''}` : ''}</span>
                        <span class="fin-pay-actions">
                            ${st.state === 'paid'
                                ? `<button onclick="finUnpay('${escAttr(p.id)}')">Отменить</button>`
                                : `<button class="fin-pay-btn" onclick="finPay('${escAttr(p.id)}')">Оплатил</button>`}
                            <button onclick="openPaymentModal('${escAttr(p.id)}')" title="Изменить">✏️</button>
                            <button onclick="finDeletePayment('${escAttr(p.id)}')" title="Удалить">🗑️</button>
                        </span>
                    </div>
                </div>`;
        });
        payHTML += `</div>`;
    });
    html += finSection('payments', `📌 Платежи месяца · ${finMonthTitle(mk).toLowerCase()}`,
        mTotals.left > 0 ? `осталось <b class="neg">${formatMoney(mTotals.left)}</b>` : 'всё оплачено ✅', payHTML);

    // --- Копилки (после платежей месяца) ---
    let fundsHTML = `<div class="fin-muted fin-funds-help">Как наполняются: с каждой оплаты заказа и с прихода «Оплата за работу» сразу откладывается налог ${finSettings().taxPercent}% и мелкие расходники ${finNum(finSettings().suppliesPercent)}%. Резерв и развитие — % от прибыли месяца (выручка − налог − расходники − материалы − помощники − платежи «Бизнес»), если она больше нуля. Личные накопления и инвестиции — % от остатка (зарплаты владельца). Подробно — вкладка «Итоги».</div>
        <div class="fin-funds">`;
    Object.keys(FIN_FUNDS).forEach(key => {
        const f = computed.funds[key], meta = FIN_FUNDS[key];
        const target = key === 'reserve' && computed.reserveTarget > 0
            ? `<div class="fin-progress"><div style="width:${Math.min(100, f.balance / computed.reserveTarget * 100)}%"></div></div>
               <div class="fin-muted">цель ${formatMoney(computed.reserveTarget)} (${finSettings().reserveMonths} мес. постоянных расходов)</div>` : '';
        fundsHTML += `
            <div class="fin-fund">
                <div class="fin-fund-head"><span>${meta.icon} ${meta.name}</span><b class="${f.balance < 0 ? 'neg' : ''}">${formatMoney(f.balance)}</b></div>
                <div class="fin-muted">начислено ${formatMoney(f.accrued)} · потрачено ${formatMoney(f.spent)}</div>
                ${target}
                <button class="fin-link" onclick="openAddCashModal({fund:'${key}'})">− Потратить из копилки</button>
            </div>`;
    });
    fundsHTML += `</div>`;
    html += finSection('funds', '🐷 Копилки', formatMoney(fundsTotal), fundsHTML);

    // --- Операции ---
    const monthOps = cashOps.filter(o => finMonthKey(o.date) === mk)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    let opsHTML = `<button class="btn-add" onclick="openAddCashModal()">➕ Добавить операцию</button><div class="fin-ops">`;
    if (!monthOps.length) opsHTML += `<div class="fin-muted">Операций в этом месяце нет</div>`;
    monthOps.forEach(o => {
        const idx = cashOps.indexOf(o);
        const isIncome = finNum(o.income) > 0;
        const cat = o.category === 'income' && o.orderId == null ? 'Оплата за работу (вручную)' : FIN_CATEGORIES[o.category] || (isIncome ? 'Приход' : 'Прочее');
        const fund = o.fund && FIN_FUNDS[o.fund] ? ` · из копилки «${FIN_FUNDS[o.fund].name}»` : '';
        // Приходы по заказам и оплаты платежей меняются там же (заказ, «Отменить») — здесь не удаляются
        const locked = (o.category === 'income' && o.orderId != null) || o.paymentId;
        opsHTML += `
            <div class="fin-op">
                <div><div>${safeHTML(o.desc)}</div><div class="fin-muted">${formatDateDDMMYYYY(o.date)} · ${cat}${fund}</div></div>
                <b class="${isIncome ? 'pos' : 'neg'}">${isIncome ? '+' : '−'}${formatMoney(isIncome ? o.income : o.expense)}</b>
                ${locked ? '<span></span>' : `<button class="btn-del" onclick="deleteCashOp(${idx})" title="Удалить">🗑️</button>`}
            </div>
            ${isIncome && o.category === 'other' && o.orderId == null ? `<div class="fin-op-fix">Этот приход не попал в налог и копилки. <button class="fin-link-btn" onclick="finMakeRevenue('${escAttr(o.id)}')">💼 Это оплата за работу — распределить</button></div>` : ''}`;
    });
    opsHTML += `</div>`;
    html += finSection('ops', `💵 Операции · ${finMonthTitle(mk).toLowerCase()}`, `${monthOps.length}`, opsHTML);

    // --- Настройки распределения ---
    const s = finSettings();
    const field = (key, label) => `<label class="fin-set"><span>${label}</span><input type="number" min="0" max="100" step="0.5" value="${finNum(s[key])}" onchange="finSaveSetting('${key}', this.value)"></label>`;
    html += finSection('settings', '⚙️ Настройки распределения', '', `
            ${field('taxPercent', 'Налог, % от выручки (самозанятый с частными людьми — 4)')}
            ${field('suppliesPercent', 'Мелкие расходники, % от выручки (перчатки, палочки…)')}
            ${field('reservePercent', 'Резерв бизнеса, % от прибыли бизнеса')}
            ${field('reserveMonths', 'Цель резерва, месяцев постоянных расходов')}
            ${field('devPercent', 'Развитие бизнеса, % от прибыли бизнеса')}
            ${field('savingsPercent', 'Личные накопления, % от зарплаты')}
            ${field('investPercent', 'Инвестиции, % от зарплаты')}
            <div class="fin-muted">Зарплата владельца — остаток прибыли бизнеса после резерва и развития.
            Мелкие расходники: начните с 3% и раз в 2–3 месяца сравните «начислено» и «потрачено» в копилке — если тратите больше, поднимите процент.</div>`);

    root.innerHTML = html;
}

// Имя помощника: из списков выбора помощника («Имя (email)»), иначе часть email до @
function finHelperName(email) {
    const option = [...document.querySelectorAll('option')].find(o => o.value === email && o.textContent.includes('('));
    if (option) return option.textContent.replace(/\s*\([^)]*\)\s*$/, '').trim() || email;
    return String(email).split('@')[0];
}

// Выписанные админом штрафы (helperPenalties из app.js; в тестах может не быть)
function finHelperPenalties() {
    return typeof helperPenalties !== 'undefined' ? helperPenalties : [];
}

// Выплаты помощникам до 25.10.2026 (helperPaidBefore из app.js; в тестах может не быть)
function finHelperPaidBefore() {
    return typeof helperPaidBefore !== 'undefined' ? helperPaidBefore : [];
}

// Начисления одного помощника за всё время: earned, penalties, paid, owed (к выплате)
function finHelperAccrual(email) {
    return finHelperAccrualsData(ordersData, cashOps, finHelperPaidBefore(), null, finHelperPenalties())
        .find(h => h.email === email) || { email, earned: 0, penalties: 0, paid: finHelperPaid(email), net: 0, owed: -finHelperPaid(email) };
}

// Выплачено помощнику (для отчётов помощника и админа в app.js)
function finHelperPaid(email) {
    return finHelperPaidData(email, cashOps, finHelperPaidBefore());
}

// Выплата помощнику: расход кассы «Помощникам» (синхронизируется — помощник видит выплату)
function finPayHelper(email) {
    const owed = finHelperAccrual(email).owed;
    if (owed <= 0 && !confirm('Помощнику сейчас ничего не начислено к выплате. Всё равно записать выплату (аванс)?')) return;
    const input = prompt(`Сумма выплаты для ${finHelperName(email)}:\n\nК выплате: ${formatMoney(Math.max(0, owed))}`, owed > 0 ? Math.round(owed) : '');
    const amount = finNum(input);
    if (amount <= 0) return;
    if (owed > 0 && amount > owed && !confirm(`Вы платите ${formatMoney(amount)}, а начислено ${formatMoney(owed)}. Переплата будет учтена. Продолжить?`)) return;
    const today = finTodayStr();
    const op = { id: 'hp-' + Date.now(), date: today, desc: `Выплата помощнику ${finHelperName(email)}`, income: 0, expense: amount, category: 'helpers', helper: email };
    cashOps.push(op);
    if (typeof notifyHelperAboutPayment === 'function') notifyHelperAboutPayment(email, amount);
    if (typeof notifyAdminsAboutMoney === 'function') notifyAdminsAboutMoney(`💸 Выплата помощнику ${finHelperName(email)}: ${formatMoney(amount)}`);
    saveAll();
    renderAll();
    if (typeof renderAdminHelperTasks === 'function') renderAdminHelperTasks();
    finOpenPayLink(email, amount);
}

// ---------- Перевод помощнику через банк ----------
// Помощник делает в своём банке (ВТБ и др.) «ссылку для перевода» или QR-код, админ добавляет их один раз.
// После «Выплатить» открывается окно: сумма (уже скопирована), QR-код и кнопка «Перейти в банк».
// На компьютере QR сканируют камерой телефона — открывается банк; на телефоне — кнопка «Перейти в банк».
// Вместо ссылки можно вписать номер телефона — тогда перевод по СБП: окно показывает номер и сумму.
function finPayLink(email) {
    const links = finSettings().payLinks || {};
    return links[email] || '';
}

// Картинка QR-кода из банка помощника (уменьшенная, data:image/…) — financeSettings.payQr
function finPayQr(email) {
    const qr = finSettings().payQr || {};
    return qr[email] || '';
}

function finIsPayPhone(value) {
    return !/^https?:\/\//i.test(value) && String(value).replace(/\D/g, '').length >= 10;
}

function finSetPayLink(email) {
    const current = finPayLink(email);
    const input = prompt(`Как переводить ${finHelperName(email)}?

Вставьте ссылку для перевода из его банка (начинается с https://) или номер телефона для перевода по СБП. Пустое поле — удалить.`, current);
    if (input === null) return;
    const link = input.trim();
    if (link && !/^https?:\/\//i.test(link) && !finIsPayPhone(link)) { alert('Нужна ссылка (https://…) или номер телефона'); return; }
    const s = finSettings();
    const payLinks = { ...(s.payLinks || {}) };
    if (link) payLinks[email] = link; else delete payLinks[email];
    financeSettings = [{ ...s, payLinks }];
    saveAll();
    renderAll();
    if (typeof showToast === 'function') showToast(!link ? 'Удалено' : finIsPayPhone(link) ? '📱 Номер для перевода по СБП сохранён' : '🔗 Ссылка для перевода сохранена');
}

// Загрузка картинки QR-кода помощника (скриншот из его банка). Картинка уменьшается до 360 точек,
// чтобы не раздувать облако. Если QR уже есть — можно заменить или удалить.
function finPickPayQr(email) {
    if (finPayQr(email) && confirm(`QR-код ${finHelperName(email)} уже добавлен.\n\nОК — удалить его, Отмена — оставить (или выбрать новую картинку после удаления).`)) {
        const s = finSettings();
        const payQr = { ...(s.payQr || {}) };
        delete payQr[email];
        financeSettings = [{ ...s, payQr }];
        saveAll(); renderAll();
        return;
    }
    if (finPayQr(email)) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            const k = Math.min(1, 360 / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            const s = finSettings();
            financeSettings = [{ ...s, payQr: { ...(s.payQr || {}), [email]: c.toDataURL('image/jpeg', 0.85) } }];
            URL.revokeObjectURL(img.src);
            saveAll(); renderAll();
            if (typeof showToast === 'function') showToast('🔳 QR-код помощника сохранён');
        };
        img.src = URL.createObjectURL(file);
    };
    input.click();
}

// Генератор QR (qrcodejs с cdnjs) — загружается только когда нужен
function finLoadQrLib() {
    if (window.QRCode) return Promise.resolve(true);
    return new Promise(resolve => {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        sc.onload = () => resolve(!!window.QRCode);
        sc.onerror = () => resolve(false);
        document.head.appendChild(sc);
    });
}

function finIsPhoneDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function finClosePayModal() {
    const m = document.getElementById('finPayModal');
    if (m) m.remove();
    document.body.classList.remove('modal-open');
}

function finCopy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(text)).catch(() => {});
    if (typeof showToast === 'function') showToast('Скопировано: ' + text);
}

// Окно перевода после «Выплатить»
function finOpenPayLink(email, amount) {
    const link = finPayLink(email), qrImg = finPayQr(email);
    const sum = String(Math.round(amount));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(sum).catch(() => {});
    const phone = link && finIsPayPhone(link) ? link : '';
    const url = link && !phone ? link : '';
    finClosePayModal();
    const box = document.createElement('div');
    box.id = 'finPayModal';
    box.className = 'modal-overlay active';
    box.addEventListener('click', e => { if (e.target === box) finClosePayModal(); });
    box.innerHTML = `<div class="modal fin-paymodal">
        <h3>💸 Перевод: ${safeHTML(finHelperName(email))}</h3>
        <div class="fin-paymodal-sum">${formatMoney(amount)} <button class="btn-extra" onclick="finCopy('${sum}')">📋 сумма</button></div>
        <div class="fin-muted">Выплата уже записана в кассу. Сумма скопирована — вставьте её в банке.</div>
        ${qrImg ? `<img class="fin-paymodal-qr" src="${qrImg}" alt="QR-код помощника">`
            : url ? `<div id="finPayQrBox" class="fin-paymodal-qr"></div>` : ''}
        ${(qrImg || url) && !finIsPhoneDevice() ? `<div class="fin-muted">Наведите камеру телефона на QR-код — откроется банк с реквизитами помощника.</div>` : ''}
        ${phone ? `<div class="fin-paymodal-sum">📱 ${safeHTML(phone)} <button class="btn-extra" onclick="finCopy('${escAttr(phone)}')">📋 номер</button></div>
            <div class="fin-muted">В банке: «Перевод по номеру телефона (СБП)» → вставьте номер и сумму.</div>` : ''}
        ${!link && !qrImg ? `<div class="fin-warn">Как переводить этому помощнику, ещё не указано — нажмите «🔗 как переводить?» или «🔳 QR-код» у помощника.</div>` : ''}
        <div class="form-actions">
            <button class="btn-cancel" onclick="finClosePayModal()">Закрыть</button>
            ${url ? `<a class="btn-save fin-paymodal-go" href="${escAttr(url)}" target="_blank" rel="noopener" onclick="setTimeout(finClosePayModal, 300)">🏦 Перейти в банк</a>` : ''}
        </div>
    </div>`;
    document.body.appendChild(box);
    document.body.classList.add('modal-open');
    if (url && !qrImg) finLoadQrLib().then(ok => {
        const el = document.getElementById('finPayQrBox');
        if (!el) return;
        if (ok) new window.QRCode(el, { text: url, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M });
        else el.remove();
    });
}

// Старый ручной приход «Прочее» → выручка: появится налог, расходники и копилки за его месяц
function finMakeRevenue(opId) {
    const op = cashOps.find(o => o.id === opId);
    if (!op || !confirm(`«${op.desc}» — это оплата за работу? С неё отложится налог и пойдёт распределение по копилкам.`)) return;
    op.category = 'income';
    saveAll();
    renderAll();
}

function finSetMonth(delta) { finPaymentsMonth = finShiftMonth(finPaymentsMonth || finMonthKey(finTodayStr()), delta); renderFinance(); }

function finSaveSetting(key, value) {
    const s = finSettings();
    s[key] = Math.max(0, parseFloat(value) || 0);
    financeSettings = [s];
    saveAll();
    renderAll();
}

// Оплата платежа месяца mk (по умолчанию — показанного во вкладке «Деньги»).
// Дата операции — сегодня: деньги ушли сегодня, даже если платёж за следующий месяц (раньше записывалась
// плановая дата следующего месяца, и в «Деньгах» за текущий месяц оплата не была видна).
function finPay(paymentId, month) {
    const p = payments.find(x => x.id === paymentId);
    if (!p) return;
    const mk = month || finPaymentsMonth || finMonthKey(finTodayStr());
    if (cashOps.some(o => o.paymentId === p.id && o.month === mk)) return;
    cashOps.push({
        id: `pm-${p.id}-${mk}`, date: finTodayStr(), desc: mk === finMonthKey(finTodayStr()) ? p.name : `${p.name} (за ${finMonthTitle(mk).toLowerCase()})`,
        income: 0, expense: finNum(p.amount),
        category: p.type === 'personal' ? 'personal' : 'business', paymentId: p.id, month: mk
    });
    if (typeof notifyAdminsAboutMoney === 'function') notifyAdminsAboutMoney(`💳 Оплачен платёж «${p.name}»: ${formatMoney(finNum(p.amount))}`);
    saveAll();
    renderAll();
    if (typeof showToast === 'function') showToast(`✅ «${p.name}» оплачен${mk !== finMonthKey(finTodayStr()) ? ' — за ' + finMonthTitle(mk).toLowerCase() : ''}. Отменить можно тут же или во вкладке «Деньги»`);
}

function finUnpay(paymentId, month) {
    const mk = month || finPaymentsMonth || finMonthKey(finTodayStr());
    const idx = cashOps.findIndex(o => o.paymentId === paymentId && o.month === mk);
    if (idx < 0) return;
    const p = payments.find(x => x.id === paymentId);
    if (!confirm(`Отменить оплату «${p ? p.name : 'платежа'}» за ${finMonthTitle(mk).toLowerCase()}? Расход уберётся из кассы.`)) return;
    cashOps.splice(idx, 1);
    saveAll();
    renderAll();
}

function finDeletePayment(paymentId) {
    const p = payments.find(x => x.id === paymentId);
    if (!p || !confirm(`Удалить платёж «${p.name}»? Уже сделанные оплаты останутся в кассе.`)) return;
    payments = payments.filter(x => x.id !== paymentId);
    saveAll();
    renderAll();
}

// --- Окно платежа ---
function openPaymentModal(paymentId) {
    const p = paymentId ? payments.find(x => x.id === paymentId) : null;
    document.getElementById('paymentModalTitle').textContent = p ? '✏️ Платёж' : '➕ Новый платёж';
    document.getElementById('paymentId').value = p ? p.id : '';
    document.getElementById('paymentName').value = p ? p.name : '';
    document.getElementById('paymentAmount').value = p ? p.amount : '';
    document.getElementById('paymentDay').value = p ? p.day : 1;
    document.getElementById('paymentType').value = p ? p.type : 'business';
    document.getElementById('paymentDebt').value = p && p.debtTotal ? p.debtTotal : '';
    document.getElementById('paymentModal').classList.add('active');
    document.body.classList.add('modal-open');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function savePaymentModal() {
    const id = document.getElementById('paymentId').value;
    const name = document.getElementById('paymentName').value.trim();
    const amount = finNum(document.getElementById('paymentAmount').value);
    const day = Math.min(31, Math.max(1, parseInt(document.getElementById('paymentDay').value) || 1));
    const type = document.getElementById('paymentType').value === 'personal' ? 'personal' : 'business';
    const debtTotal = finNum(document.getElementById('paymentDebt').value);
    if (!name) { alert('❌ Введите название'); return; }
    if (amount <= 0) { alert('❌ Укажите сумму'); return; }
    if (id) {
        const p = payments.find(x => x.id === id);
        if (p) {
            Object.assign(p, { name, amount, day, type });
            if (debtTotal > 0) p.debtTotal = debtTotal; else { delete p.debtTotal; delete p.debtPaidBefore; }
        }
    } else {
        const p = { id: 'pay-' + Date.now(), name, amount, day, type, icon: type === 'personal' ? '🏠' : '🏢' };
        if (debtTotal > 0) p.debtTotal = debtTotal;
        payments.push(p);
    }
    closePaymentModal();
    saveAll();
    renderAll();
}

// ========== ВКЛАДКА «ИТОГИ» ==========
// Популярные услуги: заказы с датой в периоде — сколько раз заказывали и на какую сумму.
// Цена заказа с несколькими услугами делится между ними поровну
function finPopularServices(orders, startDate, endDate) {
    const map = new Map();
    orders.filter(o => o.date && o.date >= startDate && o.date <= endDate).forEach(o => {
        const names = (o.services || []).map(s => s.serviceName).filter(Boolean);
        names.forEach(name => {
            const row = map.get(name) || { name, count: 0, sum: 0 };
            row.count++;
            row.sum += finNum(o.clientPrice) / names.length;
            map.set(name, row);
        });
    });
    return [...map.values()].sort((a, b) => b.count - a.count || b.sum - a.sum);
}
function finPopularServicesHTML(list) {
    if (!list.length) return '';
    const max = list[0].count;
    return `<div class="fin-info"><b>🏆 Популярные услуги за период</b>${list.slice(0, 8).map((r, i) => `
        <div class="fin-plan-row"><span>${i + 1}. ${safeHTML(r.name)} — ${r.count} раз</span><b>${formatMoney(Math.round(r.sum))}</b></div>
        <div class="fin-progress"><div style="width:${r.count / max * 100}%"></div></div>`).join('')}</div>`;
}
function renderFinanceSummary(startDate, endDate) {
    const block = document.getElementById('summaryBlock');
    if (!block) return;
    const computed = finComputeNow();
    const fromMk = finMonthKey(startDate), toMk = finMonthKey(endDate);
    const m = finSumMonths(computed, fromMk, toMk);
    const s = finSettings();
    const row = (label, value, cls, note) => `
        <tr class="${cls || ''}"><td>${label}${note ? `<div class="fin-muted">${note}</div>` : ''}</td><td>${formatMoney(value)}</td></tr>`;

    // Заказы, выполненные, но не оплаченные (ждём денег)
    const waiting = ordersData.filter(o => !(o.paid === true || o.paid === 'true') && (o.done === true || o.done === 'true'));
    const waitingSum = waiting.reduce((sum, o) => sum + finOrderRemaining(o), 0);

    // Маржа оплаченных в периоде заказов
    const paidOrders = ordersData.filter(o => o.paidAt && o.paidAt >= startDate && o.paidAt <= endDate);
    const low = paidOrders.map(o => {
        const price = finNum(o.clientPrice);
        const margin = price - price * (s.taxPercent + finNum(s.suppliesPercent)) / 100 - getOrderCost(o) - finHelperNetCost(o);
        return { o, margin, pct: price > 0 ? margin / price * 100 : 0 };
    }).filter(x => x.pct < 30).sort((a, b) => a.pct - b.pct).slice(0, 5);

    block.innerHTML = `
        <table class="fin-waterfall">
            ${row('💰 Выручка', m.revenue, 'total', `оплачено заказов: ${m.ordersPaid}`)}
            ${row(`− Налог ${s.taxPercent}% → в копилку`, m.tax, '', 'самозанятый: с каждой оплаты и предоплаты, платить до 28-го следующего месяца')}
            ${row(`− Мелкие расходники ${finNum(s.suppliesPercent)}% → в копилку`, m.supplies, '', 'перчатки, палочки, ветошь, скотч — то, что не списать на заказ')}
            ${row('− Материалы', m.materials)}
            ${row('− Помощникам', m.helpers, '', m.helperPenalties ? `за вычетом штрафов ${formatMoney(m.helperPenalties)}` : '')}
            ${row('= Маржинальная прибыль', m.marginal, 'sub')}
            ${row('− Постоянные расходы бизнеса', m.fixed, '', 'платежи «Бизнес» и прочие траты')}
            ${row('= Прибыль бизнеса', m.businessProfit, 'sub ' + (m.businessProfit < 0 ? 'neg' : 'pos'))}
            ${row(`− Резерв (${s.reservePercent}%) → в копилку`, m.reserve)}
            ${row(`− Развитие бизнеса (${s.devPercent}%) → в копилку`, m.dev)}
            ${row('= Зарплата владельца', m.salary, 'sub')}
            ${row(`− Личные накопления (${s.savingsPercent}%) → в копилку`, m.savings)}
            ${row(`− Инвестиции (${s.investPercent}%) → в копилку`, m.invest)}
            ${row('− Личные платежи', m.personal)}
            ${row('= Свободный остаток', m.free, 'total ' + (m.free < 0 ? 'neg' : 'pos'))}
        </table>
        ${m.free < 0 ? `<div class="fin-warn">⚠️ Прибыли не хватает на все платежи и отложения — минус ${formatMoney(-m.free)}.</div>` : ''}
        <div class="fin-note">Постоянные и личные платежи считаются по плану на каждый месяц периода, даже если ещё не оплачены.</div>
        ${waiting.length ? `<div class="fin-info">⏳ Ждём оплаты за выполненные заказы: ${formatMoney(waitingSum)} (заказов: ${waiting.length})</div>` : ''}
        ${low.length ? `<div class="fin-info"><b>📉 Заказы с низкой маржой (меньше 30%)</b>${low.map(x =>
            `<div>№${safeHTML(x.o.orderNumber)} ${safeHTML(x.o.client || '')} — маржа ${formatMoney(x.margin)} (${x.pct.toFixed(0)}%)</div>`).join('')}</div>` : ''}
        ${finPopularServicesHTML(finPopularServices(ordersData, startDate, endDate))}`;

    // План текущего месяца
    const planBox = document.getElementById('incomePlanContainer');
    if (planBox) {
        const mk = finMonthKey(finTodayStr());
        const plan = finPlan(computed, s, mk, finTodayStr());
        planBox.innerHTML = `
            <div class="fin-plan">
                <div class="fin-plan-row"><span>Нужно выручки за ${finMonthTitle(mk).toLowerCase()}</span><b>${formatMoney(plan.revenueNeeded)}</b></div>
                <div class="fin-progress big"><div style="width:${plan.progress}%"></div></div>
                <div class="fin-plan-row"><span>Уже оплачено</span><b>${formatMoney(plan.actual)} (${plan.progress.toFixed(0)}%)</b></div>
                <div class="fin-plan-row"><span>Прогноз на конец месяца</span><b>${formatMoney(plan.projected)}</b></div>
                ${plan.shortfall > 0
                    ? `<div class="fin-plan-row"><span>Не хватает</span><b class="neg">${formatMoney(plan.shortfall)}</b></div>
                       ${plan.perDayNeeded > 0 ? `<div class="fin-plan-row"><span>Нужно в день до конца месяца</span><b>${formatMoney(plan.perDayNeeded)}</b></div>` : ''}`
                    : `<div class="fin-ok">🎉 План месяца выполнен</div>`}
                <div class="fin-muted">
                    Из чего план: постоянные расходы бизнеса ${formatMoney(computed.fixedPlanned)}, личные платежи ${formatMoney(computed.personalPlanned)},
                    отложения по настройкам${plan.reserveFull ? ' (резерв уже накоплен — в план не входит)' : ''},
                    налог ${s.taxPercent}%, мелкие расходники ${finNum(s.suppliesPercent)}%, материалы и помощники ≈ ${(plan.variableShare * 100).toFixed(0)}% выручки.
                    Нужная зарплата владельца ${formatMoney(plan.salaryNeeded)}.
                </div>
            </div>`;
    }
    const goals = document.getElementById('goalsContainer');
    if (goals) goals.innerHTML = '';
}

// ========== КАЛЕНДАРЬ: обязательные платежи ==========
function finPaymentsForDate(dateStr) {
    const mk = finMonthKey(dateStr);
    const today = finTodayStr();
    return (payments || [])
        .filter(p => finPaymentDate(p, mk) === dateStr)
        .map(p => ({ p, status: finPaymentStatus(p, mk, cashOps, today) }));
}

// Оплата из календаря — за месяц того дня, где стоит платёж; «Деньги» открываются на этом месяце
function finPayFromCalendar(paymentId, dateStr) {
    finPaymentsMonth = finMonthKey(dateStr);
    finPay(paymentId, finMonthKey(dateStr)); // finPay → renderAll: календарь, остаток месяца и остаток долга пересчитываются
}
function finUnpayFromCalendar(paymentId, dateStr) {
    finPaymentsMonth = finMonthKey(dateStr);
    finUnpay(paymentId, finMonthKey(dateStr));
}

// Платежи месяца для сводки календаря: сколько всего, оплачено и осталось
function finMonthPaymentsTotals(mk) {
    const today = finTodayStr();
    let total = 0, paid = 0, overdue = 0;
    (payments || []).forEach(p => {
        const st = finPaymentStatus(p, mk, cashOps, today);
        total += finNum(p.amount);
        if (st.state === 'paid') paid += finNum(p.amount);
        else if (st.state === 'overdue') overdue++;
    });
    return { total, paid, left: total - paid, overdue };
}

function finCalendarPaymentsSummaryHTML(mk) {
    if (!payments || !payments.length) return '';
    const t = finMonthPaymentsTotals(mk);
    return `<span style="color:${t.left > 0 ? '#dc3545' : '#28a745'};">💳 Платежи: осталось ${formatMoney(t.left)} из ${formatMoney(t.total)}` +
        `${t.overdue ? ` (просрочено: ${t.overdue})` : ''}</span>`;
}
