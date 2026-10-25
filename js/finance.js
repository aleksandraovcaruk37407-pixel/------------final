/* ==========================================================================
   ФИНАНСЫ: касса (реальные деньги), копилки, платежи месяца, отчёт и план.

   Распределение («водопад») за каждый месяц:
     Выручка (оплаченные заказы, по дате оплаты)
     − Налог (% от выручки)                         → копилка «Налог»
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
    reservePercent: 10,   // резерв бизнеса, % от прибыли бизнеса
    reserveMonths: 2,     // цель резерва: столько месяцев постоянных расходов
    devPercent: 5,        // развитие бизнеса, % от прибыли бизнеса
    savingsPercent: 10,   // личные накопления, % от зарплаты владельца
    investPercent: 5      // инвестиции, % от зарплаты владельца
};

const FIN_FUNDS = {
    tax:     { name: 'Налог',              icon: '💰' },
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

// ========== НАЧИСЛЕНИЯ ПОМОЩНИКАМ ==========
// Начислено — оплата выполненных задач; штраф — за просроченные; выплачено — расходы кассы
// «Помощникам» с этим помощником (синхронизируются) + старые выплаты, записанные только
// на устройстве админа (budgetData.helperPayments без cashOpId).
function finHelperPaidData(email, cash, budget) {
    const fromCash = (cash || []).filter(o => o.category === 'helpers' && o.helper === email)
        .reduce((sum, o) => sum + finNum(o.expense), 0);
    const legacy = (budget && budget.helperPayments && budget.helperPayments[email] || [])
        .filter(p => !p.cashOpId).reduce((sum, p) => sum + finNum(p.amount), 0);
    return fromCash + legacy;
}

function finHelperAccrualsData(orders, cash, budget, mk) {
    const byHelper = new Map();
    const get = email => {
        if (!byHelper.has(email)) byHelper.set(email, { email, earned: 0, penalties: 0, done: 0, overdue: 0, pending: 0, pendingPay: 0, monthEarned: 0, monthDone: 0 });
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
        } else {
            h.pending++; h.pendingPay += finNum(t.helperPay);
        }
    })));
    // Помощники, которым платили, но задач уже нет
    (cash || []).forEach(o => { if (o.category === 'helpers' && o.helper) get(o.helper); });
    return [...byHelper.values()].map(h => {
        const paid = finHelperPaidData(h.email, cash, budget);
        const net = h.earned - h.penalties;
        return { ...h, paid, net, owed: net - paid };
    }).sort((a, b) => b.owed - a.owed);
}

// Операция кассы «оплата заказа»: приход по каждому оплаченному заказу
function finIncomeOpId(order) { return 'inc-' + order.id; }

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
 * data: { orders, cash, payments, settings, getOrderCost, today, fromMonth?, toMonth? }
 * Возвращает { months: {mk: {...}}, funds: {key: {accrued, spent, balance}}, reserveTarget }
 */
function finCompute(data) {
    const s = data.settings;
    const t = s.taxPercent / 100, r = s.reservePercent / 100, d = s.devPercent / 100;
    const sv = s.savingsPercent / 100, iv = s.investPercent / 100;
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
        // Переменные расходы — по тем же заказам
        let materials = 0, helpers = 0;
        incomeOps.forEach(o => {
            const order = ordersById.get(String(o.orderId));
            if (!order) return;
            materials += data.getOrderCost(order);
            helpers += finHelperCost(order);
        });
        const tax = revenue * t;
        const marginal = revenue - tax - materials - helpers;
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
            revenue, tax, materials, helpers, marginal, fixed, otherBusiness, businessProfit,
            reserve, dev, salary, savings, invest, personal, otherPersonal, free,
            ordersPaid: incomeOps.length
        };
        const f = result.funds;
        f.tax.accrued += tax; f.reserve.accrued += reserve; f.dev.accrued += dev;
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
    const keys = ['revenue', 'tax', 'materials', 'helpers', 'marginal', 'fixed', 'businessProfit',
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
    const t = s.taxPercent / 100, d = s.devPercent / 100, sv = s.savingsPercent / 100, iv = s.investPercent / 100;
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
    const paid = new Map();
    orders.forEach(order => {
        const isPaid = order.paid === true || order.paid === 'true';
        if (isPaid) {
            if (!order.paidAt) { order.paidAt = migration ? (order.date || today) : today; changed = true; }
            paid.set(finIncomeOpId(order), order);
        } else if (order.paidAt) {
            delete order.paidAt; changed = true;
        }
    });
    // Убираем приходы по неоплаченным/удалённым заказам
    for (let i = cash.length - 1; i >= 0; i--) {
        const op = cash[i];
        if (op.category === 'income' && op.orderId != null && !paid.has(op.id)) { cash.splice(i, 1); changed = true; }
    }
    // Добавляем/обновляем приходы по оплаченным
    paid.forEach((order, id) => {
        const amount = finNum(order.clientPrice);
        const desc = `Оплата заказа №${order.orderNumber} (${order.client || 'без клиента'})`;
        const op = cash.find(o => o.id === id);
        if (!op) {
            cash.push({ id, date: order.paidAt, desc, income: amount, expense: 0, category: 'income', orderId: String(order.id) });
            changed = true;
        } else if (finNum(op.income) !== amount || op.desc !== desc) {
            op.income = amount; op.desc = desc; changed = true;
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
        getOrderCost, today: finTodayStr()
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

    // --- Сводка ---
    let html = `
        <div class="fin-cards">
            <div class="fin-card"><div class="fin-card-label">💵 В кассе</div><div class="fin-card-value ${balance < 0 ? 'neg' : ''}">${formatMoney(balance)}</div></div>
            <div class="fin-card"><div class="fin-card-label">🐷 Отложено в копилках</div><div class="fin-card-value">${formatMoney(fundsTotal)}</div></div>
            <div class="fin-card"><div class="fin-card-label">✅ Можно тратить</div><div class="fin-card-value ${free < 0 ? 'neg' : 'pos'}">${formatMoney(free)}</div></div>
        </div>
        ${free < 0 ? `<div class="fin-warn">⚠️ Денег в кассе меньше, чем должно лежать в копилках, — не хватает ${formatMoney(-free)}.</div>` : ''}`;

    // --- Копилки ---
    html += `<h3 class="fin-h">🐷 Копилки</h3><div class="fin-funds">`;
    Object.keys(FIN_FUNDS).forEach(key => {
        const f = computed.funds[key], meta = FIN_FUNDS[key];
        const target = key === 'reserve' && computed.reserveTarget > 0
            ? `<div class="fin-progress"><div style="width:${Math.min(100, f.balance / computed.reserveTarget * 100)}%"></div></div>
               <div class="fin-muted">цель ${formatMoney(computed.reserveTarget)} (${finSettings().reserveMonths} мес. постоянных расходов)</div>` : '';
        html += `
            <div class="fin-fund">
                <div class="fin-fund-head"><span>${meta.icon} ${meta.name}</span><b class="${f.balance < 0 ? 'neg' : ''}">${formatMoney(f.balance)}</b></div>
                <div class="fin-muted">начислено ${formatMoney(f.accrued)} · потрачено ${formatMoney(f.spent)}</div>
                ${target}
                <button class="fin-link" onclick="openAddCashModal({fund:'${key}'})">− Потратить из копилки</button>
            </div>`;
    });
    html += `</div>`;

    // --- Платежи месяца ---
    const groups = { business: '🏢 Бизнес', personal: '🏠 Личное' };
    html += `
        <h3 class="fin-h">📌 Платежи месяца</h3>
        <div class="fin-month-nav">
            <button onclick="finSetMonth(-1)">◀</button><b>${finMonthTitle(mk)}</b><button onclick="finSetMonth(1)">▶</button>
            <button class="btn-add fin-add" onclick="openPaymentModal()">➕ Платёж</button>
        </div>`;
    Object.keys(groups).forEach(type => {
        const list = payments.filter(p => p.type === type).sort((a, b) => (parseInt(a.day) || 0) - (parseInt(b.day) || 0));
        const total = list.reduce((sum, p) => sum + finNum(p.amount), 0);
        const paidSum = list.filter(p => finPaymentStatus(p, mk, cashOps, today).state === 'paid').reduce((sum, p) => sum + finNum(p.amount), 0);
        html += `<div class="fin-group"><div class="fin-group-head"><b>${groups[type]}</b><span>оплачено ${formatMoney(paidSum)} из ${formatMoney(total)}</span></div>`;
        if (!list.length) html += `<div class="fin-muted">Нет платежей</div>`;
        list.forEach(p => {
            const st = finPaymentStatus(p, mk, cashOps, today);
            const debt = finDebtRemaining(p, cashOps);
            const label = st.state === 'paid' ? `✅ оплачено ${formatDateDDMMYYYY(st.op.date)}`
                : st.state === 'overdue' ? `🔴 просрочен с ${formatDateDDMMYYYY(st.due)}` : `🕒 до ${formatDateDDMMYYYY(st.due)}`;
            html += `
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
        html += `</div>`;
    });

    // --- Помощникам: начислено, штрафы, выплачено, к выплате ---
    const helpers = finHelperAccrualsData(ordersData, cashOps, typeof budgetData !== 'undefined' ? budgetData : null, mk);
    const owedTotal = helpers.reduce((sum, h) => sum + Math.max(0, h.owed), 0);
    html += `<h3 class="fin-h">👷 Помощникам</h3>
        <div class="fin-group">
        <div class="fin-group-head"><b>Всего к выплате</b><b class="${owedTotal > 0 ? 'neg' : ''}">${formatMoney(owedTotal)}</b></div>`;
    if (!helpers.length) html += `<div class="fin-muted">Задач помощникам ещё не было</div>`;
    helpers.forEach(h => {
        html += `
            <div class="fin-pay ${h.owed > 0 ? 'fin-due' : 'fin-paid'}">
                <div class="fin-pay-main">
                    <span class="fin-pay-name">👷 ${safeHTML(finHelperName(h.email))}</span>
                    <b class="${h.owed > 0 ? 'neg' : ''}">${h.owed > 0 ? 'к выплате ' + formatMoney(h.owed) : h.owed < 0 ? 'переплата ' + formatMoney(-h.owed) : h.net > 0 ? 'всё выплачено' : 'пока не начислено'}</b>
                </div>
                <div class="fin-pay-sub">
                    <span>
                        за ${finMonthTitle(mk).toLowerCase()}: ${formatMoney(h.monthEarned)} (задач ${h.monthDone})<br>
                        всего начислено ${formatMoney(h.earned)} (задач ${h.done})${h.penalties ? ` − штрафы ${formatMoney(h.penalties)} (${h.overdue})` : ''} · выплачено ${formatMoney(h.paid)}
                        ${h.pending ? `<br>в работе: задач ${h.pending} на ${formatMoney(h.pendingPay)}` : ''}
                    </span>
                    <span class="fin-pay-actions">
                        ${h.owed > 0 ? `<button class="fin-pay-btn" onclick="finPayHelper('${escAttr(h.email)}')">Выплатить</button>` : ''}
                    </span>
                </div>
            </div>`;
    });
    html += `</div>`;

    // --- Операции ---
    const monthOps = cashOps.filter(o => finMonthKey(o.date) === mk)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    html += `
        <h3 class="fin-h">💵 Операции — ${finMonthTitle(mk)}</h3>
        <button class="btn-add" onclick="openAddCashModal()">➕ Добавить операцию</button>
        <div class="fin-ops">`;
    if (!monthOps.length) html += `<div class="fin-muted">Операций в этом месяце нет</div>`;
    monthOps.forEach(o => {
        const idx = cashOps.indexOf(o);
        const isIncome = finNum(o.income) > 0;
        const cat = FIN_CATEGORIES[o.category] || (isIncome ? 'Приход' : 'Прочее');
        const fund = o.fund && FIN_FUNDS[o.fund] ? ` · из копилки «${FIN_FUNDS[o.fund].name}»` : '';
        html += `
            <div class="fin-op">
                <div><div>${safeHTML(o.desc)}</div><div class="fin-muted">${formatDateDDMMYYYY(o.date)} · ${cat}${fund}</div></div>
                <b class="${isIncome ? 'pos' : 'neg'}">${isIncome ? '+' : '−'}${formatMoney(isIncome ? o.income : o.expense)}</b>
                ${o.category === 'income' || o.paymentId ? '<span></span>' : `<button class="btn-del" onclick="deleteCashOp(${idx})" title="Удалить">🗑️</button>`}
            </div>`;
    });
    html += `</div>`;

    // --- Настройки распределения ---
    const s = finSettings();
    const field = (key, label) => `<label class="fin-set"><span>${label}</span><input type="number" min="0" max="100" step="0.5" value="${s[key]}" onchange="finSaveSetting('${key}', this.value)"></label>`;
    html += `
        <details class="fin-settings">
            <summary>⚙️ Настройки распределения</summary>
            ${field('taxPercent', 'Налог, % от выручки')}
            ${field('reservePercent', 'Резерв бизнеса, % от прибыли бизнеса')}
            ${field('reserveMonths', 'Цель резерва, месяцев постоянных расходов')}
            ${field('devPercent', 'Развитие бизнеса, % от прибыли бизнеса')}
            ${field('savingsPercent', 'Личные накопления, % от зарплаты')}
            ${field('investPercent', 'Инвестиции, % от зарплаты')}
            <div class="fin-muted">Зарплата владельца — остаток прибыли бизнеса после резерва и развития.</div>
        </details>`;

    root.innerHTML = html;
}

// Имя помощника: из списков выбора помощника («Имя (email)»), иначе часть email до @
function finHelperName(email) {
    const option = [...document.querySelectorAll('option')].find(o => o.value === email && o.textContent.includes('('));
    if (option) return option.textContent.replace(/\s*\([^)]*\)\s*$/, '').trim() || email;
    return String(email).split('@')[0];
}

// Выплачено помощнику (для отчётов помощника и админа в app.js)
function finHelperPaid(email) {
    return finHelperPaidData(email, cashOps, typeof budgetData !== 'undefined' ? budgetData : null);
}

// Выплата помощнику: расход кассы «Помощникам» (синхронизируется — помощник видит выплату)
function finPayHelper(email) {
    const h = finHelperAccrualsData(ordersData, cashOps, budgetData, null).find(x => x.email === email);
    const owed = h ? h.owed : 0;
    if (owed <= 0 && !confirm('Помощнику сейчас ничего не начислено к выплате. Всё равно записать выплату (аванс)?')) return;
    const input = prompt(`Сумма выплаты для ${finHelperName(email)}:\n\nК выплате: ${formatMoney(Math.max(0, owed))}`, owed > 0 ? Math.round(owed) : '');
    const amount = finNum(input);
    if (amount <= 0) return;
    if (owed > 0 && amount > owed && !confirm(`Вы платите ${formatMoney(amount)}, а начислено ${formatMoney(owed)}. Переплата будет учтена. Продолжить?`)) return;
    const today = finTodayStr();
    const op = { id: 'hp-' + Date.now(), date: today, desc: `Выплата помощнику ${finHelperName(email)}`, income: 0, expense: amount, category: 'helpers', helper: email };
    cashOps.push(op);
    // История выплат на экране помощников (хранится на этом устройстве)
    if (budgetData) {
        const paidBy = window.currentUserData ? window.currentUserData.email : 'admin';
        if (!budgetData.helperPayments[email]) budgetData.helperPayments[email] = [];
        budgetData.helperPayments[email].push({ amount, date: new Date().toISOString(), paidBy, cashOpId: op.id });
        if (!budgetData.paymentHistory) budgetData.paymentHistory = [];
        budgetData.paymentHistory.push({ id: op.id, date: new Date().toISOString(), helperEmail: email, amount, paidBy, description: op.desc, cashOpId: op.id });
        saveBudgetData();
    }
    saveAll();
    renderAll();
    if (typeof renderAdminHelperTasks === 'function') renderAdminHelperTasks();
    if (typeof renderPaymentHistory === 'function') renderPaymentHistory();
    if (typeof notifyHelperAboutPayment === 'function') notifyHelperAboutPayment(email, amount);
}

function finSetMonth(delta) { finPaymentsMonth = finShiftMonth(finPaymentsMonth || finMonthKey(finTodayStr()), delta); renderFinance(); }

function finSaveSetting(key, value) {
    const s = finSettings();
    s[key] = Math.max(0, parseFloat(value) || 0);
    financeSettings = [s];
    saveAll();
    renderAll();
}

function finPay(paymentId) {
    const p = payments.find(x => x.id === paymentId);
    if (!p) return;
    const mk = finPaymentsMonth || finMonthKey(finTodayStr());
    const today = finTodayStr();
    const date = finMonthKey(today) === mk ? today : finPaymentDate(p, mk);
    cashOps.push({
        id: `pm-${p.id}-${mk}`, date, desc: p.name, income: 0, expense: finNum(p.amount),
        category: p.type === 'personal' ? 'personal' : 'business', paymentId: p.id, month: mk
    });
    saveAll();
    renderAll();
}

function finUnpay(paymentId) {
    const mk = finPaymentsMonth || finMonthKey(finTodayStr());
    const idx = cashOps.findIndex(o => o.paymentId === paymentId && o.month === mk);
    if (idx < 0) return;
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
    const waitingSum = waiting.reduce((sum, o) => sum + finNum(o.clientPrice), 0);

    // Маржа оплаченных в периоде заказов
    const paidOrders = ordersData.filter(o => o.paidAt && o.paidAt >= startDate && o.paidAt <= endDate);
    const low = paidOrders.map(o => {
        const price = finNum(o.clientPrice);
        const margin = price - price * s.taxPercent / 100 - getOrderCost(o) - finHelperCost(o);
        return { o, margin, pct: price > 0 ? margin / price * 100 : 0 };
    }).filter(x => x.pct < 30).sort((a, b) => a.pct - b.pct).slice(0, 5);

    block.innerHTML = `
        <table class="fin-waterfall">
            ${row('💰 Выручка', m.revenue, 'total', `оплачено заказов: ${m.ordersPaid}`)}
            ${row(`− Налог ${s.taxPercent}% → в копилку`, m.tax)}
            ${row('− Материалы', m.materials)}
            ${row('− Помощникам', m.helpers)}
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
            `<div>№${safeHTML(x.o.orderNumber)} ${safeHTML(x.o.client || '')} — маржа ${formatMoney(x.margin)} (${x.pct.toFixed(0)}%)</div>`).join('')}</div>` : ''}`;

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
                    налог ${s.taxPercent}%, материалы и помощники ≈ ${(plan.variableShare * 100).toFixed(0)}% выручки.
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

function finPayFromCalendar(paymentId, dateStr) {
    finPaymentsMonth = finMonthKey(dateStr);
    finPay(paymentId); // finPay → renderAll: календарь, остаток месяца и остаток долга пересчитываются
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
