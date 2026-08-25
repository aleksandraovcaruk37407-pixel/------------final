
    // ========== ГЛОБАЛЬНЫЕ ДАННЫЕ ==========
    let colors = [], paints = [], films = [], extraRef = [], rates = [], ordersData = [], cashOps = [], bookings = [], materialTypes = [], regularExpenses = [], regularIncomes = [], notes = [];
    let budgetData = null;
    let currentFilter = 'all';
    let currentDate = new Date();
    let selectedDate = new Date();
    let orderEditId = null;
    let currentManualColor = 'auto';
    let extraModalOrderId = null;
    let editingServiceIndex = null;
    let currentExtraData = {};
    let currentServices = [];
    let localChangesPending = false;
    let currentReportPeriodType = 'month';

    function getDefaultBudgetData() {
        return {
            wallets: {
                tax: { name: 'Налог (4%)', target: 0, rate: 0.04, color: '#ffc107', icon: '💰' },
                personal: { name: 'Личные накопления (10%)', target: 0, rate: 0.10, color: '#17a2b8', icon: '👤' },
                business: { name: 'Улучшение бизнеса (5%)', target: 0, rate: 0.05, color: '#e67e22', icon: '🚀' },
                investments: { name: 'Инвестиции/Активы (5%)', target: 0, rate: 0.05, color: '#9b59b6', icon: '📈' }
            },
            mandatoryPayments: [
                { id: 'rent_place', name: 'Аренда помещения', amount: 30000, day: 28, icon: '🏢', target: 30000, saved: 0, paid: false },
                { id: 'rent_flat', name: 'Аренда квартиры', amount: 15000, day: 4, icon: '🏠', target: 15000, saved: 0, paid: false },
                { id: 'credit1', name: 'Кредит', amount: 13000, day: 27, icon: '🏦', target: 13000, saved: 0, paid: false },
                { id: 'iphone', name: 'Кредит на айфон', amount: 13000, day: 27, icon: '📱', target: 13000, saved: 0, paid: false },
                { id: 'alimony', name: 'Алименты', amount: 10000, day: 1, icon: '👶', target: 10000, saved: 0, paid: false },
                { id: 'mobile', name: 'Сотовая связь', amount: 3000, day: 1, icon: '📞', target: 3000, saved: 0, paid: false },
                { id: 'marketing', name: 'Реклама/Маркетинг', amount: 5000, day: 1, icon: '📢', target: 5000, saved: 0, paid: false }
            ],
            debts: [
                { id: 'credit1', name: 'Основной кредит', total: 260000, monthly: 13000, paid: 0, icon: '🏦' },
                { id: 'iphone', name: 'Кредит на айфон', total: 75000, monthly: 13000, paid: 0, icon: '📱' },
                { id: 'alimony', name: 'Алименты', total: 340000, monthly: 10000, paid: 0, icon: '👶' }
            ],
            distributionHistory: []
        };
    }

    function loadData() {
    colors = JSON.parse(localStorage.getItem('colors_data') || '[]');
    paints = JSON.parse(localStorage.getItem('paints_data') || '[]');
    films = JSON.parse(localStorage.getItem('films_data') || '[]');
    extraRef = JSON.parse(localStorage.getItem('extraRef_data') || '[]');
    rates = JSON.parse(localStorage.getItem('rates_data') || '[]');
    ordersData = JSON.parse(localStorage.getItem('orders_data') || '[]');
    cashOps = JSON.parse(localStorage.getItem('cash_data') || '[]');
    bookings = JSON.parse(localStorage.getItem('calendar_bookings') || '[]');
    materialTypes = JSON.parse(localStorage.getItem('materialTypes_data') || '[]');
    regularExpenses = JSON.parse(localStorage.getItem('regularExpenses_data') || '[]');
    regularIncomes = JSON.parse(localStorage.getItem('regularIncomes_data') || '[]');
    notes = JSON.parse(localStorage.getItem('notes_data') || '[]');

    budgetData = JSON.parse(localStorage.getItem('budget_data') || 'null') || getDefaultBudgetData();
    
    // Гарантия что все поля существуют (для старых данных)
    if (!budgetData.wallets) budgetData.wallets = getDefaultBudgetData().wallets;
    if (!budgetData.mandatoryPayments) budgetData.mandatoryPayments = getDefaultBudgetData().mandatoryPayments;
    if (!budgetData.debts) budgetData.debts = getDefaultBudgetData().debts;
    if (!budgetData.distributionHistory) budgetData.distributionHistory = [];

    rates.forEach(r => { if (!r.items) r.items = []; });
    const accidentService = rates.find(r => r.service === 'Восстановление после ДТП');
    if (accidentService) {
        accidentService.usesPaint = true;
        if (!accidentService.items.some(item => item.name === 'Краска')) {
            accidentService.items.push({name:'Краска', quantity:1, unit:'мл', price:0, perMeter:false, manual:true, enabled:true});
        }
    }

    colors.forEach(c => c.price = parseFloat(c.price) || 0);
    paints.forEach(p => p.price = parseFloat(p.price) || 0);
    films.forEach(f => f.price = parseFloat(f.price) || 0);
    extraRef.forEach(r => r.price = parseFloat(r.price) || 0);
    materialTypes.forEach(mt => mt.articles.forEach(a => a.price = parseFloat(a.price) || 0));
    ordersData.forEach(o => {
        o.clientPrice = parseFloat(o.clientPrice) || 0;
        o.helperPay = parseFloat(o.helperPay) || 0;
        if (o.services) o.services.forEach(inst => {
            inst.manualItems = inst.manualItems || {};
            if (inst.fabric) inst.fabric.price = parseFloat(inst.fabric.price) || 0;
            if (inst.paint) inst.paint.price = parseFloat(inst.paint.price) || 0;
            if (inst.film) inst.film.price = parseFloat(inst.film.price) || 0;
            materialTypes.forEach(mt => {
                if (inst[mt.name]) inst[mt.name].price = parseFloat(inst[mt.name].price) || 0;
            });
        });
    });

    if (!colors.length) {
    colors = [
        {category:'Велюр', code:'A1011', name:'Потолочная ткань (велюр)', price:1400},
        {category:'Велюр', code:'A1014', name:'Потолочная ткань (велюр)', price:1400},
        {category:'Сетка', code:'L1041', name:'Потолочная ткань (сетка)', price:1400},
        {category:'Сетка', code:'L1055', name:'Потолочная ткань (сетка) – Черный', price:1400}
    ];
}
if (!paints.length) {
    paints = [
        {category:'Акрил', code:'P001', name:'Краска черная', price:2.5},
        {category:'Акрил', code:'P002', name:'Краска белая', price:2.0},
        {category:'Водная', code:'P003', name:'Краска серая', price:2.2}
    ];
}
if (!films.length) {
    films = [
        {category:'Глянцевая', code:'FG-01', name:'Черный глянец', price:1200},
        {category:'Глянцевая', code:'FG-02', name:'Белый глянец', price:1200},
        {category:'Матовая', code:'FM-01', name:'Черный матовый', price:1100},
        {category:'Карбон', code:'FC-01', name:'Черный карбон', price:1500}
    ];
}

    if (!extraRef.length) {
        extraRef = [
            {name:'Клей', unit:'мл', price:5},
            {name:'Растворитель', unit:'мл', price:3},
            {name:'Активатор', unit:'мл', price:10},
            {name:'Вибропласт', unit:'лист', price:500},
            {name:'Шумопоглощающий материал', unit:'м²', price:300},
            {name:'Клей для шумоизоляции', unit:'мл', price:5}
        ];
    }
    if (!rates.length) {
        rates = [
            {service:'Перетяжка потолка', usesFabric:true, usesPaint:false, usesFilm:false, items:[
                {name:'Клей', quantity:150, unit:'мл', price:5, perMeter:true, manual:false, enabled:true},
                {name:'Растворитель', quantity:50, unit:'мл', price:3, perMeter:true, manual:false, enabled:true}
            ]},
            {service:'Восстановление после ДТП', usesFabric:true, usesPaint:true, usesFilm:false, items:[
                {name:'Грунт для пластика', quantity:100, unit:'мл', price:2, perMeter:false, manual:true, enabled:true},
                {name:'Шпаклёвка', quantity:200, unit:'г', price:0.5, perMeter:false, manual:true, enabled:true},
                {name:'Обезжиреватель', quantity:150, unit:'мл', price:3, perMeter:false, manual:true, enabled:true},
                {name:'Краска', quantity:1, unit:'мл', price:0, perMeter:false, manual:true, enabled:true}
            ]},
            {service:'Покраска пластика', usesFabric:false, usesPaint:true, usesFilm:false, items:[
                {name:'Грунт для пластика', quantity:80, unit:'мл', price:2, perMeter:false, manual:true, enabled:true},
                {name:'Обезжиреватель', quantity:100, unit:'мл', price:3, perMeter:false, manual:true, enabled:true},
                {name:'Растворитель', quantity:50, unit:'мл', price:3, perMeter:false, manual:true, enabled:true}
            ]},
            {service:'Аквапринт', usesFabric:false, usesPaint:false, usesFilm:true, items:[
                {name:'Активатор', quantity:200, unit:'мл', price:10, perMeter:false, manual:false, enabled:true}
            ]},
            {service:'Шумоизоляция', usesFabric:false, usesPaint:false, usesFilm:false, items:[
                {name:'Вибропласт', quantity:3, unit:'лист', price:500, perMeter:false, manual:true, enabled:true},
                {name:'Шумопоглощающий материал', quantity:4, unit:'м²', price:300, perMeter:false, manual:true, enabled:true},
                {name:'Клей для шумоизоляции', quantity:200, unit:'мл', price:5, perMeter:false, manual:true, enabled:true},
                {name:'ВИБРОПОГЛОЩЕНИЕ', quantity:1, unit:'м²', price:0, perMeter:true, manual:false, enabled:true, customMarker:true},
                {name:'ЗВУКОИЗОЛЯЦИЯ', quantity:1, unit:'м²', price:0, perMeter:true, manual:false, enabled:true, customMarker:true},
                {name:'ШУМОИЗОЛЯЦИЯ', quantity:1, unit:'м²', price:0, perMeter:true, manual:false, enabled:true, customMarker:true},
                {name:'ШУМОПОГЛОЩЕНИЕ', quantity:1, unit:'м²', price:0, perMeter:true, manual:false, enabled:true, customMarker:true}
            ]},
            {service:'Кузовной ремонт', usesFabric:false, usesPaint:false, usesFilm:false, items:[]}
        ];
    }
    if (!regularExpenses.length) {
        regularExpenses = [
            {desc:'Аренда помещения', day:28, amount:30000},
            {desc:'Квартира', day:4, amount:15000},
            {desc:'Кредит', day:27, amount:13000},
            {desc:'Кредитная карта', day:15, amount:12000}
        ];
    }
    if (!materialTypes.length) {
        materialTypes = [
            {
                name: 'ВИБРОПОГЛОЩЕНИЕ',
                unit: 'м²',
                articles: [
                    { code:'P4.0-лист', name:'Шумoff Practik 4.0 Лист 750 х 460 мм', price:520 },
                    { code:'P4.0-пачка', name:'Шумoff Practik 4.0 Пачка, листы 750 х 460 мм', price:3640 },
                    { code:'P3.0-лист', name:'Шумoff Practik 3.0 Лист 750 х 460 мм', price:420 },
                    { code:'P3.0-пачка', name:'Шумoff Practik 3.0 Пачка, листы 750 х 460 мм', price:4200 },
                    { code:'P2.1-лист', name:'Шумoff Practik 2.1 Лист 750 х 460 мм', price:335 },
                    { code:'P2.1-пачка', name:'Шумoff Practik 2.1 Пачка, листы 750 х 460 мм', price:5019 },
                    { code:'P1.6-лист', name:'Шумoff Practik 1.6 Лист 750 х 460 мм', price:290 },
                    { code:'P1.6-пачка', name:'Шумoff Practik 1.6 Пачка, листы 750 х 460 мм', price:5796 },
                    { code:'Layer-лист', name:'Шумоff Layer (Лайер) Лист 370 х 270 мм', price:110 },
                    { code:'Layer-м2', name:'Шумоff Layer (Лайер) м²', price:1100 },
                    { code:'Layer-пачка', name:'Шумоff Layer (Лайер) Пачка, листы 370 х 270 мм', price:2750 },
                    { code:'Проф8Ф-лист', name:'Шумофф Проф 8Ф Лист 370 х 270 мм', price:422 },
                    { code:'Проф8Ф-м2', name:'Шумофф Проф 8Ф м²', price:4220 },
                    { code:'Проф8Ф-пачка', name:'Шумофф Проф 8Ф Пачка, листы 370 х 270 мм', price:2532 },
                    { code:'ПрофФ-лист', name:'Шумофф Проф Ф Лист 370 х 270 мм', price:266 },
                    { code:'ПрофФ-м2', name:'Шумофф Проф Ф м²', price:2660 },
                    { code:'ПрофФ-пачка', name:'Шумофф Проф Ф Пачка, листы 370 х 270 мм', price:3192 },
                    { code:'Bass-лист', name:'Шумоff Bass (Басс) Лист 750 х 540 мм', price:972 },
                    { code:'Bass-м2', name:'Шумоff Bass (Басс) м²', price:2430 },
                    { code:'Bass-пачка', name:'Шумоff Bass (Басс) Пачка, листы 750 х 540 мм', price:3888 },
                    { code:'МиксФ-лист', name:'Шумофф Микс Ф Лист 370 х 270 мм', price:318 },
                    { code:'МиксФ-м2', name:'Шумофф Микс Ф м²', price:3180 },
                    { code:'МиксФ-пачка', name:'Шумофф Микс Ф Пачка, листы 370 х 270 мм', price:3180 },
                    { code:'L2-лист-370', name:'Шумоff Light 2 (Лайт 2) Лист 370 х 270 мм', price:141 },
                    { code:'L2-лист-750', name:'Шумоff Light 2 (Лайт 2) Лист 750*540 мм', price:564 },
                    { code:'L2-м2', name:'Шумоff Light 2 (Лайт 2) м²', price:1410 },
                    { code:'L2-пачка-370', name:'Шумоff Light 2 (Лайт 2) Пачка, листы 370 х 270 мм', price:3102 },
                    { code:'L2-пачка-750', name:'Шумоff Light 2 (Лайт 2) Пачка, листы 750 х 540 мм', price:5640 },
                    { code:'S5-лист', name:'Шумoff SPACE 5.0 (Спэйс) Лист 370 х 250 мм', price:303 },
                    { code:'S5-м2', name:'Шумoff SPACE 5.0 (Спэйс) м²', price:3360 },
                    { code:'S5-пачка', name:'Шумoff SPACE 5.0 (Спэйс) Пачка, листы 370 х 250 мм', price:3024 },
                    { code:'S2-лист', name:'Шумoff SPACE 2.0 (Спэйс) Лист 370 х 250 мм', price:183 },
                    { code:'S2-м2', name:'Шумoff SPACE 2.0 (Спэйс) м²', price:2030 },
                    { code:'S2-пачка', name:'Шумoff SPACE 2.0 (Спэйс) Пачка, листы 370 х 250 мм', price:3654 },
                    { code:'M4-лист-370', name:'Шумофф М4 Лист 370 х 270 мм', price:193 },
                    { code:'M4-лист-750', name:'Шумофф М4 Лист 750*540 мм', price:772 },
                    { code:'M4-м2', name:'Шумофф М4 м²', price:1930 },
                    { code:'M4-пачка-370', name:'Шумофф М4 Пачка, листы 370 х 270 мм', price:2316 },
                    { code:'M4-пачка-750', name:'Шумофф М4 Пачка, листы 750 х 540 мм', price:4632 },
                    { code:'M3-лист-370', name:'Шумофф М3 Лист 370 х 270 мм', price:167 },
                    { code:'M3-лист-750', name:'Шумофф М3 Лист 750*540 мм', price:668 },
                    { code:'M3-м2', name:'Шумофф М3 м²', price:1670 },
                    { code:'M3-пачка-370', name:'Шумофф М3 Пачка, листы 370 х 270 мм', price:2672 },
                    { code:'M3-пачка-750', name:'Шумофф М3 Пачка, листы 750 х 540 мм', price:5344 },
                    { code:'M2-лист-370', name:'Шумофф М2 Лист 370 х 270 мм', price:141 },
                    { code:'M2-лист-750', name:'Шумофф М2 Лист 750*540 мм', price:564 },
                    { code:'M2-м2', name:'Шумофф М2 м²', price:1410 },
                    { code:'M2-пачка-370', name:'Шумофф М2 Пачка, листы 370 х 270 мм', price:3102 },
                    { code:'M2-пачка-750', name:'Шумофф М2 Пачка, листы 750 х 540 мм', price:5640 },
                    { code:'SJ-лист', name:'Шумоff Super Jack (Супер Джек) Лист 370 х 270 мм', price:214 },
                    { code:'SJ-м2', name:'Шумоff Super Jack (Супер Джек) м²', price:2140 },
                    { code:'SJ-пачка', name:'Шумоff Super Jack (Супер Джек) Пачка, листы 370 х 270 мм', price:2782 },
                    { code:'BJ-лист', name:'Шумоff Black Jack (Блэк Джек) Лист 370 х 270 мм', price:193 },
                    { code:'BJ-м2', name:'Шумоff Black Jack (Блэк Джек) м²', price:1930 },
                    { code:'BJ-пачка', name:'Шумоff Black Jack (Блэк Джек) Пачка, листы 370 х 270 мм', price:3474 },
                    { code:'Jack-лист', name:'Шумоff Jack (Джек) Лист 370 х 270 мм', price:162 },
                    { code:'Jack-м2', name:'Шумоff Jack (Джек) м²', price:1620 },
                    { code:'Jack-пачка', name:'Шумоff Jack (Джек) Пачка, листы 370 х 270 мм', price:4050 }
                ]
            },
            {
                name: 'ЗВУКОИЗОЛЯЦИЯ',
                unit: 'м²',
                articles: [
                    { code:'PF-лист', name:'Шумoff Practik Finish Лист 750 х 460 мм', price:530 },
                    { code:'PF-пачка', name:'Шумoff Practik Finish Пачка, листы 750 х 460 мм', price:5300 },
                    { code:'PM-лист', name:'Шумoff Membrane Лист 750 х 540 мм', price:580 },
                    { code:'PM-пачка', name:'Шумoff Membrane Пачка, листы 750 х 540 мм', price:4060 },
                    { code:'OUT-лист', name:'Шумoff OUT (Аут) Лист 750 х 540 мм', price:980 },
                    { code:'OUT-пачка', name:'Шумoff OUT (Аут) Пачка, листы 750 х 540 мм', price:4900 }
                ]
            },
            {
                name: 'ШУМОИЗОЛЯЦИЯ',
                unit: 'м²',
                articles: [
                    { code:'П8-лист', name:'Шумофф П8 Лист 750 х 560 мм', price:490 },
                    { code:'П4-лист', name:'Шумофф П4 Лист 750 х 560 мм', price:305 },
                    { code:'П8В-лист', name:'Шумофф П8В Лист 750 х 560 мм', price:670 },
                    { code:'П4В-лист', name:'Шумофф П4В Лист 750 х 560 мм', price:405 },
                    { code:'К10-лист', name:'Шумофф Комфорт 10 Лист 750 х 1000 мм', price:1780 },
                    { code:'К20Pro-лист', name:'Шумофф Комфорт А20Pro Лист 750 х 1000 мм', price:2350 },
                    { code:'К6-лист', name:'Шумофф Комфорт 6 Лист 750 х 1000 мм', price:1300 },
                    { code:'К3-лист', name:'Шумофф Комфорт 3 Лист 750 х 1000 мм', price:1155 },
                    { code:'BOut-лист', name:'Шумoff Practik BlockOut Лист 750 х 460 мм', price:670 },
                    { code:'BOut-пачка', name:'Шумoff Practik BlockOut Пачка, листы 750 х 460 мм', price:3350 },
                    { code:'Paradox-лист', name:'Шумoff Paradox Лист 750 х 500 мм', price:635 },
                    { code:'Paradox-пачка', name:'Шумoff Paradox Пачка, листы 750 х 500 мм', price:3810 },
                    { code:'Композит-лист', name:'Шумофф Композит Лист 750 х 500 мм', price:770 },
                    { code:'Композит-пачка', name:'Шумофф Композит Пачка, листы 750 х 500 мм', price:3080 },
                    { code:'Prizma6-лист', name:'Шумoff Prizma 6 Лист 750 х 500 мм', price:1115 },
                    { code:'Prizma6-пачка', name:'Шумoff Prizma 6 Пачка, листы 750 х 500 мм', price:4460 },
                    { code:'Prizma3-лист', name:'Шумoff Prizma 3 Лист 750 х 500 мм', price:1000 },
                    { code:'Prizma3-пачка', name:'Шумoff Prizma 3 Пачка, листы 750 х 500 мм', price:6000 }
                ]
            },
            {
                name: 'ШУМОПОГЛОЩЕНИЕ',
                unit: 'м²',
                articles: [
                    { code:'PF-A15', name:'Шумoff Practik Flex A15 Лист 750 х 1000 мм', price:900 },
                    { code:'PA-10', name:'Шумoff Practik Autovelox 10 Лист 750 х 1000 мм', price:615 },
                    { code:'AA15', name:'Шумoff Absorber A15 (Абсорбер) Лист 750 х 1000 мм', price:1530 },
                    { code:'UW17', name:'Шумоff Ultimat W17 Лист 750 х 1000 мм', price:1035 },
                    { code:'A10', name:'Шумoff Absorber 10 (Абсорбер) Лист 750 х 1000 мм', price:1305 },
                    { code:'G7L', name:'Шумофф Герметон 7Л Лист 750 х 1000 мм', price:1640 },
                    { code:'G7', name:'Шумофф Герметон 7 Лист 750 х 1000 мм', price:1250 },
                    { code:'FT', name:'Шумоff FanTon Лист 750 х 1000 мм', price:1515 },
                    { code:'GA30', name:'Шумофф Герметон А30 Лист 750 х 1000 мм', price:3065 },
                    { code:'GA15L', name:'Шумофф Герметон А15Л Лист 750 х 1000 мм', price:2030 },
                    { code:'GA15', name:'Шумофф Герметон А15 Лист 750 х 1000 мм', price:1730 }
                ]
            }
        ];
    }
    saveAll();
}
    function saveAll() {
    localStorage.setItem('colors_data', JSON.stringify(colors));
    localStorage.setItem('paints_data', JSON.stringify(paints));
    localStorage.setItem('films_data', JSON.stringify(films));
    localStorage.setItem('extraRef_data', JSON.stringify(extraRef));
    localStorage.setItem('rates_data', JSON.stringify(rates));
    localStorage.setItem('orders_data', JSON.stringify(ordersData));
    localStorage.setItem('cash_data', JSON.stringify(cashOps));
    localStorage.setItem('calendar_bookings', JSON.stringify(bookings));
    localStorage.setItem('materialTypes_data', JSON.stringify(materialTypes));
    localStorage.setItem('regularExpenses_data', JSON.stringify(regularExpenses));
    localStorage.setItem('regularIncomes_data', JSON.stringify(regularIncomes));
    localStorage.setItem('notes_data', JSON.stringify(notes));
    localStorage.setItem('budget_data', JSON.stringify(budgetData));

    if (window.db && window.fbSet && window.fbRef) {
        const syncPayload = {
            colors, paints, films, extraRef, rates, ordersData, 
            cashOps, bookings, materialTypes, regularExpenses, regularIncomes, notes
        };
        window.fbSet(window.fbRef(window.db, 'atelier_data'), syncPayload)
            .then(() => {
                // Синхронизировано успешно
            })
            .catch(err => console.error("Ошибка сохранения в Firebase:", err));
    }
}

    // ========== БЮДЖЕТ: РАСПРЕДЕЛЕНИЕ ОТ ЗАКАЗА К ЗАКАЗУ ==========
    function saveBudgetData() {
        localStorage.setItem('budget_data', JSON.stringify(budgetData));
    }

    function getOrderCost(order) {
        let cost = 0;
        (order.services || []).forEach(inst => {
            const svc = rates.find(r => r.service === inst.serviceName);
            if (!svc) return;
            svc.items.forEach(item => {
                if (item.enabled === false) return;
                if (item.customMarker) return;
                if (item.name === 'Краска' && serviceUsesPaint(svc)) return;
                if (item.name === 'Пленка для аквапринта' && svc.usesFilm) return;
                if (item.name === 'Ткань' && svc.usesFabric) return;
                let qty = 0;
                if ((inst.manualItems || {})[item.name] !== undefined) qty = parseFloat((inst.manualItems || {})[item.name])||0;
                else if (!item.manual) qty = item.perMeter ? (parseFloat(item.quantity)||0) * getServiceMeters(inst) : (parseFloat(item.quantity)||0);
                cost += qty * (parseFloat(item.price)||0);
            });
            materialTypes.forEach(mt => {
                const markerItem = svc.items.find(item => item.enabled !== false && item.name === mt.name);
                if (markerItem) {
                    const markerData = inst[mt.name];
                    if (markerData && markerData.code) {
                        const qty = parseFloat(markerData.sheets || markerData.qty || 0);
                        cost += qty * (parseFloat(markerData.price)||0);
                    }
                }
            });
        });
        return cost;
    }

    function populateBudgetOrderSelect() {
        const select = document.getElementById('budgetOrderSelect');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Выбери заказ --</option>';
        ordersData.forEach(order => {
            const opt = document.createElement('option');
            opt.value = order.orderNumber;
            opt.textContent = `№${order.orderNumber} — ${order.client || 'Без клиента'} — ${parseFloat(order.clientPrice || 0).toLocaleString()} ₽`;
            select.appendChild(opt);
        });
        if (currentValue) select.value = currentValue;
    }

    function distributeFromOrder() {
        const select = document.getElementById('budgetOrderSelect');
        const orderNumber = select.value;
        if (!orderNumber) {
            alert('Выбери заказ!');
            return;
        }

        const order = ordersData.find(o => o.orderNumber == orderNumber);
        if (!order) { alert('Заказ не найден!'); return; }

        const clientPrice = parseFloat(order.clientPrice) || 0;
        const orderCost = getOrderCost(order);
        const helperPay = parseFloat(order.helperPay) || 0;
        const netProfit = Math.max(0, clientPrice - orderCost - helperPay);

        if (netProfit <= 0) {
            alert('Чистая прибыль с этого заказа 0 или отрицательная (расходы >= оплата). Распределить нечего.');
            return;
        }

        const tax = netProfit * 0.04;
        const personal = netProfit * 0.10;
        const business = netProfit * 0.05;
        const investments = netProfit * 0.05;
        const mandatory = netProfit - tax - personal - business - investments;

        budgetData.wallets.tax.target += tax;
        budgetData.wallets.personal.target += personal;
        budgetData.wallets.business.target += business;
        budgetData.wallets.investments.target += investments;

        // Распределяем на обязательные платежи
        let remaining = mandatory;
        const distributions = [];

        budgetData.mandatoryPayments
            .filter(mp => !mp.paid)
            .sort((a, b) => a.day - b.day)
            .forEach(mp => {
                if (remaining <= 0) return;
                const needed = mp.target - mp.saved;
                const toAdd = Math.min(remaining, needed);
                mp.saved += toAdd;
                remaining -= toAdd;
                distributions.push({ name: mp.name, amount: toAdd });
            });

        // Если остались деньги → на досрочное погашение долгов
        let extraDebt = 0;
        if (remaining > 0) {
            budgetData.debts.forEach(debt => {
                if (remaining <= 0) return;
                const payment = Math.min(remaining, debt.monthly);
                debt.paid += payment;
                extraDebt += payment;
                remaining -= payment;
            });
        }

        // Записываем в историю
        budgetData.distributionHistory.unshift({
            date: new Date().toLocaleString('ru-RU'),
            orderNumber: order.orderNumber,
            client: order.client || 'Без клиента',
            clientPrice,
            orderCost,
            helperPay,
            netProfit,
            tax,
            personal,
            business,
            investments,
            mandatory,
            extraDebt,
            distributions
        });

        // Не более 50 записей
        if (budgetData.distributionHistory.length > 50) {
            budgetData.distributionHistory = budgetData.distributionHistory.slice(0, 50);
        }

        saveBudgetData();
        renderBudget();

        // Показываем результат
        const resultDiv = document.getElementById('budgetDistributionResult');
        resultDiv.innerHTML = `
            <div class="budget-result">
                <div style="font-weight:700;margin-bottom:8px;font-size:15px;">✅ Распределение выполнено:</div>
                <div class="budget-result-row"><span class="label">Оплата от клиента:</span><span class="value">${clientPrice.toLocaleString()} ₽</span></div>
                <div class="budget-result-row"><span class="label">Расходы на заказ:</span><span class="value" style="color:#e74c3c;">-${orderCost.toLocaleString()} ₽</span></div>
                <div class="budget-result-row"><span class="label">Помощник:</span><span class="value" style="color:#e74c3c;">-${helperPay.toLocaleString()} ₽</span></div>
                <div class="budget-result-row highlight"><span class="label">Чистая прибыль:</span><span class="value" style="color:#27ae60;">${netProfit.toLocaleString()} ₽</span></div>
                <div style="margin:10px 0 5px 0;border-top:1px dashed #ccc;padding-top:8px;">
                    <div class="budget-result-row tax"><span class="label">💰 Налог (4%):</span><span class="value">${tax.toFixed(2)} ₽</span></div>
                    <div class="budget-result-row personal"><span class="label">👤 Личные (10%):</span><span class="value">${personal.toFixed(2)} ₽</span></div>
                    <div class="budget-result-row" style="color:#e67e22;"><span class="label">🚀 Улучшение бизнеса (5%):</span><span class="value" style="color:#e67e22;">${business.toFixed(2)} ₽</span></div>
                    <div class="budget-result-row" style="color:#9b59b6;"><span class="label">📈 Инвестиции/Активы (5%):</span><span class="value" style="color:#9b59b6;">${investments.toFixed(2)} ₽</span></div>
                    <div class="budget-result-row mandatory"><span class="label">📌 Обязательные платежи:</span><span class="value">${mandatory.toFixed(2)} ₽</span></div>
                </div>
                ${extraDebt > 0 ? `<div class="budget-result-row" style="background:#fff3cd;padding:6px;border-radius:4px;margin-top:6px;"><span class="label">⚡ Досрочное погашение долгов:</span><span class="value" style="color:#e67e22;">${extraDebt.toFixed(2)} ₽</span></div>` : ''}
                <div style="margin-top:8px;font-size:13px;color:#666;">
                    <b>Куда пошло:</b><br>
                    ${distributions.map(d => `${d.name}: +${d.amount.toFixed(2)} ₽`).join('<br>')}
                    ${extraDebt > 0 ? `<br>Досрочное погашение: +${extraDebt.toFixed(2)} ₽` : ''}
                </div>
            </div>
        `;
    }

    function payMandatoryPayment(idx) {
        const mp = budgetData.mandatoryPayments[idx];
        if (!mp || mp.paid) return;
        if (!confirm(`Отметить "${mp.name}" как оплаченный?`)) return;
        mp.paid = true;
        saveBudgetData();
        renderBudget();
    }

    function resetMandatoryPayment(idx) {
        const mp = budgetData.mandatoryPayments[idx];
        if (!mp) return;
        if (!confirm(`Сбросить статус оплаты "${mp.name}"?`)) return;
        mp.paid = false;
        saveBudgetData();
        renderBudget();
    }

    function renderBudget() {
        renderMandatoryPayments();
        renderDebts();
        renderWallets();
        renderDistributionHistory();
        populateBudgetOrderSelect();
    }

    function renderMandatoryPayments() {
        const container = document.getElementById('mandatoryPaymentsProgress');
        if (!container) return;

        const sorted = budgetData.mandatoryPayments.map((mp, idx) => ({...mp, idx}))
            .sort((a, b) => a.day - b.day);

        container.innerHTML = sorted.map(mp => {
            const percent = Math.min(100, (mp.saved / mp.target) * 100);
            const isPaid = mp.paid;
            return `
                <div class="budget-progress-item ${isPaid ? 'paid' : ''}">
                    <div class="budget-progress-header">
                        <span class="name">${mp.icon} ${mp.name}</span>
                        <span class="amount">${isPaid ? '✅ Оплачен' : `${mp.saved.toLocaleString()} / ${mp.target.toLocaleString()} ₽`}</span>
                    </div>
                    <div class="progress-bar-budget">
                        <div class="progress-fill-budget" style="width:${percent}%">${percent.toFixed(0)}%</div>
                    </div>
                    <div class="budget-progress-meta">
                        <span>Накоплено: ${mp.saved.toLocaleString()} ₽ из ${mp.target.toLocaleString()} ₽</span>
                        <span>День месяца: ${mp.day}</span>
                    </div>
                    <div style="margin-top:8px;display:flex;gap:6px;">
                        ${!isPaid ? `<button class="btn-budget-pay" onclick="payMandatoryPayment(${mp.idx})">💰 Отметить оплаченным</button>` : ''}
                        ${isPaid ? `<button class="btn-budget-pay" style="background:#6c757d;" onclick="resetMandatoryPayment(${mp.idx})">↺ Сбросить</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderDebts() {
        const container = document.getElementById('debtsProgress');
        if (!container) return;

        container.innerHTML = budgetData.debts.map(debt => {
            const remaining = debt.total - debt.paid;
            const percent = Math.min(100, (debt.paid / debt.total) * 100);
            const monthsLeft = Math.ceil(remaining / debt.monthly);

            return `
                <div class="budget-progress-item">
                    <div class="budget-progress-header">
                        <span class="name">${debt.icon} ${debt.name}</span>
                        <span class="amount">${remaining.toLocaleString()} ₽ осталось</span>
                    </div>
                    <div class="progress-bar-budget">
                        <div class="progress-fill-budget" style="width:${percent}%">${percent.toFixed(1)}%</div>
                    </div>
                    <div class="budget-progress-meta">
                        <span>Оплачено: ${debt.paid.toLocaleString()} ₽ из ${debt.total.toLocaleString()} ₽</span>
                        <span>~${monthsLeft} мес. осталось</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderWallets() {
        const container = document.getElementById('walletsOverview');
        if (!container) return;

        container.innerHTML = Object.entries(budgetData.wallets).map(([key, wallet]) => `
            <div class="wallet-item">
                <span class="wallet-name" style="color:${wallet.color}">${wallet.icon || '💰'} ${wallet.name}</span>
                <span class="wallet-amount">${wallet.target.toLocaleString()} ₽</span>
            </div>
        `).join('');
    }

    function renderDistributionHistory() {
        const container = document.getElementById('distributionHistory');
        if (!container) return;

        if (!budgetData.distributionHistory || budgetData.distributionHistory.length === 0) {
            container.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">Пока нет распределений. Выбери заказ и нажми "Распределить"</div>';
            return;
        }

        container.innerHTML = budgetData.distributionHistory.map(dist => `
            <div class="dist-history-item">
                <div class="dist-history-date">${dist.date} — №${dist.orderNumber} (${dist.client || 'Без клиента'})</div>
                <div class="dist-history-row"><span>Чистая прибыль:</span><span style="color:#27ae60;font-weight:600;">${dist.netProfit.toLocaleString()} ₽</span></div>
                <div class="dist-history-row"><span>Налог:</span><span style="color:#ffc107;">${dist.tax.toFixed(2)} ₽</span></div>
                <div class="dist-history-row"><span>Личные:</span><span style="color:#17a2b8;">${dist.personal.toFixed(2)} ₽</span></div>
                <div class="dist-history-row"><span>Улучшение бизнеса:</span><span style="color:#e67e22;">${dist.business.toFixed(2)} ₽</span></div>
                <div class="dist-history-row"><span>Инвестиции:</span><span style="color:#9b59b6;">${dist.investments.toFixed(2)} ₽</span></div>
                <div class="dist-history-row"><span>Обязательные:</span><span style="color:#e67e22;">${dist.mandatory.toFixed(2)} ₽</span></div>
                ${dist.extraDebt > 0 ? `<div class="dist-history-row"><span>Досрочное погашение:</span><span style="color:#e67e22;font-weight:600;">+${dist.extraDebt.toFixed(2)} ₽</span></div>` : ''}
            </div>
        `).join('');
    }


    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function getOrderColorObj(order) {
        if (order.done) return 'done';
        if (order.manualColor && order.manualColor !== 'auto') return order.manualColor;
        const start = new Date(order.date);
        const now = new Date();
        const durDays = parseInt(order.durationDays) || 0;
        if (!order.date || durDays === 0) return 'new';
        const ratio = (now - start) / (1000*60*60*24) / durDays;
        if (ratio < 0.6) return 'new';
        if (ratio < 0.8) return 'middle';
        return 'critical';
    }

    function getDeadline(order) {
        if (!order.date || isNaN(new Date(order.date).getTime())) return '';
        const d = new Date(order.date);
        d.setDate(d.getDate() + (parseInt(order.durationDays) || 0));
        return d.toISOString().slice(0,10);
    }

    function formatDate(d) {
        if (!d || isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function formatPhone(input) {
        let val = input.value.replace(/\D/g,'');
        if (val.startsWith('8')) val = '7'+val.slice(1);
        if (!val.startsWith('7')) val = '7'+val;
        if (val.length > 11) val = val.slice(0,11);
        input.value = '+'+val;
    }

    function serviceUsesMarker(svc, markerName) {
        return !!svc && (svc.items || []).some(item => item.enabled !== false && String(item.name || '').trim().toLowerCase() === markerName.toLowerCase());
    }

    function serviceUsesPaint(svc) {
        return serviceUsesMarker(svc, 'Краска');
    }

    function getServiceMeters(inst) {
        const fabricMeters = parseFloat(inst?.fabric?.meters) || 0;
        const filmMeters = parseFloat(inst?.film?.meters) || 0;
        return fabricMeters || filmMeters;
    }

    // ========== РАСЧЕТ СЕБЕСТОИМОСТИ ==========
    function recalcOrder(order) {
        let totalCost = 0;
        order.services.forEach(inst => {
            const svc = rates.find(r => r.service === inst.serviceName);
            if (!svc) return;
            if (serviceUsesMarker(svc, 'Ткань') && inst.fabric) {
                const meters = parseFloat(inst.fabric.meters)||0;
                const price = parseFloat(inst.fabric.price)||0;
                totalCost += meters * price;
            }
            if (serviceUsesPaint(svc) && inst.paint) {
                const found = paints.find(p => p.code === inst.paint.code);
                totalCost += (parseFloat(inst.paint.qty)||0) * (found ? parseFloat(found.price)||0 : 0);
            }
            if (serviceUsesMarker(svc, 'Пленка для аквапринта') && inst.film) {
                const found = films.find(f => f.code === inst.film.code);
                totalCost += (parseFloat(inst.film.meters)||0) * (found ? parseFloat(found.price)||0 : 0);
            }
            svc.items.forEach(item => {
                if (item.enabled === false) return;
                if (item.customMarker) return;
                if (item.name === 'Краска' && serviceUsesPaint(svc)) return;
                if (item.name === 'Пленка для аквапринта' && serviceUsesMarker(svc, 'Пленка для аквапринта')) return;
                if (item.name === 'Ткань' && serviceUsesMarker(svc, 'Ткань')) return;
                if (materialTypes.some(mt => mt.name === item.name)) return;
                let qty = 0;
                if ((inst.manualItems || {})[item.name] !== undefined) qty = parseFloat((inst.manualItems || {})[item.name])||0;
                else if (!item.manual) qty = item.perMeter ? (parseFloat(item.quantity)||0) * getServiceMeters(inst) : (parseFloat(item.quantity)||0);
                totalCost += qty * (parseFloat(item.price)||0);
            });
            materialTypes.forEach(mt => {
                const markerItem = svc.items.find(item => item.enabled !== false && item.name === mt.name);
                const markerData = inst[mt.name];
                if (markerItem && markerData && markerData.code) {
                    const art = mt.articles.find(a => a.code === markerData.code);
                    if (art) {
                        const qty = parseFloat(markerData.sheets || markerData.qty || 0);
                        totalCost += qty * (parseFloat(art.price)||0);
                    }
                }
            });
        });
        let extra = {};
        try { extra = JSON.parse(order.extraData || '{}'); } catch(e) {}
        for (let key in extra) {
            const ref = extraRef.find(e => e.name === key);
            if (ref) totalCost += (parseFloat(extra[key])||0) * (parseFloat(ref.price)||0);
        }
        order.materialCost = totalCost;
        order.grossProfit = (parseFloat(order.clientPrice)||0) - totalCost - (parseFloat(order.helperPay)||0);
        return order;
    }

    // ========== СКЛАД ==========
    function loadStock() {
        return JSON.parse(localStorage.getItem('stock_data') || '[]');
    }
    function saveStock(stock) {
        localStorage.setItem('stock_data', JSON.stringify(stock));
    }

    function recalculateStockFromAllOrders() {
        let stock = loadStock().map(item => ({...item, used:0}));
        const ensure = (name, unit, price) => {
            let item = stock.find(s => s.name === name);
            if (!item) {
                item = {name, unit, price, income:0, used:0, remain:0};
                stock.push(item);
            }
            return item;
        };
        ordersData.forEach(order => {
            order.services.forEach(inst => {
                const svc = rates.find(r => r.service === inst.serviceName);
                if (!svc) return;
                if (serviceUsesMarker(svc, 'Ткань') && inst.fabric && parseFloat(inst.fabric.meters) > 0) {
                    const glue = ensure('Клей', 'мл', extraRef.find(e=>e.name==='Клей')?.price || 0);
                    glue.used += parseFloat(inst.fabric.meters) * 150;
                    const thinner = ensure('Растворитель', 'мл', extraRef.find(e=>e.name==='Растворитель')?.price || 0);
                    thinner.used += parseFloat(inst.fabric.meters) * 50;
                }
                if (serviceUsesPaint(svc) && inst.paint && parseFloat(inst.paint.qty) > 0) {
                    const paint = paints.find(p => p.code === inst.paint.code);
                    if (paint) {
                        const item = ensure(paint.name, 'мл', parseFloat(paint.price)||0);
                        item.used += parseFloat(inst.paint.qty);
                    }
                }
                if (serviceUsesMarker(svc, 'Пленка для аквапринта') && inst.film && parseFloat(inst.film.meters) > 0) {
                    const film = films.find(f => f.code === inst.film.code);
                    if (film) {
                        const item = ensure(film.name, 'м', parseFloat(film.price)||0);
                        item.used += parseFloat(inst.film.meters);
                    }
                }
                svc.items.forEach(item => {
                    if (item.customMarker) return;
                    if (item.name === 'Краска' && serviceUsesPaint(svc)) return;
                    if (item.name === 'Пленка для аквапринта' && svc.usesFilm) return;
                    if (item.name === 'Ткань' && svc.usesFabric) return;
                    if (materialTypes.some(mt => mt.name === item.name)) return;
                    let qty = (inst.manualItems || {})[item.name] !== undefined ? parseFloat((inst.manualItems || {})[item.name]) : (item.manual ? 0 : (item.perMeter ? (parseFloat(item.quantity)||0) * getServiceMeters(inst) : (parseFloat(item.quantity)||0)));
                    if (qty > 0) {
                        const stockItem = ensure(item.name, item.unit, parseFloat(item.price)||0);
                        stockItem.used += qty;
                    }
                });
                materialTypes.forEach(mt => {
                    const markerItem = svc.items.find(item => item.enabled !== false && item.name === mt.name);
                    const markerData = inst[mt.name];
                    if (markerItem && markerData && markerData.code) {
                        const art = mt.articles.find(a => a.code === markerData.code);
                        if (art) {
                            const qty = markerItem.manual ? (parseFloat(markerData.qty)||0) : (markerItem.perMeter ? (parseFloat(markerItem.quantity)||0) * getServiceMeters(inst) : (parseFloat(markerItem.quantity)||0));
                            if (qty <= 0) return;
                            const stockItem = ensure(art.name, mt.unit, parseFloat(art.price)||0);
                            stockItem.used += qty;
                        }
                    }
                });
            });
            let extra = {};
            try { extra = JSON.parse(order.extraData || '{}'); } catch(e) {}
            for (let key in extra) {
                const qty = parseFloat(extra[key]) || 0;
                if (qty > 0) {
                    const ref = extraRef.find(e => e.name === key);
                    if (ref) {
                        const stockItem = ensure(key, ref.unit, parseFloat(ref.price)||0);
                        stockItem.used += qty;
                    }
                }
            }
        });
        stock.forEach(item => item.remain = (parseFloat(item.income)||0) - (parseFloat(item.used)||0));
        saveStock(stock);
    }

    // ========== ДЕНЬГИ ==========
    function renderCash() {
        const tbody = document.getElementById('cashBody');
        tbody.innerHTML = '';
        let balance = 0;
        cashOps.forEach((op, idx) => {
            balance += parseFloat(op.income)||0 - parseFloat(op.expense)||0;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${op.date}</td><td>${op.desc}</td><td>${(parseFloat(op.income)||0).toFixed(2)}</td><td>${(parseFloat(op.expense)||0).toFixed(2)}</td><td>${balance.toFixed(2)}</td><td><button class="btn-del" onclick="deleteCashOp(${idx})">✕</button></td>`;
            tbody.appendChild(tr);
        });
        document.getElementById('cashBalance').textContent = balance.toFixed(2);
        const regDiv = document.getElementById('regularExpensesList');
        regDiv.innerHTML = '';
        regularExpenses.forEach((exp, idx) => {
            const div = document.createElement('div');
            div.innerHTML = `<span>${exp.desc} (${exp.day} числа, ${exp.amount}₽) <button class="btn-del" onclick="deleteRegularExpense(${idx})">✕</button></span>`;
            regDiv.appendChild(div);
        });
        const incomeDiv = document.getElementById('regularIncomesList');
        incomeDiv.innerHTML = '';
        regularIncomes.forEach((income, idx) => {
            const div = document.createElement('div');
            div.innerHTML = `<span>${income.desc} (${income.day} числа, ${income.amount}₽) <button class="btn-del" onclick="deleteRegularIncome(${idx})">✕</button></span>`;
            incomeDiv.appendChild(div);
        });
    }

    function addCashRow() {
        const date = prompt('Дата (ГГГГ-ММ-ДД):', formatDate(new Date()));
        if (!date) return;
        const desc = prompt('Описание:');
        if (!desc) return;
        const income = parseFloat(prompt('Приход:', '0')) || 0;
        const expense = parseFloat(prompt('Расход:', '0')) || 0;
        cashOps.push({date, desc, income, expense});
        saveAll();
        renderAll();
    }

    function addRegularExpense() {
        const desc = prompt('Название регулярного расхода (например, Аренда):');
        if (!desc) return;
        const day = parseInt(prompt('День месяца (1-31):', '1'));
        if (isNaN(day) || day < 1 || day > 31) { alert('Неверный день'); return; }
        const amount = parseFloat(prompt('Сумма (₽):', '0'));
        if (isNaN(amount) || amount <= 0) { alert('Неверная сумма'); return; }
        regularExpenses.push({desc, day, amount});
        saveAll();
        renderAll();
    }

    function deleteRegularExpense(idx) {
        regularExpenses.splice(idx, 1);
        saveAll();
        renderAll();
    }

    function addRegularIncome() {
        const desc = prompt('Название регулярного дохода (например, Оплата за заказ):');
        if (!desc) return;
        const day = parseInt(prompt('День месяца (1-31):', '1'));
        if (isNaN(day) || day < 1 || day > 31) { alert('Неверный день'); return; }
        const amount = parseFloat(prompt('Сумма (₽):', '0'));
        if (isNaN(amount) || amount <= 0) { alert('Неверная сумма'); return; }
        regularIncomes.push({desc, day, amount});
        saveAll();
        renderAll();
    }

    function deleteRegularIncome(idx) {
        regularIncomes.splice(idx, 1);
        saveAll();
        renderAll();
    }

    function renderMarkersTable() {
        const markerNames = ['ВИБРОПОГЛОЩЕНИЕ', 'ШУМОИЗОЛЯЦИЯ', 'ЗВУКОИЗОЛЯЦИЯ', 'ШУМОПОГЛОЩЕНИЕ'];
        const tbodyIds = {
            'ВИБРОПОГЛОЩЕНИЕ': 'vibroAbsorptionBody',
            'ШУМОИЗОЛЯЦИЯ': 'soundInsulationBody',
            'ЗВУКОИЗОЛЯЦИЯ': 'soundProofingBody',
            'ШУМОПОГЛОЩЕНИЕ': 'soundAbsorptionBody'
        };
        
        markerNames.forEach(markerName => {
            const tbody = document.getElementById(tbodyIds[markerName]);
            if (!tbody) return;
            tbody.innerHTML = '';
            const markerType = materialTypes.find(mt => mt.name === markerName);
            if (!markerType) return;
            
            markerType.articles.forEach((art, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${art.code}</td><td>${art.name}</td>
                    <td><input type="number" class="marker-price-input" value="${parseFloat(art.price)||0}" step="0.01" data-marker="${markerName}" data-idx="${idx}"></td>`;
                tbody.appendChild(tr);
            });
        });
        
        document.querySelectorAll('.marker-price-input').forEach(input => {
            input.addEventListener('change', () => {
                const markerName = input.dataset.marker;
                const idx = parseInt(input.dataset.idx);
                const markerType = materialTypes.find(mt => mt.name === markerName);
                if (markerType && markerType.articles[idx]) {
                    markerType.articles[idx].price = parseFloat(input.value) || 0;
                    saveAll();
                    renderAll();
                }
            });
        });
    }

    function renderServicesTable() {
        const container = document.getElementById('servicesContainer');
        container.innerHTML = '';
        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr>
                <th>Название услуги</th>
                <th>Расходники</th>
                <th></th>
            </tr></thead>
        `;
        const tbody = document.createElement('tbody');
        rates.forEach((r, idx) => {
            const tr = document.createElement('tr');
            const visibleItems = (r.items || []).map(item => {
                const isMarker = !!getMarkerDefinition(item.name) || item.customMarker;
                const markerStyle = isMarker ? 'background:#e8f5e9;border:1px solid #81c784;font-weight:600;' : 'background:#f1f3f5;';
                return `<span style="display:inline-block;margin:2px;padding:2px 6px;border-radius:4px;${markerStyle}">${item.name}</span>`;
            }).join('');
            tr.innerHTML = `
                <td><input type="text" class="rate-name-input" data-index="${idx}" value="${r.service}" onchange="updateServiceName(this)"></td>
                <td>
                    <div style="margin-bottom:4px;">${visibleItems || '<span style="color:#6c757d;font-size:12px;">Нет расходников</span>'}</div>
                    <button class="btn-extra" onclick="openServiceItemsModal(${idx})">✏️ Редактировать</button>
                    <span style="font-size:12px; color:#6c757d;">(${(r.items || []).length} шт.)</span>
                </td>
                <td><button class="btn-del" onclick="deleteService(${idx})">✕</button></td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }

    function updateServiceName(input) {
        const idx = parseInt(input.dataset.index);
        rates[idx].service = input.value;
        saveAll();
        renderRefs();
        renderOrders();
    }


    function renderColorTable() {
        const tbody = document.getElementById('colorRefBody');
        tbody.innerHTML = '';
        colors.forEach((c, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><input type="text" value="${c.category}" onchange="updateColorCategory(this, ${idx})" style="width:100px;"></td><td>${c.code}</td><td>${c.name}</td>
                <td><input type="number" class="ref-price-input" value="${parseFloat(c.price)||0}" step="0.01" data-index="${idx}" onchange="onColorPriceChange(this)"></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderPaintTable() {
        const tbody = document.getElementById('paintRefBody');
        tbody.innerHTML = '';
        paints.forEach((p, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><input type="text" value="${p.category}" onchange="updatePaintCategory(this, ${idx})" style="width:100px;"></td><td>${p.code}</td><td>${p.name}</td>
                <td><input type="number" class="ref-price-input" value="${parseFloat(p.price)||0}" step="0.01" data-index="${idx}" onchange="onPaintPriceChange(this)"></td>
                <td><button class="btn-del" onclick="deletePaint(${idx})">✕</button></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderFilmTable() {
        const tbody = document.getElementById('filmRefBody');
        tbody.innerHTML = '';
        films.forEach((f, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><input type="text" value="${f.category}" onchange="updateFilmCategory(this, ${idx})" style="width:100px;"></td><td>${f.code}</td><td>${f.name}</td>
                <td><input type="number" class="ref-price-input" value="${parseFloat(f.price)||0}" step="0.01" data-index="${idx}" onchange="onFilmPriceChange(this)"></td>
                <td><button class="btn-del" onclick="deleteFilm(${idx})">✕</button></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderExtraRefTable() {
        const tbody = document.getElementById('extraRefBody');
        tbody.innerHTML = '';
        extraRef.forEach((r, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><input type="text" value="${r.name}" onchange="updateExtraRef(${idx}, 'name', this.value)"></td>
                <td><input type="text" value="${r.unit}" onchange="updateExtraRef(${idx}, 'unit', this.value)"></td>
                <td><input type="number" step="0.01" value="${parseFloat(r.price)||0}" onchange="updateExtraRef(${idx}, 'price', parseFloat(this.value))"></td>
                <td><button class="btn-del" onclick="deleteExtraRef(${idx})">✕</button></td>`;
            tbody.appendChild(tr);
        });
    }

    function onColorPriceChange(inp) { const idx = +inp.dataset.index; colors[idx].price = parseFloat(inp.value) || 0; saveAll(); renderAll(); }
    function updateColorCategory(inp, idx) { colors[idx].category = inp.value; saveAll(); renderAll(); }
    function onPaintPriceChange(inp) { const idx = +inp.dataset.index; paints[idx].price = parseFloat(inp.value) || 0; saveAll(); renderAll(); }
    function updatePaintCategory(inp, idx) { paints[idx].category = inp.value; saveAll(); renderAll(); }
    function onFilmPriceChange(inp) { const idx = +inp.dataset.index; films[idx].price = parseFloat(inp.value) || 0; saveAll(); renderAll(); }
    function updateFilmCategory(inp, idx) { films[idx].category = inp.value; saveAll(); renderAll(); }
    function updateExtraRef(idx, field, value) {
        if (field === 'price') extraRef[idx].price = parseFloat(value) || 0;
        else extraRef[idx][field] = value;
        saveAll();
        renderAll();
    }
    function deleteExtraRef(idx) { extraRef.splice(idx,1); saveAll(); renderAll(); }
    function deletePaint(idx) { paints.splice(idx,1); saveAll(); renderAll(); }
    function deleteFilm(idx) { films.splice(idx,1); saveAll(); renderAll(); }
       function openAddColorModal() {
         document.getElementById('newColorCategory').value = '';
         document.getElementById('newColorCode').value = '';
         document.getElementById('newColorName').value = '';
         document.getElementById('newColorPrice').value = '';
         document.getElementById('addColorModal').classList.add('active');
       }
       function closeAddColorModal() { document.getElementById('addColorModal').classList.remove('active'); }
       function saveNewColor() {
         const category = document.getElementById('newColorCategory').value.trim();
         const code = document.getElementById('newColorCode').value.trim();
         const name = document.getElementById('newColorName').value.trim();
         const price = parseFloat(document.getElementById('newColorPrice').value);
         if (!category || !code || !name || isNaN(price)) { alert('Заполните все поля корректно'); return; }
         colors.push({category, code, name, price});
         saveAll(); renderRefs(); closeAddColorModal();
     }

    function openAddPaintModal() {
        document.getElementById('newPaintCategory').value = '';
        document.getElementById('newPaintCode').value = '';
        document.getElementById('newPaintName').value = '';
        document.getElementById('newPaintPrice').value = '';
        document.getElementById('addPaintModal').classList.add('active');
    }
    function closeAddPaintModal() { document.getElementById('addPaintModal').classList.remove('active'); }
    function saveNewPaint() {
        const category = document.getElementById('newPaintCategory').value.trim();
        const code = document.getElementById('newPaintCode').value.trim();
        const name = document.getElementById('newPaintName').value.trim();
        const price = parseFloat(document.getElementById('newPaintPrice').value);
        if (!category || !code || !name || isNaN(price)) { alert('Заполните все поля корректно'); return; }
        paints.push({category, code, name, price});
        saveAll(); renderRefs(); closeAddPaintModal();
    }

    function openAddFilmModal() {
        document.getElementById('newFilmCategory').value = '';
        document.getElementById('newFilmCode').value = '';
        document.getElementById('newFilmName').value = '';
        document.getElementById('newFilmPrice').value = '';
        document.getElementById('addFilmModal').classList.add('active');
    }
    function closeAddFilmModal() { document.getElementById('addFilmModal').classList.remove('active'); }
    function saveNewFilm() {
        const category = document.getElementById('newFilmCategory').value.trim();
        const code = document.getElementById('newFilmCode').value.trim();
        const name = document.getElementById('newFilmName').value.trim();
        const price = parseFloat(document.getElementById('newFilmPrice').value);
        if (!category || !code || !name || isNaN(price)) { alert('Заполните все поля корректно'); return; }
        films.push({category, code, name, price});
        saveAll(); renderRefs(); closeAddFilmModal();
    }
    function openAddExtraRefModal() {
        document.getElementById('newExtraRefName').value = '';
        document.getElementById('newExtraRefUnit').value = '';
        document.getElementById('newExtraRefPrice').value = '';
        document.getElementById('addExtraRefModal').classList.add('active');
    }
    function closeAddExtraRefModal() { document.getElementById('addExtraRefModal').classList.remove('active'); }
    function saveNewExtraRef() {
        const name = document.getElementById('newExtraRefName').value.trim();
        const unit = document.getElementById('newExtraRefUnit').value.trim();
        const price = parseFloat(document.getElementById('newExtraRefPrice').value);
        if (!name || !unit || isNaN(price)) { alert('Заполните все поля корректно'); return; }
        extraRef.push({name, unit, price}); saveAll(); renderRefs(); closeAddExtraRefModal();
    }
    function addNewService() {
        const name = prompt('Название услуги:', ''); if(!name) return;
        rates.push({service:name, usesFabric:false, usesPaint:false, usesFilm:false, items:[]});
        saveAll(); renderRefs();
    }
    function deleteService(idx) { rates.splice(idx,1); saveAll(); renderRefs(); }
    function resetRates() { if(confirm('Сбросить услуги?')) { rates = []; saveAll(); renderRefs(); } }
    function fillServiceSelects() {
        const sel = document.getElementById('modalService');
        if (sel) {
            sel.innerHTML = '<option value="">-- Выберите --</option>';
            rates.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.service;
                opt.textContent = r.service;
                sel.appendChild(opt);
            });
        }
    }
    function updateServiceItemDatalist() {
        const dl = document.getElementById('serviceItemDatalist');
        if (!dl) return;
        dl.innerHTML = '';
        extraRef.forEach(r => { const opt = document.createElement('option'); opt.value = r.name; dl.appendChild(opt); });
        ['Ткань','Краска','Пленка для аквапринта'].forEach(name => { const opt = document.createElement('option'); opt.value = name; dl.appendChild(opt); });
        materialTypes.forEach(mt => { const opt = document.createElement('option'); opt.value = mt.name; dl.appendChild(opt); });
    }


    function getMarkerDefinition(name) {
        const normalizedName = String(name || '').trim().toLowerCase();
        if (normalizedName === 'ткань') return {name:'Ткань', unit:'м'};
        if (normalizedName === 'краска') return {name:'Краска', unit:'мл'};
        if (normalizedName === 'пленка для аквапринта') return {name:'Пленка для аквапринта', unit:'м'};
        const materialType = materialTypes.find(mt => String(mt.name || '').trim().toLowerCase() === normalizedName);
        return materialType ? {name:materialType.name, unit:materialType.unit} : null;
    }

    function configureDefaultServiceMarkers() {
        const markerSettings = {
            'Перетяжка потолка': ['Ткань'],
            'Восстановление после ДТП': ['Ткань'],
            'Покраска пластика': ['Краска'],
            'Аквапринт': ['Пленка для аквапринта']
        };
        Object.entries(markerSettings).forEach(([serviceName, markerNames]) => {
            const service = rates.find(rate => rate.service === serviceName);
            if (!service) return;
            const configuredNames = new Set(markerNames.map(name => name.toLowerCase()));
            const items = (service.items || []).filter(item => {
                const normalizedName = String(item.name || '').trim().toLowerCase();
                return !['ткань', 'краска', 'пленка для аквапринта'].includes(normalizedName) || configuredNames.has(normalizedName);
            });
            markerNames.forEach(markerName => {
                if (!items.some(item => String(item.name || '').trim().toLowerCase() === markerName.toLowerCase())) {
                    const marker = getMarkerDefinition(markerName);
                    items.push({name:marker.name, quantity:1, unit:marker.unit, price:0, perMeter:false, manual:false, enabled:true, customMarker:false});
                }
            });
            service.items = items;
            service.usesFabric = markerNames.includes('Ткань');
            service.usesPaint = markerNames.includes('Краска');
            service.usesFilm = markerNames.includes('Пленка для аквапринта');
        });
    }

    // ========== МОДАЛКА РАСХОДНИКОВ УСЛУГИ ==========
    function openServiceItemsModal(idx) {
        editingServiceIndex = idx;
        const svc = rates[idx];
        document.getElementById('serviceItemsModalTitle').textContent = `Расходники для "${svc.service}"`;
        const container = document.getElementById('serviceItemsContainer');
        container.innerHTML = '';
        const items = (svc.items || []).filter(item => {
            const isMarker = !!getMarkerDefinition(item.name);
            return !isMarker || item.enabled !== false;
        });
        items.forEach(item => addServiceItemRow(item));
        document.getElementById('serviceItemsModal').classList.add('active');
    }

    function addServiceItemRow(item) {
        const container = document.getElementById('serviceItemsContainer');
        const row = document.createElement('div');
        row.className = 'extra-item';
        row.style.gap = '6px';
        row.style.flexWrap = 'wrap';
        const name = item ? item.name || '' : '';
        const quantity = item ? (item.quantity !== undefined ? item.quantity : 1) : '';
        const unit = item ? item.unit || 'мл' : 'мл';
        const price = item ? (item.price !== undefined ? item.price : 0) : '';
        const perMeter = item ? !!item.perMeter : false;
        const manual = item ? !!item.manual : false;
        const enabled = item ? (item.enabled !== false) : true;
        const marker = getMarkerDefinition(name);
        const isMarker = !!marker;
        row.innerHTML = `
            <input type="text" class="item-name" placeholder="Название" value="${name}" style="flex:1; min-width:80px;" list="serviceItemDatalist" oninput="handleItemNameInput(this)">
            <input type="number" class="item-qty" placeholder="Кол-во" value="${quantity}" style="width:70px;">
            <select class="item-unit" style="width:80px;">
                <option value="м" ${unit === 'м' ? 'selected' : ''}>м</option>
                <option value="г" ${unit === 'г' ? 'selected' : ''}>г</option>
                <option value="мл" ${unit === 'мл' ? 'selected' : ''}>мл</option>
                <option value="шт" ${unit === 'шт' ? 'selected' : ''}>шт</option>
                <option value="уп." ${unit === 'уп.' ? 'selected' : ''}>уп.</option>
            </select>
            <input type="number" class="item-price" placeholder="Цена" value="${price}" style="width:80px;" step="0.01">
            <label><input type="checkbox" class="item-perMeter" ${perMeter ? 'checked' : ''}> на метр</label>
            <label><input type="checkbox" class="item-manual" ${manual ? 'checked' : ''}> Вручную</label>
            <label><input type="checkbox" class="item-enabled" ${enabled ? 'checked' : ''}> Вкл.</label>
            <button class="btn-del" onclick="this.parentElement.remove()">✕</button>
        `;
        if (isMarker) {
            row.dataset.isMarker = 'true';
            row.dataset.markerType = name;
            row.classList.add('marker-selected');
            const inputs = row.querySelectorAll('.item-name, .item-qty, .item-unit, .item-price');
            inputs.forEach(el => el.disabled = true);
            const enabledLabel = row.querySelector('.item-enabled').parentElement;
            enabledLabel.insertAdjacentHTML('beforebegin', '<span class="marker-status">✓ Маркер услуги</span>');
        }
        container.appendChild(row);
    }

    function handleItemNameInput(input) {
        const val = input.value.trim();
        const row = input.closest('.extra-item');
        if (!row) return;
        const isMarker = !!getMarkerDefinition(val);
        if (isMarker) {
            row.dataset.isMarker = 'true';
            row.dataset.markerType = val;
            row.classList.add('marker-selected');
            const inputs = row.querySelectorAll('.item-name, .item-qty, .item-unit, .item-price');
            inputs.forEach(el => el.disabled = true);
            if (!row.querySelector('.marker-status')) {
                const enabledLabel = row.querySelector('.item-enabled').parentElement;
                enabledLabel.insertAdjacentHTML('beforebegin', '<span class="marker-status">✓ Маркер услуги</span>');
            }
        } else {
            delete row.dataset.isMarker;
            delete row.dataset.markerType;
            row.classList.remove('marker-selected');
            const markerStatus = row.querySelector('.marker-status');
            if (markerStatus) markerStatus.remove();
            const inputs = row.querySelectorAll('.item-name, .item-qty, .item-unit, .item-price');
            inputs.forEach(el => el.disabled = false);
            row.style.background = '';
        }
    }

    function saveServiceItemsModal() {
        if (editingServiceIndex === null) return;
        const container = document.getElementById('serviceItemsContainer');
        const rows = container.querySelectorAll('.extra-item');
        const items = [];
        let usesFabric = false, usesPaint = false, usesFilm = false;
        rows.forEach(row => {
            const nameInput = row.querySelector('.item-name');
            const enteredName = nameInput ? nameInput.value.trim() : '';
            const marker = getMarkerDefinition(enteredName);
            const name = marker ? marker.name : enteredName;
            if (!name) return;
            const isMarker = row.dataset.isMarker === 'true' || !!marker;
            if (isMarker) {
                const perMeter = row.querySelector('.item-perMeter').checked;
                const manual = row.querySelector('.item-manual').checked;
                const enabled = row.querySelector('.item-enabled').checked;
                if (enabled && name === 'Ткань') usesFabric = true;
                else if (enabled && name === 'Краска') usesPaint = true;
                else if (enabled && name === 'Пленка для аквапринта') usesFilm = true;
                const customMarker = !['Ткань','Краска','Пленка для аквапринта'].includes(name);
                items.push({name, quantity:parseFloat(row.querySelector('.item-qty').value)||1, unit:marker ? marker.unit : row.querySelector('.item-unit').value, price:0, perMeter, manual, enabled, customMarker});
                return;
            }
            const qtyInput = row.querySelector('.item-qty');
            const unitInput = row.querySelector('.item-unit');
            const priceInput = row.querySelector('.item-price');
            const quantity = parseFloat(qtyInput?.value);
            const price = parseFloat(priceInput?.value);
            const unit = unitInput?.value || 'мл';
            const perMeter = row.querySelector('.item-perMeter')?.checked || false;
            const manual = row.querySelector('.item-manual')?.checked || false;
            const enabled = row.querySelector('.item-enabled')?.checked !== false;
            items.push({name, quantity:Number.isFinite(quantity) ? quantity : 1, unit, price:Number.isFinite(price) ? price : 0, perMeter, manual, enabled, customMarker: false});
        });
        const filteredItems = items.filter((item, index, allItems) => {
            return allItems.findIndex(other => other.name.toLowerCase() === item.name.toLowerCase()) === index;
        });
        rates[editingServiceIndex].usesFabric = usesFabric;
        rates[editingServiceIndex].usesPaint = usesPaint;
        rates[editingServiceIndex].usesFilm = usesFilm;
        rates[editingServiceIndex].items = filteredItems;
        localChangesPending = true;
        saveAll();
        closeServiceItemsModal();
        renderRefs();
    }

    function closeServiceItemsModal() { document.getElementById('serviceItemsModal').classList.remove('active'); editingServiceIndex = null; }

    // ========== МОДАЛКА ЗАКАЗА ==========
    function updateDeadline() {
        const dateInput = document.getElementById('orderDate');
        const durationInput = document.getElementById('orderDurationDays');
        const deadlineInput = document.getElementById('orderDeadline');
        if (dateInput.value) {
            const d = new Date(dateInput.value);
            if (!isNaN(d.getTime())) {
                const days = parseInt(durationInput.value) || 0;
                d.setDate(d.getDate() + days);
                deadlineInput.value = formatDate(d);
            } else {
                deadlineInput.value = '';
            }
        } else {
            deadlineInput.value = '';
        }
    }

    function openOrderModal(orderId, presetDate) {
        const order = orderId ? ordersData.find(o=>o.id===orderId) : null;
        orderEditId = order ? order.id : null;
        document.getElementById('orderModalTitle').textContent = order ? `Заказ №${order.orderNumber}` : 'Новый заказ';
        document.getElementById('orderDate').value = order?.date || presetDate || formatDate(new Date());
        document.getElementById('orderDurationDays').value = order?.durationDays || 1;
        updateDeadline();
        document.getElementById('orderClient').value = order?.client || '';
        document.getElementById('orderPhone').value = order?.phone || '';
        // Исправление: защита от null и нечисловых строк
        document.getElementById('orderClientPrice').value = parseFloat(order?.clientPrice) || 0;
        document.getElementById('orderHelperPay').value = parseFloat(order?.helperPay) || 0;
        document.getElementById('orderDone').checked = order?.done || false;
        document.getElementById('orderPaid').checked = order?.paid || false;
        currentManualColor = order?.manualColor || 'auto';
        document.querySelectorAll('.color-select .color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.classList.contains(currentManualColor));
        });
        currentExtraData = order?.extraData ? JSON.parse(order.extraData) : {};
        const servicesList = document.getElementById('servicesList');
        servicesList.innerHTML = '';
        currentServices = [];
        if (order) {
            order.services.forEach(inst => addServiceRow(inst));
        } else {
            addServiceRow();
        }
        document.getElementById('orderModal').classList.add('active');
        updateModalTotals();
    }

    function openOrderModalFromCalendar() {
        openOrderModal(null, selectedDate ? formatDate(selectedDate) : undefined);
    }

    function closeOrderModal() {
        document.getElementById('orderModal').classList.remove('active');
        orderEditId = null;
        currentServices = [];
    }

    function addServiceRow(inst) {
        const container = document.getElementById('servicesList');
        const index = currentServices.length;
        const instance = inst || { serviceName:'', usesFabric:false, usesPaint:false, usesFilm:false, fabric:{}, paint:{}, film:{}, manualItems:{} };
        // Инициализация custom материалов
        materialTypes.forEach(mt => {
            if (!instance[mt.name]) instance[mt.name] = {};
        });

        currentServices.push(instance);
        if (instance.serviceName) {
            const selectedService = rates.find(r => r.service === instance.serviceName);
            instance.usesPaint = serviceUsesPaint(selectedService);
        }
        const row = document.createElement('div');
        row.className = 'service-row';
        row.dataset.index = index;
        const select = document.createElement('select');
        select.innerHTML = '<option value="">-- Выберите услугу --</option>';
        rates.forEach(r => { const opt = document.createElement('option'); opt.value=r.service; opt.textContent=r.service; select.appendChild(opt); });
        select.value = instance.serviceName;
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-del';
        delBtn.textContent = '✕';
        delBtn.onclick = () => { currentServices.splice(index,1); row.remove(); updateModalTotals(); };
        const header = document.createElement('div');
        header.className = 'service-header';
        header.appendChild(select);
        header.appendChild(delBtn);
        row.appendChild(header);
        const details = document.createElement('div');
        details.className = 'service-details';
        row.appendChild(details);
        container.appendChild(row);
        select.onchange = () => {
            instance.serviceName = select.value;
            const svc = rates.find(r => r.service === select.value);
            if (svc) { instance.usesFabric = svc.usesFabric; instance.usesPaint = serviceUsesPaint(svc); instance.usesFilm = svc.usesFilm; }
            buildServiceDetails(details, index);
            updateModalTotals();
        };
        if (instance.serviceName) buildServiceDetails(details, index);
        updateModalTotals();
    }

    function createDatalist(id, options) {
        const existing = document.getElementById(id);
        if (existing) existing.remove();
        const dl = document.createElement('datalist');
        dl.id = id;
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            dl.appendChild(option);
        });
        document.body.appendChild(dl);
        return dl;
    }

    function findReferenceMatch(value, references) {
        const query = String(value || '').trim().toLowerCase();
        if (!query) return null;
        return references.find(reference => String(reference.code || '').toLowerCase() === query || String(reference.name || '').toLowerCase() === query)
            || references.find(reference => String(reference.code || '').toLowerCase().startsWith(query) || String(reference.name || '').toLowerCase().startsWith(query))
            || references.find(reference => String(reference.name || '').toLowerCase().includes(query))
            || null;
    }

    function buildServiceDetails(container, index) {
        const inst = currentServices[index];
        const svc = rates.find(r => r.service === inst.serviceName);
        if (!svc) return;
        container.innerHTML = '';
        if (serviceUsesMarker(svc, 'Ткань')) {
            const div = document.createElement('div');
            div.innerHTML = `<div class="section-title">🧵 Ткань</div>
                <label>Категория</label><input type="text" class="fabric-category" value="${inst.fabric.category||''}">
                <label>Артикул</label><input type="text" class="fabric-code" value="${inst.fabric.code||''}" list="fabricCodes">
                <label>Цена</label><input type="number" class="fabric-price" value="${parseFloat(inst.fabric.price)||0}">
                <label>Метры</label><input type="number" class="fabric-meters" value="${parseFloat(inst.fabric.meters)||0}">
                <label>Стоимость</label><input type="text" class="fabric-cost" readonly>`;
            container.appendChild(div);
            const catInput = div.querySelector('.fabric-category');
            const codeInput = div.querySelector('.fabric-code');
            const priceInput = div.querySelector('.fabric-price');
            const metersInput = div.querySelector('.fabric-meters');
            const costInput = div.querySelector('.fabric-cost');
            createDatalist('fabricCodes', colors.map(c => c.code));
            const update = () => {
                inst.fabric.category = catInput.value;
                inst.fabric.code = codeInput.value;
                inst.fabric.price = parseFloat(priceInput.value) || 0;
                inst.fabric.meters = parseFloat(metersInput.value) || 0;
                const found = findReferenceMatch(codeInput.value, colors);
                if (found) {
                    codeInput.value = found.code;
                    catInput.value = found.category;
                    priceInput.value = parseFloat(found.price) || 0;
                    inst.fabric.price = parseFloat(found.price) || 0;
                }
                costInput.value = ((parseFloat(inst.fabric.meters)||0) * (parseFloat(inst.fabric.price)||0)).toFixed(2);
                updateModalTotals();
            };
            [catInput, codeInput, priceInput, metersInput].forEach(el => el.addEventListener('input', update));
            update();
        }
        if (serviceUsesPaint(svc)) {
            const div = document.createElement('div');
            div.innerHTML = `<div class="section-title">🎨 Краска</div>
                <label>Артикул</label><input type="text" class="paint-code" value="${inst.paint.code||''}" list="paintCodes">
                <label>Цена</label><input type="number" class="paint-price" value="${parseFloat(inst.paint.price)||0}" readonly>
                <label>Мл</label><input type="number" class="paint-qty" value="${parseFloat(inst.paint.qty)||0}">
                <label>Стоимость</label><input type="text" class="paint-cost" readonly>`;
            container.appendChild(div);
            const codeInput = div.querySelector('.paint-code');
            const priceInput = div.querySelector('.paint-price');
            const qtyInput = div.querySelector('.paint-qty');
            const costInput = div.querySelector('.paint-cost');
            createDatalist('paintCodes', paints.map(p => p.code));
            const update = () => {
                inst.paint.code = codeInput.value;
                const found = findReferenceMatch(codeInput.value, paints);
                if (found) { 
                    codeInput.value = found.code;
                    inst.paint.price = parseFloat(found.price)||0; 
                    priceInput.value = parseFloat(found.price)||0; 
                } else {
                    inst.paint.price = parseFloat(priceInput.value)||0;
                }
                inst.paint.qty = parseFloat(qtyInput.value) || 0;
                costInput.value = ((parseFloat(inst.paint.qty)||0) * (parseFloat(inst.paint.price)||0)).toFixed(2);
                updateModalTotals();
            };
            codeInput.addEventListener('input', update);
            qtyInput.addEventListener('input', update);
            update();
        }
        if (serviceUsesMarker(svc, 'Пленка для аквапринта')) {
            const div = document.createElement('div');
            div.innerHTML = `<div class="section-title">🖼️ Плёнка</div>
                <label>Артикул</label><input type="text" class="film-code" value="${inst.film.code||''}" list="filmCodes">
                <label>Цена</label><input type="number" class="film-price" value="${parseFloat(inst.film.price)||0}" readonly>
                <label>Метры</label><input type="number" class="film-meters" value="${parseFloat(inst.film.meters)||0}">
                <label>Стоимость</label><input type="text" class="film-cost" readonly>`;
            container.appendChild(div);
            const codeInput = div.querySelector('.film-code');
            const priceInput = div.querySelector('.film-price');
            const metersInput = div.querySelector('.film-meters');
            const costInput = div.querySelector('.film-cost');
            createDatalist('filmCodes', films.map(f => f.code));
            const update = () => {
                inst.film.code = codeInput.value;
                const found = findReferenceMatch(codeInput.value, films);
                if (found) { 
                    codeInput.value = found.code;
                    inst.film.price = parseFloat(found.price)||0; 
                    priceInput.value = parseFloat(found.price)||0; 
                } else {
                    inst.film.price = parseFloat(priceInput.value)||0;
                }
                inst.film.meters = parseFloat(metersInput.value) || 0;
                costInput.value = ((parseFloat(inst.film.meters)||0) * (parseFloat(inst.film.price)||0)).toFixed(2);
                updateModalTotals();
            };
            codeInput.addEventListener('input', update);
            metersInput.addEventListener('input', update);
            update();
        }
        // Рендер кастомных маркеров (ВИБРОПОГЛОЩЕНИЕ, ШУМОИЗОЛЯЦИЯ и т.д.)
        const markerIcons = {
            'ВИБРОПОГЛОЩЕНИЕ': '🔩',
            'ШУМОИЗОЛЯЦИЯ': '🔊',
            'ЗВУКОИЗОЛЯЦИЯ': '🔈',
            'ШУМОПОГЛОЩЕНИЕ': '🔇'
        };
        materialTypes.forEach(mt => {
            const markerItem = svc.items.find(item => item.enabled !== false && item.name === mt.name);
            if (markerItem) {
                const div = document.createElement('div');
                const markerData = inst[mt.name] || {};
                const icon = markerIcons[mt.name] || '📦';
                div.innerHTML = `<div class="section-title">${icon} ${mt.name}</div>
                    <label>Артикул или поиск по названию</label><input type="text" class="custom-code" data-mt="${mt.name}" value="${markerData.code||''}" list="${mt.name}Codes" placeholder="Введите код или название для поиска">
                    <label>Цена за лист</label><input type="number" class="custom-price" value="${markerData.price||0}" readonly>
                    <label>Количество листов</label><input type="number" class="custom-qty" value="${markerData.sheets||''}" step="1" placeholder="0">
                    <label>Стоимость</label><input type="text" class="custom-cost" value="0.00" readonly>`;
                container.appendChild(div);
                const codeInput = div.querySelector('.custom-code');
                const priceInput = div.querySelector('.custom-price');
                const qtyInput = div.querySelector('.custom-qty');
                const costInput = div.querySelector('.custom-cost');
                createDatalist(`${mt.name}Codes`, mt.articles.map(a => a.code + ' - ' + a.name));
                const update = () => {
                    const query = codeInput.value.trim().toLowerCase();
                    let art = null;
                    if (query) {
                        art = mt.articles.find(a => a.code.toLowerCase() === query || a.name.toLowerCase().includes(query));
                        if (!art) {
                            art = mt.articles.find(a => a.code.toLowerCase().startsWith(query) || a.name.toLowerCase().startsWith(query));
                        }
                    }
                    if (art) { 
                        codeInput.value = art.code;
                        priceInput.value = parseFloat(art.price)||0; 
                    }
                    inst[mt.name] = {
                        code: codeInput.value, 
                        price: art ? (parseFloat(art.price)||0) : (parseFloat(priceInput.value)||0), 
                        sheets: parseInt(qtyInput.value) || 0
                    };
                    costInput.value = ((parseFloat(inst[mt.name].price)||0) * (parseFloat(inst[mt.name].sheets)||0)).toFixed(2);
                    updateModalTotals();
                };
                codeInput.addEventListener('input', update);
                qtyInput.addEventListener('input', update);
                update();
            }
        });
        svc.items.forEach(item => {
            if (item.enabled === false) return;
            if (item.customMarker) return;
            if (item.name === 'Краска' && serviceUsesPaint(svc)) return;
            if (item.name === 'Пленка для аквапринта' && svc.usesFilm) return;
            if (item.name === 'Ткань' && svc.usesFabric) return;
            if (materialTypes.some(mt => mt.name === item.name)) return;
            const div = document.createElement('div');
            const automaticQty = item.perMeter ? (parseFloat(item.quantity)||0) * getServiceMeters(inst) : (parseFloat(item.quantity)||0);
            div.innerHTML = item.manual
                ? `<label>${item.name} (${item.unit})</label><input type="number" class="ordinary-qty" value="${parseFloat((inst.manualItems || {})[item.name])||''}">`
                : `<label>${item.name} (${item.unit})</label><input type="number" class="ordinary-qty automatic-qty" data-service-index="${index}" data-base-quantity="${parseFloat(item.quantity)||0}" data-per-meter="${item.perMeter}" value="${automaticQty}" readonly>`;
            container.appendChild(div);
            const input = div.querySelector('.ordinary-qty');
            input.addEventListener('input', () => {
                const val = parseFloat(input.value)||0;
                inst.manualItems[item.name] = val;
                updateModalTotals();
            });
        });
    }

    function updateModalTotals() {
        let totalCost = 0;
        document.querySelectorAll('.automatic-qty').forEach(input => {
            const inst = currentServices[parseInt(input.dataset.serviceIndex)];
            if (!inst) return;
            const baseQuantity = parseFloat(input.dataset.baseQuantity) || 0;
            input.value = input.dataset.perMeter === 'true' ? baseQuantity * getServiceMeters(inst) : baseQuantity;
        });
        currentServices.forEach(inst => {
            const svc = rates.find(r => r.service === inst.serviceName);
            if (!svc) return;
            if (serviceUsesMarker(svc, 'Ткань') && inst.fabric) totalCost += (parseFloat(inst.fabric.meters)||0) * (parseFloat(inst.fabric.price)||0);
            if (serviceUsesPaint(svc) && inst.paint) totalCost += (parseFloat(inst.paint.qty)||0) * (parseFloat(inst.paint.price)||0);
            if (serviceUsesMarker(svc, 'Пленка для аквапринта') && inst.film) totalCost += (parseFloat(inst.film.meters)||0) * (parseFloat(inst.film.price)||0);
            svc.items.forEach(item => {
                if (item.enabled === false) return;
                if (item.customMarker) return;
                if (item.name === 'Краска' && serviceUsesPaint(svc)) return;
                if (item.name === 'Пленка для аквапринта' && svc.usesFilm) return;
                if (item.name === 'Ткань' && svc.usesFabric) return;
                let qty = 0;
                if ((inst.manualItems || {})[item.name] !== undefined) qty = parseFloat((inst.manualItems || {})[item.name])||0;
                else if (!item.manual) qty = item.perMeter ? (parseFloat(item.quantity)||0) * getServiceMeters(inst) : (parseFloat(item.quantity)||0);
                totalCost += qty * (parseFloat(item.price)||0);
            });
            materialTypes.forEach(mt => {
                const markerItem = svc.items.find(item => item.enabled !== false && item.name === mt.name);
                if (markerItem) {
                    const markerData = inst[mt.name];
                    if (markerData && markerData.code) {
                        const qty = parseFloat(markerData.sheets || markerData.qty || 0);
                        totalCost += qty * (parseFloat(markerData.price)||0);
                    }
                }
            });
        });
        for (let key in currentExtraData) {
            const ref = extraRef.find(e => e.name === key);
            if (ref) totalCost += (parseFloat(currentExtraData[key])||0) * (parseFloat(ref.price)||0);
        }
        document.getElementById('orderMaterialCost').value = totalCost.toFixed(2);
        const client = parseFloat(document.getElementById('orderClientPrice').value)||0;
        const helper = parseFloat(document.getElementById('orderHelperPay').value)||0;
        document.getElementById('orderGrossProfit').value = (client - totalCost - helper).toFixed(2);
    }

    function saveOrderModal() {
        const date = document.getElementById('orderDate').value;
        const client = document.getElementById('orderClient').value.trim();
        const phone = document.getElementById('orderPhone').value.trim();
        const clientPrice = parseFloat(document.getElementById('orderClientPrice').value)||0;
        const helperPay = parseFloat(document.getElementById('orderHelperPay').value)||0;
        const durationDays = parseInt(document.getElementById('orderDurationDays').value)||1;
        const done = document.getElementById('orderDone').checked;
        const paid = document.getElementById('orderPaid').checked;
        if (!date || !client) { alert('Заполните дату и имя'); return; }
        currentServices = currentServices.filter(inst => inst.serviceName);
        if (currentServices.length === 0) { alert('Добавьте услугу'); return; }
        const servicesCopy = currentServices.map(inst => ({
            serviceName: inst.serviceName,
            usesFabric: inst.usesFabric,
            usesPaint: inst.usesPaint,
            usesFilm: inst.usesFilm,
            fabric: {...inst.fabric},
            paint: {...inst.paint},
            film: {...inst.film},
            manualItems: {...inst.manualItems},
            ...Object.fromEntries(materialTypes.map(mt => [mt.name, inst[mt.name] ? {...inst[mt.name]} : undefined]))
        }));
        const extraData = JSON.stringify(currentExtraData);
        const orderData = {
            id: orderEditId || Date.now(),
            orderNumber: orderEditId ? ordersData.find(o=>o.id===orderEditId)?.orderNumber : (parseInt(localStorage.getItem('lastOrderNumber')||'0')+1),
            date, client, phone, services: servicesCopy, clientPrice, helperPay, durationDays,
            extraData, done, paid, manualColor: currentManualColor
        };
        if (!orderEditId) localStorage.setItem('lastOrderNumber', orderData.orderNumber);
        if (orderEditId) {
            const idx = ordersData.findIndex(o=>o.id===orderEditId);
            if (idx !== -1) ordersData[idx] = orderData;
        } else {
            ordersData.push(orderData);
        }
        recalcOrder(orderData);
        recalculateStockFromAllOrders();
        if (paid) distributePayment(orderData);
        saveAll();
        renderAll();
        closeOrderModal();
    }

function removePaymentDistribution(orderNumber) {
    cashOps = cashOps.filter(op => !new RegExp(`№${orderNumber}(\\s|$)`).test(op.desc));
}

function distributePayment(order) {
    const amount = parseFloat(order.clientPrice)||0;
    if (amount <= 0) return;
    
    // Предотвращаем дублирование транзакций
    const exists = cashOps.some(op => op.desc.includes(`№${order.orderNumber}`));
    if (exists) return; 

    cashOps.push({date: formatDate(new Date()), desc:`Оплата заказа №${order.orderNumber}`, income: amount, expense:0});
    const tax = amount * 0.04;
    const helper = parseFloat(order.helperPay)||0;
    const materials = parseFloat(order.materialCost)||0;
    const rest = amount - tax - helper - materials;
    const products = rest * 0.2;
    const savings = rest * 0.1;
    const personal = rest - products - savings;

    if (tax > 0) cashOps.push({date: formatDate(new Date()), desc:`Налог 4% (заказ №${order.orderNumber})`, income:0, expense:tax});
    if (helper > 0) cashOps.push({date: formatDate(new Date()), desc:`Помощнику (заказ №${order.orderNumber})`, income:0, expense:helper});
    if (materials > 0) cashOps.push({date: formatDate(new Date()), desc:`Материалы (заказ №${order.orderNumber})`, income:0, expense:materials});
    if (products > 0) cashOps.push({date: formatDate(new Date()), desc:`Продукты 20% (заказ №${order.orderNumber})`, income:0, expense:products});
    if (savings > 0) cashOps.push({date: formatDate(new Date()), desc:`Накопления 10% (заказ №${order.orderNumber})`, income:0, expense:savings});
    if (personal > 0) cashOps.push({date: formatDate(new Date()), desc:`Личные расходы (заказ №${order.orderNumber})`, income:0, expense:personal});
}

function togglePaid(id, checked) {
    const order = ordersData.find(o => o.id === id);
    if (order) {
        order.paid = checked;
        if (checked) distributePayment(order);
        else removePaymentDistribution(order.orderNumber); // Удаляем транзакции при снятии отметки
        saveAll();
        renderAll();
    }
}

function deleteOrder(orderId) {
    const order = ordersData.find(o => o.id === orderId);
    if (order) removePaymentDistribution(order.orderNumber); // Очищаем финансы при удалении
    ordersData = ordersData.filter(o => o.id !== orderId);
    recalculateStockFromAllOrders();
    saveAll();
    renderAll();
}

    // ========== ДОП. РАСХОДНИКИ ==========
    function openExtraModalFromOrder() {
        const container = document.getElementById('extraMaterialsContainer');
        container.innerHTML = '';
        extraRef.forEach(ref => {
            const div = document.createElement('div');
            div.className = 'extra-item';
            div.innerHTML = `<span>${ref.name}</span><input type="number" class="extra-qty" value="${parseFloat(currentExtraData[ref.name])||''}" placeholder="Кол-во" data-name="${ref.name}"> <span>${parseFloat(ref.price)||0}₽/${ref.unit}</span>`;
            container.appendChild(div);
        });
        document.getElementById('extraModal').classList.add('active');
    }
    function saveExtraModal() {
        document.querySelectorAll('.extra-qty').forEach(input => {
            const val = parseFloat(input.value);
            if (val > 0) currentExtraData[input.dataset.name] = val;
            else delete currentExtraData[input.dataset.name];
        });
        document.getElementById('extraModal').classList.remove('active');
        updateModalTotals();
    }
    function addNewExtra() {
        const name = document.getElementById('newExtraName').value.trim();
        const price = parseFloat(document.getElementById('newExtraPrice').value);
        const unit = document.getElementById('newExtraUnit').value;
        if (!name || isNaN(price)) return;
        extraRef.push({name, unit, price});
        saveAll();
        openExtraModalFromOrder();
    }
    function closeExtraModal() { document.getElementById('extraModal').classList.remove('active'); }

    // ========== ЗАКУПКА ==========
    function renderPurchaseOrdersList() {
        const container = document.getElementById('purchaseOrdersList');
        container.innerHTML = '';
        ordersData.forEach(order => {
            const div = document.createElement('div');
            div.className = 'order-item purchase-item';
            div.innerHTML = `
                <input type="checkbox" class="purchase-check" value="${order.id}" style="width:auto;">
                <span>№${order.orderNumber} ${order.client} (${order.date}) – ${order.services.map(s=>s.serviceName).join(', ')}</span>
            `;
            container.appendChild(div);
        });
    }

    function generatePurchaseDocument() {
        const selectedIds = [...document.querySelectorAll('.purchase-check:checked')].map(cb => cb.value);
        if (!selectedIds.length) { alert('Выберите заказы'); return; }
        const selectedOrders = ordersData.filter(o => selectedIds.includes(String(o.id)));
        const docContainer = document.getElementById('purchaseDocumentContainer');
        docContainer.innerHTML = '';
        const markers = { 'Ткань': [], 'Краска': [], 'Пленка': [] };
        materialTypes.forEach(mt => markers[mt.name] = []);
        const otherMaterials = {};
        selectedOrders.forEach(order => {
            order.services.forEach(inst => {
                const svc = rates.find(r => r.service === inst.serviceName);
                if (!svc) return;
                if (svc.usesFabric && inst.fabric && inst.fabric.code) {
                    markers['Ткань'].push({article: inst.fabric.code, name: inst.fabric.colorName || inst.fabric.code, qty: parseFloat(inst.fabric.meters)||0, unit:'м'});
                }
                if (serviceUsesPaint(svc) && inst.paint && inst.paint.code) {
                    markers['Краска'].push({article: inst.paint.code, name: inst.paint.colorName || inst.paint.code, qty: parseFloat(inst.paint.qty)||0, unit:'мл'});
                }
                if (svc.usesFilm && inst.film && inst.film.code) {
                    markers['Пленка'].push({article: inst.film.code, name: inst.film.name || inst.film.code, qty: parseFloat(inst.film.meters)||0, unit:'м'});
                }
                materialTypes.forEach(mt => {
                    const markerData = inst[mt.name];
                    if (markerData && markerData.code) {
                        markers[mt.name].push({article: markerData.code, name: mt.articles.find(a=>a.code===markerData.code)?.name || markerData.code, qty: parseFloat(markerData.qty)||0, unit: mt.unit});
                    }
                });
                svc.items.forEach(item => {
                    if (item.customMarker) return;
                    if (item.name === 'Краска' && serviceUsesPaint(svc)) return;
                    if (item.name === 'Пленка для аквапринта' && svc.usesFilm) return;
                    if (item.name === 'Ткань' && svc.usesFabric) return;
                    if (materialTypes.some(mt=>mt.name===item.name)) return;
                    let qty = (inst.manualItems || {})[item.name] ? parseFloat((inst.manualItems || {})[item.name]) : (item.manual ? 0 : (item.perMeter ? (parseFloat(item.quantity)||0)*(parseFloat(inst.fabric?.meters)||0) : (parseFloat(item.quantity)||0)));
                    if (qty > 0) otherMaterials[item.name] = (parseFloat(otherMaterials[item.name])||0) + qty;
                });
            });
            let extra = {};
            try { extra = JSON.parse(order.extraData || '{}'); } catch(e) {}
            for (let key in extra) {
                otherMaterials[key] = (parseFloat(otherMaterials[key])||0) + (parseFloat(extra[key])||0);
            }
        });
        for (let markerName in markers) {
            if (markers[markerName].length) {
                const section = document.createElement('h3');
                section.textContent = markerName;
                docContainer.appendChild(section);
                const table = document.createElement('table');
                table.innerHTML = '<tr><th>Артикул</th><th>Наименование</th><th>Требуется</th><th>Ед.</th><th>Остаток</th><th>К закупке</th></tr>';
                const grouped = {};
                markers[markerName].forEach(m => {
                    if (!grouped[m.article]) grouped[m.article] = {name:m.name, qty:0, unit:m.unit};
                    grouped[m.article].qty += m.qty;
                });
                const stock = loadStock();
                for (let art in grouped) {
                    const g = grouped[art];
                    const stockItem = stock.find(s => s.name === g.name) || {remain:0};
                    const remain = parseFloat(stockItem.remain) || 0;
                    const toBuy = Math.max(0, g.qty - remain);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${art}</td><td>${g.name}</td><td>${g.qty.toFixed(2)}</td><td>${g.unit}</td><td>${remain.toFixed(2)}</td><td>${toBuy.toFixed(2)}</td>`;
                    table.appendChild(tr);
                }
                docContainer.appendChild(table);
            }
        }
        if (Object.keys(otherMaterials).length) {
            const section = document.createElement('h3');
            section.textContent = 'Прочие расходники';
            docContainer.appendChild(section);
            const table = document.createElement('table');
            table.innerHTML = '<tr><th>Материал</th><th>Требуется</th><th>Ед.</th><th>Остаток</th><th>К закупке</th></tr>';
            const stock = loadStock();
            for (let name in otherMaterials) {
                const ref = extraRef.find(e=>e.name===name) || {unit:'шт'};
                const stockItem = stock.find(s => s.name === name) || {remain:0};
                const remain = parseFloat(stockItem.remain) || 0;
                const toBuy = Math.max(0, parseFloat(otherMaterials[name]) - remain);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${name}</td><td>${parseFloat(otherMaterials[name]).toFixed(2)}</td><td>${ref.unit}</td><td>${remain.toFixed(2)}</td><td>${toBuy.toFixed(2)}</td>`;
                table.appendChild(tr);
            }
            docContainer.appendChild(table);
        }
    }

    function printPurchaseDocument() {
        const content = document.getElementById('purchaseDocumentContainer').innerHTML;
        if (!content) { alert('Сначала сформируйте документ'); return; }
        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Документ закупки</title><style>body{font-family: Arial; font-size: 14px;} table{width:100%; border-collapse:collapse;} th,td{border:1px solid #ddd; padding:8px; text-align:left;}</style></head><body>');
        printWindow.document.write(content);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }

    // ========== ЭКСПОРТ/ИМПОРТ ==========
    function exportData() {
        const data = {colors, paints, films, extraRef, rates, ordersData, cashOps, bookings, materialTypes, regularExpenses, regularIncomes, notes, lastOrderNumber: localStorage.getItem('lastOrderNumber'), stock: loadStock()};
        const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_${formatDate(new Date())}.json`;
        a.click();
    }
    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            let data;
            try {
                data = JSON.parse(e.target.result);
            } catch(err) {
                alert('Ошибка: файл не является валидным JSON.');
                return;
            }
            if (data.colors) colors = data.colors;
            if (data.paints) paints = data.paints;
            if (data.films) films = data.films;
            if (data.extraRef) extraRef = data.extraRef;
            if (data.rates) rates = data.rates;
            if (data.ordersData) ordersData = data.ordersData;
            if (data.cashOps) cashOps = data.cashOps;
            if (data.bookings) bookings = data.bookings;
            if (data.materialTypes) materialTypes = data.materialTypes;
            if (data.regularExpenses) regularExpenses = data.regularExpenses;
            if (data.regularIncomes) regularIncomes = data.regularIncomes;
            if (data.notes) notes = data.notes;
            if (data.stock) saveStock(data.stock);
            if (data.lastOrderNumber) localStorage.setItem('lastOrderNumber', data.lastOrderNumber);
            // Нормализация после импорта
            colors.forEach(c => c.price = parseFloat(c.price) || 0);
            paints.forEach(p => p.price = parseFloat(p.price) || 0);
            films.forEach(f => f.price = parseFloat(f.price) || 0);
            extraRef.forEach(r => r.price = parseFloat(r.price) || 0);
            materialTypes.forEach(mt => mt.articles.forEach(a => a.price = parseFloat(a.price) || 0));
            ordersData.forEach(o => {
                o.clientPrice = parseFloat(o.clientPrice) || 0;
                o.helperPay = parseFloat(o.helperPay) || 0;
            });
            saveAll();
            recalculateStockFromAllOrders();
            renderAll();
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // ========== ПРОЧЕЕ ==========
    function clearAllOrders() {
        if (confirm('Удалить все заказы?')) {
            ordersData = [];
            localStorage.setItem('lastOrderNumber','0');
            recalculateStockFromAllOrders();
            saveAll();
            renderAll();
        }
    }
    function deleteOrderFromModal() { if (orderEditId) { deleteOrder(orderEditId); closeOrderModal(); } }
    function setOrderColor(color) {
        currentManualColor = color;
        document.querySelectorAll('.color-select .color-btn').forEach(b => b.classList.toggle('active', b.classList.contains(color)));
    }
    function handlePaidChange() {
        const checkbox = document.getElementById('orderPaid');
        const order = orderEditId ? ordersData.find(o => o.id === orderEditId) : null;
        if (!order) return;
        order.paid = checkbox.checked;
        if (checkbox.checked) {
            distributePayment(order);
        } else {
            removePaymentDistribution(order.orderNumber);
        }
        saveAll();
        updateModalTotals();
        updateUnpaidSummary();
    }
       function saveBooking() {
        const date = document.getElementById('modalDate').value;
        const name = document.getElementById('modalName').value.trim();
        const phone = document.getElementById('modalPhone').value.trim();
        const service = document.getElementById('modalService').value;
        const duration = parseInt(document.getElementById('modalDurationDays').value)||1;
        if (!date || !name || !service) { alert('Заполните все поля'); return; }
        const orderNumber = parseInt(localStorage.getItem('lastOrderNumber')||'0')+1;
        localStorage.setItem('lastOrderNumber', orderNumber);
        const svc = rates.find(r => r.service === service);
        const orderData = {
            id: Date.now(),
            orderNumber,
            date, client:name, phone,
            services: [{serviceName:service, usesFabric:svc?.usesFabric, usesPaint:serviceUsesPaint(svc), usesFilm:svc?.usesFilm, fabric:{}, paint:{}, film:{}, manualItems:{}}],
            clientPrice:0, helperPay:0, durationDays:duration, extraData:'{}', done:false, paid:false, manualColor:'auto'
        };
        ordersData.push(orderData);
        recalculateStockFromAllOrders();
        saveAll(); // Вызов единой внешней функции сохранения
        closeModal();
        renderAll();
   
   }
    function closeModal() { document.getElementById('bookingModal').classList.remove('active'); }

    // ========== КАЛЕНДАРЬ ==========
    function getRegularPaymentsForDate(dateStr) {
        const day = parseInt(dateStr.slice(8, 10), 10);
        return regularExpenses
            .filter(exp => parseInt(exp.day, 10) === day)
            .filter(exp => !cashOps.some(op => op.date === dateStr && op.desc === exp.desc))
            .map(exp => ({ date: dateStr, desc: exp.desc, expense: exp.amount, regular: true }));
    }

    function getRegularIncomesForDate(dateStr) {
        const day = parseInt(dateStr.slice(8, 10), 10);
        return regularIncomes
            .filter(income => parseInt(income.day, 10) === day)
            .filter(income => !cashOps.some(op => op.date === dateStr && op.desc === income.desc))
            .map(income => ({ date: dateStr, desc: income.desc, income: income.amount, regular: true }));
    }

    function renderCalendar() {
        // Обновляем фильтр услуг
        document.getElementById('serviceFilterContainer').innerHTML = getServiceFilterButtons();
        
        // Обновляем сводку
        renderCalendarSummary();
        
        // Проверяем уведомления
        checkTomorrowNotifications();
        
        const grid = document.getElementById('calendarGrid');
        
        if (calendarViewMode === 'week') {
            renderWeekView();
            return;
        }
        
        const year = currentDate.getFullYear(), month = currentDate.getMonth();
        const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        document.getElementById('calendarTitle').textContent = `${months[month]} ${year}`;
        
        grid.innerHTML = '';
        const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
        dayNames.forEach(n => { const d = document.createElement('div'); d.className='day-name'; d.textContent=n; grid.appendChild(d); });
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month+1, 0).getDate();
        const offset = firstDay.getDay()===0 ? 6 : firstDay.getDay()-1;
        for (let i=0; i<offset; i++) { const d=document.createElement('div'); d.className='day-cell other-month'; grid.appendChild(d); }
        
        for (let d=1; d<=daysInMonth; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = formatDate(dateObj);
            const isSelected = selectedDate && dateObj.toDateString() === selectedDate.toDateString();
            let dayOrders = ordersData.filter(o => o.date === dateStr);
            
            // Применяем фильтр по услуге
            if (currentServiceFilter !== 'all') {
                dayOrders = dayOrders.filter(o => o.services.some(s => s.serviceName === currentServiceFilter));
            }
            
            const criticalOrder = dayOrders.some(o => getOrderColorObj(o)==='critical');
            const regularPayments = getRegularPaymentsForDate(dateStr);
            const regularIncomes = getRegularIncomesForDate(dateStr);
            const dayNotes = notes.filter(n => n.date === dateStr);
            const cashPayments = cashOps.filter(op => op.date === dateStr && parseFloat(op.expense) > 0);
            const cashIncomes = cashOps.filter(op => op.date === dateStr && parseFloat(op.income) > 0);
            
            // Определяем цвет дня по приоритету
            let classes = `day-cell${isSelected?' selected':''}`;
            let dayBadge = { orders: 0, notes: 0, expenses: 0, incomes: 0 };
            
            // Считаем количество записей
            dayBadge.orders = dayOrders.length;
            dayBadge.notes = dayNotes.length;
            dayBadge.expenses = cashPayments.length + regularPayments.length;
            dayBadge.incomes = cashIncomes.length + regularIncomes.length;
            
            // Определяем цвет дня (приоритет: красный > синий > жёлтый > зелёный)
            if (criticalOrder) {
                // Очень срочный заказ - красный (переопределяет всё)
                classes += ' color-critical';
            } else if (regularPayments.length > 0 || regularIncomes.length > 0) {
                // Регулярный платёж - синий
                classes += ' color-payment';
            } else if (dayOrders.length > 0) {
                const colors = dayOrders.map(o => getOrderColorObj(o));
                if (colors.includes('critical')) classes += ' color-critical';
                else if (colors.includes('middle')) classes += ' color-middle';
                else classes += ' color-new';
            } else if (dayNotes.length > 0) {
                classes += ' color-note';
            }
            
            const div = document.createElement('div');
            div.className = classes;
            
            // Формируем HTML с подсказками
            let html = `<span class="day-number">${d}</span>`;
            
            // Показываем значки с количеством
            let badgeText = [];
            if (dayBadge.orders > 0) badgeText.push(`📋${dayBadge.orders}`);
            if (dayBadge.notes > 0) badgeText.push(`📝${dayBadge.notes}`);
            if (dayBadge.expenses > 0) badgeText.push(`💰${dayBadge.expenses}`);
            if (dayBadge.incomes > 0) badgeText.push(`💵${dayBadge.incomes}`);
            
            if (badgeText.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'task-badge';
                badge.textContent = badgeText.join('+');
                badge.style.cssText = 'font-size:9px; line-height:1.2; padding:2px 4px; max-width:50px; word-wrap:break-word;';
                div.appendChild(badge);
            }
            
            div.title = `${dateStr}\nЗаказов: ${dayBadge.orders}\nЗаметок: ${dayBadge.notes}\nРасходов: ${dayBadge.expenses}\nДоходов: ${dayBadge.incomes}`;
            div.addEventListener('click', () => { selectedDate = dateObj; renderCalendar(); renderSchedule(); });
            grid.appendChild(div);
        }
        renderSchedule();
    }
    
    // ========== УВЕДОМЛЕНИЯ ==========
    function saveNotificationShown(dateStr) {
        const shown = JSON.parse(localStorage.getItem('notifications_shown') || '[]');
        if (!shown.includes(dateStr)) {
            shown.push(dateStr);
            localStorage.setItem('notifications_shown', JSON.stringify(shown));
        }
    }

    function renderSchedule() {
        const title = document.getElementById('selectedDateDisplay');
        const grid = document.getElementById('scheduleGrid');
        if (!selectedDate) { title.textContent='не выбран'; grid.innerHTML=''; return; }
        title.textContent = formatDate(selectedDate);
        const dateStr = formatDate(selectedDate);
        grid.innerHTML = '';
        const dayOrders = ordersData.filter(o => o.date === dateStr);
        const dayPayments = cashOps.filter(op => op.date === dateStr && parseFloat(op.expense) > 0);
        const dayIncomes = cashOps.filter(op => op.date === dateStr && parseFloat(op.income) > 0);
        const regularPayments = getRegularPaymentsForDate(dateStr);
        const regularIncomes = getRegularIncomesForDate(dateStr);
        const dayNotes = notes.filter(n => n.date === dateStr);
        [...dayPayments, ...regularPayments].forEach(p => {
            const div = document.createElement('div');
            div.className = 'schedule-slot payment-slot';
            div.innerHTML = `<div>💰 ${p.desc}${p.regular ? ' (регулярный)' : ''} – ${(parseFloat(p.expense)||0).toFixed(2)}₽</div>`;
            grid.appendChild(div);
        });
        dayIncomes.forEach(income => {
            const div = document.createElement('div');
            div.className = 'schedule-slot';
            div.style.background = '#d4edda';
            div.style.borderColor = '#28a745';
            div.innerHTML = `<div>💵 ${income.desc} – ${(parseFloat(income.income)||0).toFixed(2)}₽</div>`;
            grid.appendChild(div);
        });
        [...regularIncomes].forEach(income => {
            const div = document.createElement('div');
            div.className = 'schedule-slot';
            div.style.background = '#d4edda';
            div.style.borderColor = '#28a745';
            div.innerHTML = `<div>💵 ${income.desc} (регулярный) – ${(parseFloat(income.income)||0).toFixed(2)}₽</div>`;
            grid.appendChild(div);
        });
        dayNotes.forEach(n => {
            const div = document.createElement('div');
            div.className = 'schedule-slot note-slot';
            div.innerHTML = `<div>📝 ${n.time ? n.time + ' ' : ''}${n.text}</div><button class="btn-del" onclick="deleteNote(${n.id})">✕</button>`;
            grid.appendChild(div);
        });
        dayOrders.forEach(order => {
            const color = getOrderColorObj(order);
            const div = document.createElement('div');
            div.className = `schedule-slot color-${color}`;
            div.innerHTML = `<div>№${order.orderNumber} ${order.client} – ${order.services.map(s=>s.serviceName).join(', ')}</div><div>${(parseFloat(order.clientPrice)||0).toFixed(2)}₽</div>`;
            div.addEventListener('click', () => openOrderModal(order.id));
            grid.appendChild(div);
        });
        if (dayOrders.length === 0 && dayPayments.length === 0 && dayIncomes.length === 0 && regularPayments.length === 0 && regularIncomes.length === 0 && dayNotes.length === 0) {
            grid.innerHTML = '<div>Нет записей</div>';
        }
    }

    function changeMonth(delta) {
        currentDate.setMonth(currentDate.getMonth()+delta);
        renderCalendar();
    }
    
    function goToday() {
        currentDate = new Date();
        selectedDate = new Date();
        renderCalendar();
    }
    
    function goTomorrow() {
        currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + 1);
        selectedDate = new Date(currentDate);
        renderCalendar();
    }
    
    // ========== ФИЛЬТР ПО УСЛУГАМ ==========
    let currentServiceFilter = 'all';
    let calendarViewMode = 'month'; // 'month' или 'week'
    
    function getServiceFilterButtons() {
        const services = [...new Set(rates.map(r => r.service))];
        let html = '<span style="font-size:14px; color:#6c757d;">Услуги:</span>';
        html += '<button class="service-filter-btn active" data-service="all" onclick="filterByService(\'all\')">Все</button>';
        services.forEach(svc => {
            html += `<button class="service-filter-btn" data-service="${svc}" onclick="filterByService('${svc}')">${svc}</button>`;
        });
        return html;
    }
    
    function filterByService(service) {
        currentServiceFilter = service;
        document.querySelectorAll('.service-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.service === service);
        });
        renderCalendar();
    }
    
    function toggleCalendarView() {
        calendarViewMode = calendarViewMode === 'month' ? 'week' : 'month';
        const btn = document.getElementById('viewToggleBtn');
        btn.textContent = calendarViewMode === 'month' ? '📅 Неделя' : '📅 Месяц';
        renderCalendar();
    }
    
    function getCalendarSum() {
        const year = currentDate.getFullYear(), month = currentDate.getMonth();
        const daysInMonth = new Date(year, month+1, 0).getDate();
        let totalOrders = 0, totalSum = 0;
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayOrders = ordersData.filter(o => o.date === dateStr);
            dayOrders.forEach(order => {
                if (currentServiceFilter === 'all' || order.services.some(s => s.serviceName === currentServiceFilter)) {
                    totalOrders++;
                    totalSum += parseFloat(order.clientPrice) || 0;
                }
            });
        }
        
        return { orders: totalOrders, sum: totalSum };
    }
    
    function renderCalendarSummary() {
        const summary = getCalendarSum();
        const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        document.getElementById('calendarSummary').innerHTML = `
            <span style="color:#007bff;">📋 Заказов: ${summary.orders}</span>
            <span style="color:#28a745;">💰 Прогноз: ${summary.sum.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}₽</span>
            <span style="color:#6c757d;">📅 ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}</span>
        `;
    }

    // ========== ВИД НЕДЕЛИ ==========
    function renderWeekView() {
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const dateStr = formatDate(date);
            const dayOrders = ordersData.filter(o => o.date === dateStr);
            
            // Фильтруем по услуге
            const visibleOrders = dayOrders.filter(o => 
                currentServiceFilter === 'all' || o.services.some(s => s.serviceName === currentServiceFilter)
            );
            
            // Определяем цвет дня по срочности
            let bgColor = '#f8f9fa';
            let borderColor = 'transparent';
            let colorClass = '';
            
            if (visibleOrders.length > 0) {
                const colors = visibleOrders.map(o => getOrderColorObj(o));
                if (colors.includes('critical')) {
                    bgColor = '#f8d7da';
                    borderColor = '#dc3545';
                } else if (colors.includes('middle')) {
                    bgColor = '#fff3cd';
                    borderColor = '#ffc107';
                } else if (colors.includes('new')) {
                    bgColor = '#d4edda';
                    borderColor = '#28a745';
                }
            }
            
            // Подсвечиваем сегодня
            const isToday = date.toDateString() === today.toDateString();
            if (isToday) {
                borderColor = '#1a3c5e';
            }
            
            const div = document.createElement('div');
            div.className = 'day-cell';
            if (colorClass) div.className += ' ' + colorClass;
            div.style.background = bgColor;
            if (borderColor !== 'transparent') {
                div.style.borderColor = borderColor;
                div.style.borderWidth = '2px';
                div.style.borderStyle = 'solid';
            }
            div.innerHTML = `<div style="font-weight:700; font-size:14px;">${dayNames[i]}</div><div style="font-size:12px; color:#6c757d;">${date.getDate()}</div>`;
            div.addEventListener('click', () => {
                selectedDate = date;
                renderCalendar();
                renderSchedule();
            });
            
            // Показываем заказы
            visibleOrders.forEach(order => {
                const badge = document.createElement('div');
                const color = getOrderColorObj(order);
                badge.style.cssText = `font-size:10px; margin-top:2px; padding:2px 4px; background:${color === 'critical' ? '#f5c6cb' : color === 'middle' ? '#ffeeba' : '#c3e6cb'}; border-radius:4px; border-left: 2px solid ${color === 'critical' ? '#dc3545' : color === 'middle' ? '#ffc107' : '#28a745'};`;
                badge.textContent = `№${order.orderNumber} ${order.client}`;
                div.appendChild(badge);
            });
            
            // Показываем заметки
            const dayNotes = notes.filter(n => n.date === dateStr);
            if (dayNotes.length > 0) {
                const noteBadge = document.createElement('div');
                noteBadge.style.cssText = 'font-size:9px; margin-top:2px; padding:2px 4px; background:#e6d9f5; border-radius:4px; color:#6f42c1;';
                noteBadge.textContent = `📝 ${dayNotes.length}`;
                div.appendChild(noteBadge);
            }
            
            // Показываем платежи
            const dayPayments = cashOps.filter(op => op.date === dateStr && parseFloat(op.expense) > 0);
            if (dayPayments.length > 0) {
                const payBadge = document.createElement('div');
                payBadge.style.cssText = 'font-size:9px; margin-top:2px; padding:2px 4px; background:#cce5ff; border-radius:4px; color:#007bff;';
                payBadge.textContent = `💰 ${dayPayments.length}`;
                div.appendChild(payBadge);
            }
            
            grid.appendChild(div);
        }
    }
    
    // ========== ЭКСПОРТ КАЛЕНДАРЯ ==========
    function exportCalendar() {
        const year = currentDate.getFullYear(), month = currentDate.getMonth();
        const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        const daysInMonth = new Date(year, month+1, 0).getDate();
        
        let text = `📅 КАЛЕНДАРЬ: ${months[month]} ${year}\n`;
        text += `${'='.repeat(50)}\n\n`;
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dateObj = new Date(year, month, d);
            const dayOrders = ordersData.filter(o => o.date === dateStr);
            const dayNotes = notes.filter(n => n.date === dateStr);
            
            if (dayOrders.length > 0 || dayNotes.length > 0) {
                text += `${d} ${months[month]}:\n`;
                dayOrders.forEach(order => {
                    if (currentServiceFilter !== 'all' && !order.services.some(s => s.serviceName === currentServiceFilter)) return;
                    const color = getOrderColorObj(order);
                    const colorName = color === 'critical' ? '🔴' : color === 'middle' ? '🟡' : color === 'done' ? '⬜' : '🟢';
                    text += `  ${colorName} №${order.orderNumber} ${order.client} – ${order.services.map(s=>s.serviceName).join(', ')} – ${(parseFloat(order.clientPrice)||0).toFixed(2)}₽\n`;
                });
                dayNotes.forEach(note => {
                    text += `  📝 ${note.time ? note.time + ' ' : ''}${note.text}\n`;
                });
                text += '\n';
            }
        }
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `calendar_${months[month]}_${year}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // ========== УЛУЧШЕННЫЕ УВЕДОМЛЕНИЯ ==========
    function showNotificationModal(tomorrowStr, orders, notes, payments) {
        const modal = document.getElementById('notificationModal');
        const title = document.getElementById('notificationTitle');
        const body = document.getElementById('notificationBody');
        
        title.textContent = `🔔 На завтра (${tomorrowStr})`;
        let html = '';
        
        if (orders.length > 0) {
            html += '<div class="notification-item orders">';
            html += '<div class="notification-title">📋 Заказов: ' + orders.length + '</div>';
            html += '<ul class="notification-list">';
            orders.forEach(o => {
                const color = getOrderColorObj(o);
                const colorName = color === 'critical' ? '🔴 ОЧЕНЬ СРОЧНЫЙ' : color === 'middle' ? '🟡 Срочный' : '🟢 Новый';
                html += `<li>№${o.orderNumber} ${o.client} – ${o.services.map(s=>s.serviceName).join(', ')} (${colorName})</li>`;
            });
            html += '</ul></div>';
        }
        
        if (notes.length > 0) {
            html += '<div class="notification-item notes">';
            html += '<div class="notification-title">📝 Заметок: ' + notes.length + '</div>';
            html += '<ul class="notification-list">';
            notes.forEach(n => {
                html += '<li>' + n.text + '</li>';
            });
            html += '</ul></div>';
        }
        
        if (payments.length > 0) {
            html += '<div class="notification-item payments">';
            html += '<div class="notification-title">💰 Регулярные платежи:</div>';
            html += '<ul class="notification-list">';
            payments.forEach(p => {
                html += '<li>' + p.desc + ' – ' + (parseFloat(p.expense)||0).toFixed(2) + '₽</li>';
            });
            html += '</ul></div>';
        }
        
        if (!html) {
            html = '<p style="text-align:center; color:#6c757d; padding:20px;">На завтра нет записей ✨</p>';
        }
        
        body.innerHTML = html;
        modal.classList.add('active');
        saveNotificationShown(tomorrowStr);
    }
    
    function closeNotificationModal() {
        document.getElementById('notificationModal').classList.remove('active');
    }
    
    function checkTomorrowNotifications() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatDate(tomorrow);
        
        const shown = JSON.parse(localStorage.getItem('notifications_shown') || '[]');
        if (shown.includes(tomorrowStr)) return;
        
        const tomorrowOrders = ordersData.filter(o => o.date === tomorrowStr);
        const tomorrowNotes = notes.filter(n => n.date === tomorrowStr);
        const tomorrowPayments = getRegularPaymentsForDate(tomorrowStr);
        
        if (tomorrowOrders.length > 0 || tomorrowNotes.length > 0 || tomorrowPayments.length > 0) {
            showNotificationModal(tomorrowStr, tomorrowOrders, tomorrowNotes, tomorrowPayments);
        }
    }

    // ========== ЗАМЕТКИ ==========
    function openNoteModal(dateStr) {
        document.getElementById('noteModalTitle').textContent = 'Новая заметка';
        document.getElementById('noteDate').value = dateStr || (selectedDate ? formatDate(selectedDate) : '');
        document.getElementById('noteTime').value = '';
        document.getElementById('noteText').value = '';
        document.getElementById('noteModal').classList.add('active');
    }
    function closeNoteModal() { document.getElementById('noteModal').classList.remove('active'); }
    function saveNote() {
        const date = document.getElementById('noteDate').value;
        const time = document.getElementById('noteTime').value;
        const text = document.getElementById('noteText').value.trim();
        if (!date || !text) { alert('Введите дату и текст'); return; }
        notes.push({id: Date.now(), date, time, text});
        saveAll();
        closeNoteModal();
        renderAll();
    }
    function deleteNote(id) {
        notes = notes.filter(n => n.id !== id);
        saveAll();
        renderAll();
    }

    // ========== РЕНДЕР ==========
    function renderAll() {
        renderOrders();
        renderStock();
        renderCash();
        populateSummarySelects();
        renderSummary();
        renderCalendar();
        renderRefs();
        renderPurchaseOrdersList();
        updateUnpaidSummary();
        renderBudget();
    }

    // ========== СПРАВОЧНИКИ ==========
    function renderRefs() {
        renderServicesTable();
        renderMarkersTable();
        renderColorTable();
        renderPaintTable();
        renderFilmTable();
        renderExtraRefTable();
        updateServiceItemDatalist();
        fillServiceSelects();
    }

    function renderOrders() {
        const list = document.getElementById('ordersList');
        list.innerHTML = '';
        ordersData.forEach(order => {
            const color = getOrderColorObj(order);
            const show = filterCheck(order, currentFilter);
            if (!show) return;
            const div = document.createElement('div');
            div.className = `order-item status-${color}`;
            div.innerHTML = `
                <div class="order-header">
                    <span class="order-number">№${order.orderNumber}</span>
                    <span class="order-date">${order.date}</span>
                    <span class="order-deadline">${getDeadline(order)}</span>
                    <span class="order-client">${order.client}</span>
                    <span class="order-phone">${order.phone||''}</span>
                    <span class="order-service">${order.services.map(s => s.serviceName).join(', ')}</span>
                    <span class="order-sum ${order.paid?'paid':'unpaid'}">${(parseFloat(order.clientPrice)||0).toFixed(2)}₽</span>
                    <span class="order-paid"><input type="checkbox" ${order.paid?'checked':''} onchange="togglePaid(${order.id}, this.checked)"> Оплачено</span>
                    <span class="color-indicator ${color}"></span>
                </div>`;
            div.onclick = (e) => { if (e.target.tagName !== 'INPUT') openOrderModal(order.id); };
            list.appendChild(div);
        });
        document.getElementById('orderCount').textContent = ordersData.length;
        updateUnpaidSummary();
    }
    function filterCheck(order, filter) {
        const color = getOrderColorObj(order);
        switch(filter) {
            case 'all': return true;
            case 'new': return color === 'new' && !order.done;
            case 'middle': return color === 'middle' && !order.done;
            case 'critical': return color === 'critical' && !order.done;
            case 'done': return order.done || color === 'done';
            case 'unpaid': return !order.paid;
            default: return true;
        }
    }
    function updateUnpaidSummary() {
        const unpaid = ordersData.filter(o => !o.paid);
        document.getElementById('unpaidCount').textContent = unpaid.length;
        document.getElementById('unpaidSum').textContent = unpaid.reduce((s,o)=>s+(parseFloat(o.clientPrice)||0),0).toFixed(2);
    }
    function renderStock() {
        const tbody = document.getElementById('stockBody');
        tbody.innerHTML = '';
        const stock = loadStock();
        const names = new Set();
        extraRef.forEach(r => names.add(r.name));
        paints.forEach(p => names.add(p.name));
        films.forEach(f => names.add(f.name));
        materialTypes.forEach(mt => mt.articles.forEach(a => names.add(a.name)));
        names.forEach(name => {
            const item = stock.find(s => s.name === name) || {name, unit:'шт', price:0, income:0, used:0, remain:0};
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${name}</td>
                <td>${item.unit}</td>
                <td>${parseFloat(item.price)||0}</td>
                <td><input type="number" class="stock-income" value="${parseFloat(item.income)||0}" data-name="${name}"></td>
                <td><input type="number" class="stock-used" value="${parseFloat(item.used)||0}" data-name="${name}"></td>
                <td>${((parseFloat(item.income)||0) - (parseFloat(item.used)||0)).toFixed(2)}</td>`;
            tbody.appendChild(tr);
        });
        // Используем делегирование событий для избежания дублирования слушателей
        tbody.addEventListener('change', (e) => {
            const input = e.target;
            if (!input || !input.dataset.name) return;
            const name = input.dataset.name;
            const val = parseFloat(input.value) || 0;
            const stock = loadStock();
            const item = stock.find(s => s.name === name);
            if (!item) return;
            if (input.classList.contains('stock-income')) {
                item.income = val;
            } else if (input.classList.contains('stock-used')) {
                item.used = val;
            }
            saveStock(stock);
            renderStock();
        });
    }

    // ========== ИТОГИ (ОТЧЁТ) ==========
    function calculateSummaryPeriodDates() {
        const yearSel = document.getElementById('summaryYear');
        const monthSel = document.getElementById('summaryMonth');
        const customDateFrom = document.getElementById('customDateFrom');
        const customDateTo = document.getElementById('customDateTo');
        if (!yearSel || !monthSel) return { startDate: '', endDate: '' };
        
        let startDate, endDate;
        const currentYear = parseInt(yearSel.value);
        const currentMonth = parseInt(monthSel.value);
        
        if (currentReportPeriodType === 'custom' && customDateFrom?.value && customDateTo?.value) {
            startDate = customDateFrom.value;
            endDate = customDateTo.value;
        } else if (currentReportPeriodType === 'year') {
            startDate = `${currentYear}-01-01`;
            endDate = `${currentYear}-12-31`;
        } else if (currentReportPeriodType === 'quarter') {
            const quarter = Math.ceil(currentMonth / 3);
            const quarterStart = (quarter - 1) * 3 + 1;
            const lastMonth = quarterStart + 2;
            const lastDay = new Date(currentYear, lastMonth, 0).getDate();
            startDate = `${currentYear}-${String(quarterStart).padStart(2,'0')}-01`;
            endDate = `${currentYear}-${String(lastMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
        } else {
            // month (по умолчанию)
            const lastDay = new Date(currentYear, currentMonth, 0).getDate();
            startDate = `${currentYear}-${String(currentMonth).padStart(2,'0')}-01`;
            endDate = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
        }
        
        return { startDate, endDate };
    }

    function renderSummary() {
        const yearSel = document.getElementById('summaryYear');
        const monthSel = document.getElementById('summaryMonth');
        const customDateFrom = document.getElementById('customDateFrom');
        const customDateTo = document.getElementById('customDateTo');
        if (!yearSel || !monthSel) return;
        
        const { startDate, endDate } = calculateSummaryPeriodDates();
        
        let filteredOrders = ordersData.filter(o => o.date && o.date >= startDate && o.date <= endDate);
        let filteredCash = cashOps.filter(op => op.date && op.date >= startDate && op.date <= endDate);
        
        // Формируем заголовок
        const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        const startD = new Date(startDate);
        const endD = new Date(endDate);
        
        let titleText = '';
        let subtitleText = '';
        
        if (currentReportPeriodType === 'custom' && customDateFrom?.value && customDateTo?.value) {
            titleText = `Отчёт за период`;
            subtitleText = `с ${formatDatePretty(startDate)} по ${formatDatePretty(endDate)}`;
        } else if (currentReportPeriodType === 'quarter') {
            titleText = `Отчёт за ${currentReportPeriodType === 'quarter' ? 'квартал' : ''} ${startD.getFullYear()}`;
            subtitleText = `${months[startD.getMonth()]} — ${months[endD.getMonth()]}`;
        } else if (startD.getMonth() === endD.getMonth() && startD.getFullYear() === endD.getFullYear()) {
            titleText = `Отчёт за ${months[startD.getMonth()]} ${startD.getFullYear()}`;
            subtitleText = '';
        } else {
            titleText = `Отчёт за период`;
            subtitleText = `с ${formatDatePretty(startDate)} по ${formatDatePretty(endDate)}`;
        }
        
        document.getElementById('summaryTitle').textContent = titleText;
        document.getElementById('summarySubtitle').textContent = subtitleText;
        
        let revenue=0, cost=0, helper=0;
        filteredOrders.forEach(o => {
            revenue += parseFloat(o.clientPrice)||0;
            cost += parseFloat(o.materialCost)||0;
            helper += parseFloat(o.helperPay)||0;
        });
        const gross = revenue - cost - helper;
        let expenses = filteredCash.reduce((acc, op) => acc + (parseFloat(op.expense)||0), 0);
        const net = gross - expenses;
        
        const revenueClass = revenue > 0 ? 'positive' : '';
        const costClass = 'negative';
        const helperClass = 'negative';
        const netClass = net >= 0 ? 'positive' : 'negative';
        
        document.getElementById('summaryBlock').innerHTML = `
            <div class="summary-item"><label>💰 Выручка</label><span class="${revenueClass}">${revenue.toFixed(2)} ₽</span></div>
            <div class="summary-item"><label>📦 Себестоимость</label><span class="${costClass}">${cost.toFixed(2)} ₽</span></div>
            <div class="summary-item"><label>👥 Помощнику</label><span class="${helperClass}">${helper.toFixed(2)} ₽</span></div>
            <div class="summary-item"><label>📈 Валовый доход</label><span>${gross.toFixed(2)} ₽</span></div>
            <div class="summary-item"><label>💸 Расходы</label><span class="${costClass}">${expenses.toFixed(2)} ₽</span></div>
            <div class="summary-item"><label>✨ Чистая прибыль</label><span class="${netClass}">${net.toFixed(2)} ₽</span></div>
            <div class="summary-item"><label>📊 Заказов за период</label><span>${filteredOrders.length}</span></div>
        `;
    }

    function createSampleOrders() {
        if (ordersData.length > 0) return;
        const today = new Date();
        const dateWithOffset = daysAgo => {
            const date = new Date(today);
            date.setDate(date.getDate() - daysAgo);
            return formatDate(date);
        };
        const createService = (serviceName, values = {}) => {
            const service = rates.find(rate => rate.service === serviceName);
            if (!service) return null;
            const instance = {
                serviceName,
                usesFabric: serviceUsesMarker(service, 'Ткань'),
                usesPaint: serviceUsesPaint(service),
                usesFilm: serviceUsesMarker(service, 'Пленка для аквапринта'),
                fabric: {category:'Велюр', code:'A1011', meters: values.meters || 0, price:1400, colorName:'Потолочная ткань (велюр)'},
                paint: {category:'Акрил', code:'P001', qty: values.paintQty || 0, price:2.5, colorName:'Краска черная'},
                film: {category:'Глянцевая', code:'FG-01', meters: values.filmMeters || 0, price:1200, name:'Черный глянец'},
                manualItems: {}
            };
            (service.items || []).forEach(item => {
                if (!item.customMarker && !['Ткань', 'Краска', 'Пленка для аквапринта'].includes(item.name)) {
                    instance.manualItems[item.name] = item.manual ? (values.manualQty || 2) : 0;
                }
            });
            return instance;
        };
        const samples = [
            {client:'Тест выполнен 1', service:'Восстановление после ДТП', date:dateWithOffset(3), durationDays:1, done:true, clientPrice:25000},
            {client:'Тест выполнен 2', service:'Покраска пластика', date:dateWithOffset(5), durationDays:2, done:true, clientPrice:18000},
            {client:'Тест срочный 1', service:'Перетяжка потолка', date:dateWithOffset(7), durationDays:10, clientPrice:22000},
            {client:'Тест срочный 2', service:'Шумоизоляция', date:dateWithOffset(6), durationDays:8, clientPrice:19000},
            {client:'Тест очень срочный 1', service:'Восстановление после ДТП', date:dateWithOffset(9), durationDays:10, clientPrice:28000},
            {client:'Тест очень срочный 2', service:'Аквапринт', date:dateWithOffset(5), durationDays:5, clientPrice:21000},
            {client:'Тест новый 1', service:'Перетяжка потолка', date:dateWithOffset(0), durationDays:10, clientPrice:24000},
            {client:'Тест новый 2', service:'Покраска пластика', date:dateWithOffset(1), durationDays:10, clientPrice:16000},
            {client:'Тест новый 3', service:'Аквапринт', date:dateWithOffset(2), durationDays:10, clientPrice:20000},
            {client:'Тест новый 4', service:'Шумоизоляция', date:dateWithOffset(0), durationDays:10, clientPrice:17000}
        ];
        samples.forEach((sample, index) => {
            const service = createService(sample.service, {meters: sample.service === 'Перетяжка потолка' ? 4 : 0, paintQty: sample.service === 'Восстановление после ДТП' || sample.service === 'Покраска пластика' ? 250 : 0, filmMeters: sample.service === 'Аквапринт' ? 2 : 0});
            if (!service) return;
            ordersData.push({id:Date.now() + index, orderNumber:index + 1, date:sample.date, client:sample.client, phone:'+7 900 000-00-0' + (index + 1), services:[service], clientPrice:sample.clientPrice, helperPay:1000, durationDays:sample.durationDays, extraData:'{}', done:sample.done, paid:false, manualColor:'auto'});
        });
        ordersData.forEach(order => recalcOrder(order));
        recalculateStockFromAllOrders();
        saveAll();
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    function addRegularPaymentsToCash() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth()+1;
        regularExpenses.forEach(exp => {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(exp.day).padStart(2,'0')}`;
            const exists = cashOps.some(op => op.desc === exp.desc && op.date === dateStr);
            if (!exists) {
                cashOps.push({date: dateStr, desc: exp.desc, income:0, expense: exp.amount});
            }
        });
        regularIncomes.forEach(income => {
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(income.day).padStart(2,'0')}`;
            const exists = cashOps.some(op => op.desc === income.desc && op.date === dateStr);
            if (!exists) cashOps.push({date: dateStr, desc: income.desc, income: income.amount, expense:0});
        });
        saveAll();
    }
    
    function formatDatePretty(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }
    
    function setReportPeriod(type) {
        currentReportPeriodType = type;
        const yearSel = document.getElementById('summaryYear');
        const monthSel = document.getElementById('summaryMonth');
        const customDateFrom = document.getElementById('customDateFrom');
        const customDateTo = document.getElementById('customDateTo');
        const btnMonth = document.getElementById('btnMonth');
        const btnQuarter = document.getElementById('btnQuarter');
        const btnYear = document.getElementById('btnYear');
        const btnCustom = document.getElementById('btnCustom');
        
        // Сброс всех кнопок
        [btnMonth, btnQuarter, btnYear, btnCustom].forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });
        
        if (type === 'month') {
            btnMonth.classList.remove('btn-secondary');
            btnMonth.classList.add('btn-primary');
            customDateFrom.style.display = 'none';
            customDateTo.style.display = 'none';
            yearSel.style.display = 'inline-block';
            monthSel.style.display = 'inline-block';
        } else if (type === 'quarter') {
            btnQuarter.classList.remove('btn-secondary');
            btnQuarter.classList.add('btn-primary');
            customDateFrom.style.display = 'none';
            customDateTo.style.display = 'none';
            yearSel.style.display = 'inline-block';
            monthSel.style.display = 'inline-block';
            // Для квартала - показываем первый месяц квартала
            const currentMonth = parseInt(monthSel.value) || (new Date().getMonth() + 1);
            const quarter = Math.ceil(currentMonth / 3);
            const quarterStart = (quarter - 1) * 3 + 1;
            monthSel.value = quarterStart;
        } else if (type === 'year') {
            btnYear.classList.remove('btn-secondary');
            btnYear.classList.add('btn-primary');
            customDateFrom.style.display = 'none';
            customDateTo.style.display = 'none';
            yearSel.style.display = 'inline-block';
            monthSel.style.display = 'none';
        } else if (type === 'custom') {
            btnCustom.classList.remove('btn-secondary');
            btnCustom.classList.add('btn-primary');
            yearSel.style.display = 'none';
            monthSel.style.display = 'none';
            customDateFrom.style.display = 'inline-block';
            customDateTo.style.display = 'inline-block';
            // Установка дат по умолчанию
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), 0, 1);
            customDateFrom.value = formatDate(firstDay);
            customDateTo.value = formatDate(now);
        }
        
        renderSummary();
    }
    
    function resetReportPeriod() {
        setReportPeriod('month');
    }
    
    function printSummaryReport() {
        const title = document.getElementById('summaryTitle').textContent;
        const subtitle = document.getElementById('summarySubtitle').textContent;
        const block = document.getElementById('summaryBlock').innerHTML;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    h1 { color: #1a3c5e; border-bottom: 3px solid #1a3c5e; padding-bottom: 10px; }
                    h2 { color: #6c757d; margin-top: -10px; }
                    .summary-block { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
                    .summary-item { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef; }
                    .summary-item label { font-weight: 600; color: #495057; display: block; margin-bottom: 8px; }
                    .summary-item span { font-size: 24px; font-weight: 700; color: #1a3c5e; }
                    .summary-item span.positive { color: #28a745; }
                    .summary-item span.negative { color: #dc3545; }
                    .footer { margin-top: 30px; padding-top: 15px; border-top: 2px solid #e9ecef; color: #6c757d; font-size: 12px; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <h1>📊 Отчёт по финансовым показателям</h1>
                <h2>${title}</h2>
                ${subtitle ? `<p style="color: #6c757d; margin-top: -15px;">${subtitle}</p>` : ''}
                <div class="summary-block">${block}</div>
                <div class="footer">
                    <p>Дата формирования: ${new Date().toLocaleDateString('ru-RU')} | Авто-ателье</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
    
    function exportSummaryReport() {
        const title = document.getElementById('summaryTitle').textContent;
        const subtitle = document.getElementById('summarySubtitle').textContent;
        const block = document.getElementById('summaryBlock');
        
        let text = `ОТЧЁТ ПО ФИНАНСОВЫМ ПОКАЗАТЕЛЯМ\n`;
        text += `${'='.repeat(40)}\n\n`;
        text += `${title}\n`;
        if (subtitle) text += `${subtitle}\n\n`;
        text += `${'-'.repeat(40)}\n\n`;
        
        const items = block.querySelectorAll('.summary-item');
        items.forEach(item => {
            const label = item.querySelector('label')?.textContent || '';
            const value = item.querySelector('span')?.textContent || '';
            text += `${label}: ${value}\n`;
        });
        
        text += `\n${'-'.repeat(40)}\n`;
        text += `Дата формирования: ${new Date().toLocaleDateString('ru-RU')}\n`;
        text += `Авто-ателье\n`;
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Отчёт_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
    }

    function populateSummarySelects() {
        const yearSel = document.getElementById('summaryYear');
        const monthSel = document.getElementById('summaryMonth');
        if (!yearSel || !monthSel) return;
        const currentYear = new Date().getFullYear();
        const years = new Set();
        ordersData.forEach(o => { if (o.date) years.add(o.date.slice(0,4)); });
        cashOps.forEach(op => { if (op.date) years.add(op.date.slice(0,4)); });
        years.add(currentYear);
        years.add(currentYear - 1);
        const sortedYears = Array.from(years).sort().reverse();
        yearSel.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
        const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        monthSel.innerHTML = monthNames.map((m, i) => `<option value="${i+1}">${m}</option>`).join('');
        yearSel.value = currentYear;
        monthSel.value = new Date().getMonth() + 1;
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadData();
        createSampleOrders();
        addRegularPaymentsToCash();
        currentDate = new Date();
        selectedDate = new Date();
        recalculateStockFromAllOrders();
        renderAll();

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById(btn.dataset.tab).classList.add('active');
                btn.classList.add('active');
                if (btn.dataset.tab === 'tab-calendar') renderCalendar();
                if (btn.dataset.tab === 'tab-ref') renderRefs();
                if (btn.dataset.tab === 'tab-purchase') renderPurchaseOrdersList();
            });
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderOrders();
            });
        });

        document.getElementById('orderModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeOrderModal(); });
        document.getElementById('extraModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeExtraModal(); });
        document.getElementById('serviceItemsModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeServiceItemsModal(); });
        document.getElementById('bookingModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
        document.getElementById('noteModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeNoteModal(); });
        document.getElementById('addColorModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddColorModal(); });
        document.getElementById('addPaintModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddPaintModal(); });
        document.getElementById('addFilmModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddFilmModal(); });
        document.getElementById('addExtraRefModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddExtraRefModal(); });

        document.getElementById('orderDate').addEventListener('input', updateDeadline);
        document.getElementById('orderDurationDays').addEventListener('input', updateDeadline);
        document.getElementById('orderClientPrice').addEventListener('input', updateModalTotals);
        document.getElementById('orderHelperPay').addEventListener('input', updateModalTotals);

        populateSummarySelects();
        renderSummary();
    });
window.updateCloudData = function(data) {
    const localRates = JSON.parse(localStorage.getItem('rates_data') || '[]');
    const localMaterialTypes = JSON.parse(localStorage.getItem('materialTypes_data') || '[]');
    colors = data.colors || [];
    paints = data.paints || [];
    films = data.films || [];
    extraRef = data.extraRef || [];
    if (!localChangesPending) rates = (data.rates || []).map(cloudService => {
        const localService = localRates.find(service => service.service === cloudService.service);
        if (!localService) return cloudService;
        const cloudItems = cloudService.items || [];
        const localItems = localService.items || [];
        const localNames = new Set(localItems.map(item => String(item.name || '').trim().toLowerCase()));
        const cloudOnlyItems = cloudItems.filter(item => !localNames.has(String(item.name || '').trim().toLowerCase()));
        return {...cloudService, ...localService, items: [...localItems, ...cloudOnlyItems]};
    });
    if (!localChangesPending) localRates.forEach(localService => {
        if (!rates.some(service => service.service === localService.service)) rates.push(localService);
    });
    rates.forEach(r => { if (!r.items) r.items = []; });
    ordersData = data.ordersData || [];
    ordersData.forEach(order => (order.services || []).forEach(inst => { inst.manualItems = inst.manualItems || {}; }));
    cashOps = data.cashOps || [];
    bookings = data.bookings || [];
    materialTypes = (data.materialTypes || []).map(cloudType => {
        const localType = localMaterialTypes.find(type => String(type.name || '').trim().toLowerCase() === String(cloudType.name || '').trim().toLowerCase());
        return localType ? {...cloudType, ...localType} : cloudType;
    });
    localMaterialTypes.forEach(localType => {
        if (!materialTypes.some(type => String(type.name || '').trim().toLowerCase() === String(localType.name || '').trim().toLowerCase())) materialTypes.push(localType);
    });
    regularExpenses = data.regularExpenses || [];
    regularIncomes = data.regularIncomes || [];
    notes = data.notes || [];
    saveAll();
    renderAll();
};

// ========== ГОРЯЧИЕ КЛАВИШИ ==========
document.addEventListener('keydown', (e) => {
    // Проверяем, что не находимся в поле ввода
    const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const isModalOpen = document.querySelector('.modal-overlay.active');
    
    if (isInInput || isModalOpen) return;
    
    // Ctrl+D — создать заказ на сегодня
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        openOrderModal();
    }
    
    // Ctrl+N — создать заказ на завтра
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        currentDate = new Date(tomorrow);
        selectedDate = new Date(tomorrow);
        openOrderModal();
    }
    
    // Стрелки влево/вправо — переключение дней
    if (e.key === 'ArrowLeft') {
        if (calendarViewMode === 'week') {
            currentDate.setDate(currentDate.getDate() - 7);
        } else {
            currentDate.setMonth(currentDate.getMonth() - 1);
        }
        renderCalendar();
    }
    
    if (e.key === 'ArrowRight') {
        if (calendarViewMode === 'week') {
            currentDate.setDate(currentDate.getDate() + 7);
        } else {
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        renderCalendar();
    }
    
    // Escape — закрыть модальные окна
    if (e.key === 'Escape') {
        closeNotificationModal();
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// Закрытие модального уведомления по клику вне него
document.getElementById('notificationModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'notificationModal') {
        closeNotificationModal();
    }
});

