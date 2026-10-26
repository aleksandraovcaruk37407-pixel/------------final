
    /* ==========================================================================
     AUTOATELIER PRO — СИСТЕМА УПРАВЛЕНИЯ АВТО-АТЕЛЬЕ
     ========================================================================== */

    // ========== TOAST УВЕДОМЛЕНИЯ (вместо alert) ==========
    function showToast(message, type = 'info') {
      // Удаляем старые тосты
      document.querySelectorAll('.toast-notification').forEach(t => t.remove());
      
      const colors = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#007bff'
      };
      
      const toast = document.createElement('div');
      toast.className = 'toast-notification';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(-100px);
        background: ${colors[type] || colors.info};
        color: #fff;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 14px;
        font-weight: 600;
        z-index: 100000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 90%;
        text-align: center;
        transition: transform 0.3s ease, opacity 0.3s ease;
        opacity: 0;
      `;
      toast.textContent = message;
      document.body.appendChild(toast);
      
      // Анимация появления
      requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
      });
      
      // Удаляем через 3 секунды
      setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-100px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
    
    // ========== iOS/Android FIX: Инициализация независимо от DOMContentLoaded ==========
    // defer скрипты выполняются ПОСЛЕ DOMContentLoaded, поэтому проверяем readyState
    function initAppIfReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAppIfReady);
        } else {
            // Ждём загрузки Firebase (firebase.js загружается первым)
            if (!window.db || !window.auth) {
                console.log('[App] Ожидание загрузки Firebase...');
                setTimeout(initAppIfReady, 100);
                return;
            }
            
            // DOM уже загружен и Firebase готов — выполняем инициализацию сразу
            console.log('initAppIfReady: DOM ready и Firebase подключён, инициализация...');
            loadData();
            currentDate = new Date();
            selectedDate = new Date();
            recalculateStockFromAllOrders();
            renderAll();

            // Загружаем список пользователей для админа
            if (window.currentUserData && window.currentUserData.role === 'admin') {
                if (typeof window.syncUsersToCloud === 'function') {
                    window.syncUsersToCloud().then((users) => {
                        if (users && Object.keys(users).length > 0) {
                            console.log('[App] Пользователи синхронизированы, загружаем список');
                        }
                        // После синхронизации загружаем список
                        if (typeof listAllHelpersInDB === 'function') {
                            setTimeout(() => listAllHelpersInDB(), 200);
                        }
                        if (typeof updateHelperFilter === 'function') {
                            setTimeout(() => updateHelperFilter(), 400);
                        }
                    });
                }
            }

            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.getElementById(btn.dataset.tab).classList.add('active');
                    btn.classList.add('active');
                    if (btn.dataset.tab === 'tab-calendar') renderCalendar();
                    if (btn.dataset.tab === 'tab-ref') renderRefs();
                    if (btn.dataset.tab === 'tab-purchase') renderPurchaseOrdersList();
                    if (btn.dataset.tab === 'helper-tasks') renderHelperTasks();
                    if (btn.dataset.tab === 'helper-report') renderHelperReport();
                    if (btn.dataset.tab === 'helper-attendance' || btn.dataset.tab === 'tab-helper-admin') renderAttendance();
                    if (btn.dataset.tab === 'tab-helper-admin') {
                        if (typeof updateHelperFilter === 'function') updateHelperFilter();
                        renderAdminHelperTasks();
                        renderNotices();
                        if (typeof listAllHelpersInDB === 'function') listAllHelpersInDB();
                    }
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

            // Мобильная навигация — кнопки в меню "Ещё"
            document.querySelectorAll('.bottom-nav-more-item[data-tab]').forEach(btn => {
                btn.addEventListener('click', () => {
                    var tabId = btn.getAttribute('data-tab');
                    if (!tabId) return;
                    
                    // Переключаем контент
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    var targetTab = document.getElementById(tabId);
                    if (targetTab) {
                        targetTab.classList.add('active');
                    }
                    
                    // Обновляем активные кнопки
                    document.querySelectorAll('.bottom-nav-item, .bottom-nav-more-item').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Закрываем меню
                    if (moreMenu) moreMenu.classList.remove('visible');
                    
                    // Обновляем данные вкладки
                    if (tabId === 'tab-calendar' && typeof renderCalendar === 'function') renderCalendar();
                    if (tabId === 'tab-ref' && typeof renderRefs === 'function') renderRefs();
                    if (tabId === 'tab-purchase' && typeof renderPurchaseOrdersList === 'function') renderPurchaseOrdersList();
                    
                    // Вибрация
                    if (navigator.vibrate) navigator.vibrate(10);
                });
            });

            document.getElementById('orderModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeOrderModal(); });
            document.getElementById('authModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });
            document.getElementById('addHelperModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddHelperModal(); });
            document.getElementById('penaltyModal').addEventListener('click', e => { if (e.target === e.currentTarget) closePenaltyModal(); });
            document.getElementById('bookingModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
            document.getElementById('extraModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeExtraModal(); });
            document.getElementById('serviceItemsModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeServiceItemsModal(); });
            document.getElementById('noteModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeNoteModal(); });
            document.getElementById('addColorModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddColorModal(); });
            document.getElementById('addPaintModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddPaintModal(); });
            document.getElementById('addFilmModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddFilmModal(); });
            document.getElementById('addExtraRefModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddExtraRefModal(); });
            document.getElementById('helperTaskModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeHelperTaskModal(); });
            document.getElementById('editTaskModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeEditTaskModal(); });
            document.getElementById('addCashModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddCashModal(); });
            document.getElementById('addRegularExpenseModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddRegularExpenseModal(); });
            document.getElementById('addRegularIncomeModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAddRegularIncomeModal(); });
            
            // Мобильная навигация — кнопку "Ещё" открывает только bindBottomNavClicks:
            // здесь был второй обработчик, и меню открывалось и сразу закрывалось
            var moreBtn = document.querySelector('.bottom-nav-more');
            var moreMenu = document.getElementById('bottomNavMoreMenu');
            // Закрываем меню "Ещё" при клике вне его
            document.addEventListener('click', function(e) {
                if (moreMenu && moreBtn && !moreMenu.contains(e.target) && !moreBtn.contains(e.target)) {
                    moreMenu.classList.remove('visible');
                }
            });
            
            // Input обработчики
            var orderDate = document.getElementById('orderDate');
            var orderDurationDays = document.getElementById('orderDurationDays');
            var orderClientPrice = document.getElementById('orderClientPrice');
            var orderTaskPay = document.getElementById('orderTaskPay');
            if (orderDate) orderDate.addEventListener('input', updateDeadline);
            if (orderDurationDays) orderDurationDays.addEventListener('input', updateDeadline);
            if (orderClientPrice) orderClientPrice.addEventListener('input', updateModalTotals);
            if (orderTaskPay) orderTaskPay.addEventListener('input', updateModalTotals);
            
            // Кассовые операции — превью
            var cashOpIncome = document.getElementById('cashOpIncome');
            var cashOpExpense = document.getElementById('cashOpExpense');
            if (cashOpIncome) cashOpIncome.addEventListener('input', updateCashOpPreview);
            if (cashOpExpense) cashOpExpense.addEventListener('input', updateCashOpPreview);
            
            populateSummarySelects();
            renderSummary();
            configureDefaultServiceMarkers();
            saveAll(true); // только локально: запуск приложения — не изменение данных
            
            console.log('✅ App initialized (defer mode)');
        }
    }
    
    // ========== МОДУЛЬ 1: XSS ЗАЩИТА И УТИЛИТЫ ==========
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Удобная обёртка: экранирует и вставляет в innerHTML
    function safeHTML(str) {
        return escapeHTML(str);
    }

    // Экранирование строки для вставки в HTML-атрибуты
    function escAttr(str) {
        return escapeHTML(str);
    }

    // ========== ГЛОБАЛЬНЫЕ ДАННЫЕ ==========
    let colors = [], paints = [], films = [], extraRef = [], rates = [], ordersData = [], cashOps = [], bookings = [], materialTypes = [], regularExpenses = [], regularIncomes = [], notes = [];
    // Финансы (js/finance.js): платежи месяца и настройки распределения — синхронизируются
    let payments = [], financeSettings = [];
    // Помощники: уведомления (to — email помощника или 'admin') и штрафы — синхронизируются
    let helperNotices = [], helperPenalties = [];
    // Посещаемость помощников и их график (js/attendance.js) — синхронизируются
    let attendance = [], helperSchedules = [];
    let budgetData = null;
    let currentFilter = 'all';

    // Данные для облачной синхронизации (переменные выше не видны через window)
    window.getSyncData = function() {
      return { colors, paints, films, extraRef, rates, ordersData, cashOps, bookings, materialTypes, regularExpenses, regularIncomes, notes, payments, financeSettings, helperNotices, helperPenalties, attendance, helperSchedules, stock: loadStock() };
    };
    let calendarViewMode = 'month';
    let currentServiceFilter = 'all';
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
    let currentHelperReportPeriod = 'all';
    let currentAdminHelperReportPeriod = 'all';
    let currentOrderDateFrom = '';
    let currentOrderDateTo = '';
    let currentHelperDateFrom = '';
    let currentHelperDateTo = '';

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
            distributionHistory: [],
            // Выплаты помощникам (текущие)
            helperPayments: {},
            // История всех выплат (плоский массив)
            paymentHistory: [],
            // Штрафы помощников
            helperPenalties: [],
            // Планирование дохода
            incomePlan: {
                personalPercent: 10, // % на личные расходы
                manualMode: false, // ручной режим
                manualPersonalAmount: 0, // ручная сумма на личные
                additionalGoals: [
                    { id: 'emergency', name: 'Подушка безопасности', target: 252000, saved: 0, icon: '🛡️', color: '#3498db' },
                    { id: 'vacation', name: 'Отпуск', target: 50000, saved: 0, icon: '✈️', color: '#e74c3c' },
                    { id: 'education', name: 'Обучение', target: 30000, saved: 0, icon: '📚', color: '#9b59b6' }
                ]
            }
        };
    }

    function loadData() {
    function parseJSON(key, fallback) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch (e) {
            console.error(`[ loadData ] Ошибка парсинга ${key}:`, e);
            return fallback;
        }
    }
    colors = parseJSON('colors_data', []);
    paints = parseJSON('paints_data', []);
    films = parseJSON('films_data', []);
    extraRef = parseJSON('extraRef_data', []);
    rates = parseJSON('rates_data', []);
    // Заказы, касса и календарь сохраняются (saveAll) в ordersData_data / cashOps_data / bookings_data,
    // а раньше читались из старых записей — и после перезапуска терялись. Старые записи — запасной вариант.
    const parseFirst = (keys, fallback) => {
        for (const key of keys) {
            if (localStorage.getItem(key) !== null) return parseJSON(key, fallback);
        }
        return fallback;
    };
    ordersData = parseFirst(['ordersData_data', 'orders_data'], []).filter(order => !isSampleOrder(order));
    cashOps = parseFirst(['cashOps_data', 'cash_data'], []);
    bookings = parseFirst(['bookings_data', 'calendar_bookings'], []);
    materialTypes = parseJSON('materialTypes_data', []);
    regularExpenses = parseJSON('regularExpenses_data', []);
    regularIncomes = parseJSON('regularIncomes_data', []);
    notes = parseJSON('notes_data', []);
    payments = parseJSON('payments_data', []);
    financeSettings = parseJSON('financeSettings_data', []);
    helperNotices = parseJSON('helperNotices_data', []);
    helperPenalties = parseJSON('helperPenalties_data', []);
    attendance = parseJSON('attendance_data', []);
    helperSchedules = parseJSON('helperSchedules_data', []);
    // Перенос старых финансовых записей: касса = реальные деньги (js/finance.js)
    finMigrate(false);

    // cleanCashOps() больше не вызываем при запуске: он удалял любые операции со словами
    // «Материалы», «Оплата заказа», «Бизнес» и т. п. в описании — в том числе внесённые вручную

    budgetData = parseJSON('budget_data', null) || getDefaultBudgetData();
    
    // Гарантия что все поля существуют (для старых данных)
    if (!budgetData.wallets) budgetData.wallets = getDefaultBudgetData().wallets;
    if (!budgetData.mandatoryPayments) budgetData.mandatoryPayments = getDefaultBudgetData().mandatoryPayments;
    if (!budgetData.debts) budgetData.debts = getDefaultBudgetData().debts;
    if (!budgetData.distributionHistory) budgetData.distributionHistory = [];
    if (!budgetData.helperPayments) budgetData.helperPayments = {};
    if (!budgetData.paymentHistory) budgetData.paymentHistory = [];
    migrateHelperLocalData();

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
        // ПОТОЛОЧНАЯ ТКАНЬ (СЕТКА)
        {category:'Сетка', code:'L1041', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'L1054', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'L1055', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'L1057', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'MA 12', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'MC 01', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'MC 02', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'R1061', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'R1064', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'R1065', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'R1066', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'R1067', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'R1069', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'R1070', name:'Потолочная ткань на поролоне', price:1400},
        {category:'Сетка', code:'R1075', name:'Потолочная ткань на поролоне', price:1400},
        // ПОТОЛОЧНАЯ ТКАНЬ (ВЕЛЮР)
        {category:'Велюр', code:'А1011', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1014', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1015', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1016', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1019', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1020', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1022', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1023', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1026', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1028', name:'Потолочная ткань на поролоне с трикотажем', price:1400},
        {category:'Велюр', code:'А1029', name:'Потолочная ткань на поролоне с трикотаже', price:1400}
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
    saveAll(true); // при запуске сохраняем только локально — это не изменение данных
}
    function saveAll(fromCloud) {
      // Касса всегда соответствует отметкам «Оплачено» (приход по каждому оплаченному заказу)
      finReconcile();
      // Безопасное сохранение с try-catch
      const dataToSave = {
        colors: colors,
        paints: paints,
        films: films,
        extraRef: extraRef,
        rates: rates,
        ordersData: ordersData,
        cashOps: cashOps,
        bookings: bookings,
        materialTypes: materialTypes,
        regularExpenses: regularExpenses,
        regularIncomes: regularIncomes,
        notes: notes,
        payments: payments,
        financeSettings: financeSettings,
        helperNotices: helperNotices,
        helperPenalties: helperPenalties,
        attendance: attendance,
        helperSchedules: helperSchedules,
        budgetData: budgetData
      };
      
      for (const key in dataToSave) {
        try {
          localStorage.setItem(key + '_data', JSON.stringify(dataToSave[key]));
        } catch (e) {
          if (e.name === 'QuotaExceededError') {
            console.warn('[Save] Хранилище переполнено, очищаем старые данные...');
            // Удаляем самые старые заказы (оставляем 50 последних)
            if (key === 'ordersData' && ordersData.length > 50) {
              ordersData = ordersData.slice(-50);
              localStorage.setItem('orders_data', JSON.stringify(ordersData));
            }
          }
        }
      }

      // Отправка в Firebase (данные, только что пришедшие из облака, обратно не отправляем)
      if (window.syncToCloud && !fromCloud) {
        window.markChanged(); // Помечаем что есть изменения
      }
    }
    
    // Debounced save — не сохраняем чаще чем раз в 1 секунду
    let _saveTimeout = null;
    window.debouncedSaveAll = function() {
      if (_saveTimeout) clearTimeout(_saveTimeout);
      _saveTimeout = setTimeout(() => {
        saveAll();
        _saveTimeout = null;
      }, 1000);
    };

// ========== ГЛОБАЛЬНЫЙ ФЛАГ ИЗМЕНЕНИЙ ==========
// localChangesPending = true означает, что локальные данные важнее облачных
window.localChangesPending = false;

    // ========== МОДУЛЬ 3: БЮДЖЕТ И ФИНАНСЫ ==========
    function saveBudgetData() {
        localStorage.setItem('budget_data', JSON.stringify(budgetData));
    }

    // Единый формат сумм: «117 105 ₽»; копейки показываем только у мелких цен (например, 2,5 ₽ за мл)
    function formatNumber(value) {
        const n = Number(value) || 0;
        return n.toLocaleString('ru-RU', { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 });
    }
    function formatMoney(value) {
        return formatNumber(value) + ' ₽';
    }

    // Себестоимость заказа по текущим ценам — та же полная формула, что при сохранении заказа
    // (ткань, краска, плёнка, расходники услуги, маркеры, доп. расходники)
    function getOrderCost(order) {
        const copy = JSON.parse(JSON.stringify(order));
        copy.services = copy.services || [];
        return recalcOrder(copy).materialCost || 0;
    }

    function populateBudgetOrderSelect() {
        const select = document.getElementById('budgetOrderSelect');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Выбери заказ --</option>';
        ordersData.forEach(order => {
            const opt = document.createElement('option');
            opt.value = order.orderNumber;
            opt.textContent = `№${order.orderNumber} — ${order.client || 'Без клиента'} — ${formatMoney(parseFloat(order.clientPrice || 0))}`;
            select.appendChild(opt);
        });
        if (currentValue) select.value = currentValue;
    }

    // ========== ОБЩИЙ РАСЧЁТ РАСПРЕДЕЛЕНИЯ (ЕДИНСТВЕННЫЙ ИСТОЧНИК) ==========
    function calculateDistribution(order) {
        const clientPrice = parseFloat(order.clientPrice) || 0;
        // ИСПРАВЛЕНО: используем getOrderCost(order) вместо order.materialCost для точности
        const orderCost = getOrderCost(order);
        const netProfit = Math.max(0, clientPrice - orderCost);

        if (netProfit <= 0) {
            return {
                clientPrice, orderCost, netProfit,
                tax: 0, personal: 0, business: 0, investments: 0, mandatory: 0,
                products: 0, savings: 0, error: 'net_profit_zero'
            };
        }

        const tax = netProfit * 0.04;
        const personal = netProfit * 0.10;
        const business = netProfit * 0.05;
        const investments = netProfit * 0.05;
        const mandatory = netProfit - tax - personal - business - investments;

        return {
            clientPrice, orderCost, netProfit,
            tax, personal, business, investments, mandatory,
            products: 0, savings: 0, error: null
        };
    }

    // ========== РАСПРЕДЕЛЕНИЕ ДЛЯ БЮДЖЕТНЫХ КОШЕЛЬКОВ (ручной вызов из панели) ==========
    function distributeFromOrder() {
        if (!budgetData) { alert('Данные бюджета не загружены!'); return; }

        const select = document.getElementById('budgetOrderSelect');
        const orderNumber = select.value;
        if (!orderNumber) { alert('Выбери заказ!'); return; }

        const order = ordersData.find(o => o.orderNumber == orderNumber);
        if (!order) { alert('Заказ не найден!'); return; }

        const dist = calculateDistribution(order);
        if (dist.error) {
            alert('Чистая прибыль с этого заказа 0 или отрицательная (расходы >= оплата). Распределить нечего.');
            return;
        }

        budgetData.wallets.tax.target += dist.tax;
        budgetData.wallets.personal.target += dist.personal;
        budgetData.wallets.business.target += dist.business;
        budgetData.wallets.investments.target += dist.investments;

        // Распределяем на обязательные платежи
        let remaining = dist.mandatory;
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
            clientPrice: dist.clientPrice,
            orderCost: dist.orderCost,
            netProfit: dist.netProfit,
            tax: dist.tax,
            personal: dist.personal,
            business: dist.business,
            investments: dist.investments,
            mandatory: dist.mandatory,
            extraDebt,
            distributions
        });

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
                <div class="budget-result-row"><span class="label">Оплата от клиента:</span><span class="value">${formatMoney(dist.clientPrice)}</span></div>
                <div class="budget-result-row"><span class="label">Расходы на заказ:</span><span class="value" style="color:#e74c3c;">-${formatMoney(dist.orderCost)}</span></div>
                <div class="budget-result-row"><span class="label">Помощник:</span><span class="value" style="color:#e74c3c;">-${formatMoney(dist.helperPay)}</span></div>
                <div class="budget-result-row highlight"><span class="label">Чистая прибыль:</span><span class="value" style="color:#27ae60;">${formatMoney(dist.netProfit)}</span></div>
                <div style="margin:10px 0 5px 0;border-top:1px dashed #ccc;padding-top:8px;">
                    <div class="budget-result-row tax"><span class="label">💰 Налог (4%):</span><span class="value">${formatMoney(dist.tax)}</span></div>
                    <div class="budget-result-row personal"><span class="label">👤 Личные (10%):</span><span class="value">${formatMoney(dist.personal)}</span></div>
                    <div class="budget-result-row" style="color:#e67e22;"><span class="label">🚀 Улучшение бизнеса (5%):</span><span class="value" style="color:#e67e22;">${formatMoney(dist.business)}</span></div>
                    <div class="budget-result-row" style="color:#9b59b6;"><span class="label">📈 Инвестиции/Активы (5%):</span><span class="value" style="color:#9b59b6;">${formatMoney(dist.investments)}</span></div>
                    <div class="budget-result-row mandatory"><span class="label">📌 Обязательные платежи:</span><span class="value">${formatMoney(dist.mandatory)}</span></div>
                </div>
                ${extraDebt > 0 ? `<div class="budget-result-row" style="background:#fff3cd;padding:6px;border-radius:4px;margin-top:6px;"><span class="label">⚡ Досрочное погашение долгов:</span><span class="value" style="color:#e67e22;">${formatMoney(extraDebt)}</span></div>` : ''}
                <div style="margin-top:8px;font-size:13px;color:#666;">
                    <b>Куда пошло:</b><br>
                    ${distributions.map(d => `${d.name}: +${formatMoney(d.amount)}`).join('<br>')}
                    ${extraDebt > 0 ? `<br>Досрочное погашение: +${formatMoney(extraDebt)}` : ''}
                </div>
            </div>
        `;
    }

    function payMandatoryPayment(idx) {
        if (!budgetData || !budgetData.mandatoryPayments) return;
        const mp = budgetData.mandatoryPayments[idx];
        if (!mp || mp.paid) return;
        if (!confirm(`Отметить "${mp.name}" как оплаченный?`)) return;
        mp.paid = true;
        saveBudgetData();
        renderBudget();
    }

    function resetMandatoryPayment(idx) {
        if (!budgetData || !budgetData.mandatoryPayments) return;
        const mp = budgetData.mandatoryPayments[idx];
        if (!mp) return;
        if (!confirm(`Сбросить статус оплаты "${mp.name}"?`)) return;
        mp.paid = false;
        saveBudgetData();
        renderBudget();
    }

    function editMandatoryPayment(idx, field, value) {
        if (!budgetData || !budgetData.mandatoryPayments) return;
        const mp = budgetData.mandatoryPayments[idx];
        if (!mp) return;
        
        if (field === 'name') {
            mp.name = value.trim();
        } else if (field === 'amount') {
            const amount = parseFloat(value) || 0;
            mp.amount = amount;
            mp.target = amount;
        } else if (field === 'day') {
            const day = parseInt(value) || 1;
            mp.day = Math.max(1, Math.min(31, day));
        }
        saveBudgetData();
        renderBudget();
    }

    function editMandatoryPaymentIcon(idx) {
        if (!budgetData || !budgetData.mandatoryPayments) return;
        const mp = budgetData.mandatoryPayments[idx];
        if (!mp) return;
        
        const icons = ['🏢','🏠','🏦','📱','👶','📞','📢','💰','🚀','📈','👤','💼','🛒','⚡','🔧','🎯','📦','🚗','✂️','🎨'];
        const currentIdx = icons.indexOf(mp.icon);
        const nextIdx = (currentIdx + 1) % icons.length;
        mp.icon = icons[nextIdx];
        saveBudgetData();
        renderBudget();
    }

    function deleteMandatoryPayment(idx) {
        if (!budgetData || !budgetData.mandatoryPayments) return;
        const mp = budgetData.mandatoryPayments[idx];
        if (!mp) return;
        if (!confirm(`Удалить "${mp.name}"?`)) return;
        budgetData.mandatoryPayments.splice(idx, 1);
        saveBudgetData();
        renderBudget();
    }

    // Старые блоки бюджета (кошельки, обязательные платежи, план) заменены js/finance.js
    function renderBudget() {}

    function renderMandatoryPayments() {
        const container = document.getElementById('mandatoryPaymentsProgress');
        if (!container || !budgetData || !budgetData.mandatoryPayments) return;

        const sorted = budgetData.mandatoryPayments.map((mp, idx) => ({...mp, idx}))
            .sort((a, b) => a.day - b.day);

        container.innerHTML = sorted.map(mp => {
            const percent = Math.min(100, (mp.saved / mp.target) * 100);
            const isPaid = mp.paid;
            return `
                <div class="budget-progress-item ${isPaid ? 'paid' : ''}" style="margin-bottom:12px;">
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
                        <span style="font-size:18px;">${mp.icon}</span>
                        <input type="text" value="${safeHTML(mp.name)}" onchange="editMandatoryPayment(${mp.idx},'name',this.value)" style="flex:1;min-width:120px;padding:6px 8px;border:1px solid #dee2e6;border-radius:4px;font-size:14px;" title="Название">
                        <input type="number" value="${mp.amount || mp.target}" onchange="editMandatoryPayment(${mp.idx},'amount',this.value)" style="width:100px;padding:6px 8px;border:1px solid #dee2e6;border-radius:4px;font-size:14px;" title="Сумма">
                        <input type="number" value="${mp.day}" min="1" max="31" onchange="editMandatoryPayment(${mp.idx},'day',this.value)" style="width:70px;padding:6px 8px;border:1px solid #dee2e6;border-radius:4px;font-size:14px;" title="День месяца">
                        <button onclick="editMandatoryPaymentIcon(${mp.idx})" style="padding:6px 8px;border:1px solid #dee2e6;border-radius:4px;background:#f8f9fa;cursor:pointer;font-size:14px;" title="Иконка">🎨</button>
                        <button onclick="deleteMandatoryPayment(${mp.idx})" style="padding:6px 8px;border:1px solid #dc3545;border-radius:4px;background:#fff5f5;color:#dc3545;cursor:pointer;font-size:12px;" title="Удалить">✕</button>
                    </div>
                    <div class="progress-bar-budget" style="margin-bottom:6px;">
                        <div class="progress-fill-budget" style="width:${percent}%">${percent.toFixed(0)}%</div>
                    </div>
                    <div class="budget-progress-meta">
                        <span>Накоплено: ${formatMoney(mp.saved)} из ${formatMoney(mp.target)}</span>
                        <span>День: ${mp.day}</span>
                    </div>
                    <div style="margin-top:6px;display:flex;gap:6px;">
                        ${!isPaid ? `<button class="btn-budget-pay" onclick="payMandatoryPayment(${mp.idx})">✅ Отметить оплаченным</button>` : ''}
                        ${isPaid ? `<button class="btn-budget-pay" style="background:#6c757d;" onclick="resetMandatoryPayment(${mp.idx})">↺ Сбросить</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderDebts() {
        const container = document.getElementById('debtsProgress');
        if (!container || !budgetData || !budgetData.debts) return;

        container.innerHTML = budgetData.debts.map(debt => {
            const remaining = debt.total - debt.paid;
            const percent = Math.min(100, (debt.paid / debt.total) * 100);
            const monthsLeft = Math.ceil(remaining / debt.monthly);

            return `
                <div class="budget-progress-item">
                    <div class="budget-progress-header">
                        <span class="name">${debt.icon} ${debt.name}</span>
                        <span class="amount">${formatMoney(remaining)} осталось</span>
                    </div>
                    <div class="progress-bar-budget">
                        <div class="progress-fill-budget" style="width:${percent}%">${percent.toFixed(1)}%</div>
                    </div>
                    <div class="budget-progress-meta">
                        <span>Оплачено: ${formatMoney(debt.paid)} из ${formatMoney(debt.total)}</span>
                        <span>~${monthsLeft} мес. осталось</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderWallets() {
        const container = document.getElementById('walletsOverview');
        if (!container || !budgetData || !budgetData.wallets) return;

        container.innerHTML = Object.entries(budgetData.wallets).map(([key, wallet]) => `
            <div class="wallet-item">
                <span class="wallet-name" style="color:${wallet.color}">${wallet.icon || '💰'} ${wallet.name}</span>
                <span class="wallet-amount">${formatMoney(wallet.target)}</span>
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
                <div class="dist-history-row"><span>Чистая прибыль:</span><span style="color:#27ae60;font-weight:600;">${formatMoney(dist.netProfit)}</span></div>
                <div class="dist-history-row"><span>Налог:</span><span style="color:#ffc107;">${formatMoney(dist.tax)}</span></div>
                <div class="dist-history-row"><span>Личные:</span><span style="color:#17a2b8;">${formatMoney(dist.personal)}</span></div>
                <div class="dist-history-row"><span>Улучшение бизнеса:</span><span style="color:#e67e22;">${formatMoney(dist.business)}</span></div>
                <div class="dist-history-row"><span>Инвестиции:</span><span style="color:#9b59b6;">${formatMoney(dist.investments)}</span></div>
                <div class="dist-history-row"><span>Обязательные:</span><span style="color:#e67e22;">${formatMoney(dist.mandatory)}</span></div>
                ${dist.extraDebt > 0 ? `<div class="dist-history-row"><span>Досрочное погашение:</span><span style="color:#e67e22;font-weight:600;">+${formatMoney(dist.extraDebt)}</span></div>` : ''}
            </div>
        `).join('');
    }

    // ========== ЧИСТАЯ ЗАРПЛАТА АДМИНИСТРАТОРА ==========
    function calculateAdminSalary(startDate, endDate) {
        // Общий доход
        let totalIncome = 0;
        ordersData.forEach(order => {
            if (order.date >= startDate && order.date <= endDate) {
                totalIncome += parseFloat(order.clientPrice) || 0;
            }
        });
        
        // Расходы
        let totalMaterialCost = 0;
        let totalHelperPay = 0;
        ordersData.forEach(order => {
            if (order.date >= startDate && order.date <= endDate) {
                totalMaterialCost += getOrderCost(order);
                totalHelperPay += parseFloat(order.helperPay) || 0;
            }
        });
        
        const grossProfit = totalIncome - totalMaterialCost - totalHelperPay;
        
        // Распределение по бюджету
        const tax = grossProfit * 0.04;
        const personal = grossProfit * ((budgetData.incomePlan?.personalPercent || 10) / 100);
        const business = grossProfit * 0.05;
        const investments = grossProfit * 0.05;
        
        // Чистая зарплата администратора (личные расходы)
        const netSalary = personal;
        
        return {
            totalIncome,
            totalMaterialCost,
            totalHelperPay,
            grossProfit,
            tax,
            personal,
            business,
            investments,
            netSalary
        };
    }

    // ========== ПЛАНИРОВАНИЕ ДОХОДА ==========
    function calculateIncomePlan(startDate, endDate) {
        if (!budgetData || !budgetData.mandatoryPayments) return null;
        
        // Считаем обязательные платежи
        const mandatoryTotal = budgetData.mandatoryPayments.reduce((sum, mp) => sum + (mp.amount || 0), 0);
        
        // Процент на личные
        const personalPercent = (budgetData.incomePlan?.personalPercent || 10) / 100;
        
        // Коэффициент (1 - все проценты)
        const rateSum = 0.04 + personalPercent + 0.05 + 0.05; // налог + личные + бизнес + инвестиции
        const coefficient = 1 - rateSum;
        
        // Минимальный доход для покрытия всех расходов
        const minIncome = coefficient > 0 ? mandatoryTotal / coefficient : mandatoryTotal;
        
        // Рассчитываем фактический доход за период
        let actualIncome = 0;
        ordersData.forEach(order => {
            if (order.date >= startDate && order.date <= endDate) {
                actualIncome += parseFloat(order.clientPrice) || 0;
            }
        });
        
        // Считаем дни в периоде
        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysInPeriod = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        
        // ИСПРАВЛЕНО: проверка на будущие даты
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const startDay = new Date(startDate);
        startDay.setHours(0, 0, 0, 0);
        
        let daysPassed;
        if (now < startDay) {
            // Пользователь выбрал будущий период — дней прошло 0
            daysPassed = 0;
        } else {
            const diffMs = now - startDay;
            daysPassed = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        }
        
        // Прогноз на конец периода
        let dailyRate = 0;
        let projectedIncome = 0;
        if (daysPassed > 0) {
            dailyRate = actualIncome / daysPassed;
            projectedIncome = dailyRate * daysInPeriod;
        }
        
        // Распределение минимального дохода
        const taxAmount = minIncome * 0.04;
        const personalAmount = minIncome * personalPercent;
        const businessAmount = minIncome * 0.05;
        const investmentAmount = minIncome * 0.05;
        
        // Прогресс
        const progressPercent = minIncome > 0 ? Math.min(100, (actualIncome / minIncome) * 100) : 0;
        
        // Дополнительные цели
        const goalsProgress = (budgetData.incomePlan?.additionalGoals || []).map(goal => ({
            ...goal,
            percent: Math.min(100, (goal.saved / goal.target) * 100)
        }));
        
        // ИСПРАВЛЕНО: считаем расходы через getOrderCost() вместо order.materialCost
        let totalMaterialCost = 0;
        let totalHelperPay = 0;
        ordersData.forEach(order => {
            if (order.date >= startDate && order.date <= endDate) {
                totalMaterialCost += getOrderCost(order);
                totalHelperPay += parseFloat(order.helperPay) || 0;
            }
        });
        
        const grossProfit = actualIncome - totalMaterialCost - totalHelperPay;
        
        return {
            mandatoryTotal,
            minIncome,
            actualIncome,
            projectedIncome,
            daysInPeriod,
            daysPassed,
            taxAmount,
            personalAmount,
            businessAmount,
            investmentAmount,
            progressPercent,
            goalsProgress,
            personalPercent: budgetData.incomePlan?.personalPercent || 10,
            totalMaterialCost,
            totalHelperPay,
            grossProfit
        };
    }

    function renderIncomePlan(startDate, endDate) {
        const incomePlanContainer = document.getElementById('incomePlanContainer');
        const goalsContainer = document.getElementById('goalsContainer');
        if (!incomePlanContainer) return;
        
        const plan = calculateIncomePlan(startDate, endDate);
        
        incomePlanContainer.innerHTML = `
            <!-- Сводка плана -->
            <div class="plan-summary" style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:15px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;">
                    <div>
                        <div style="font-size:12px;color:#666;margin-bottom:5px;">💰 Требуемый доход</div>
                        <div style="font-size:20px;font-weight:700;color:#1a3c5e;">${formatMoney(plan.minIncome)}</div>
                        <div style="font-size:11px;color:#888;">в месяц</div>
                    </div>
                    <div>
                        <div style="font-size:12px;color:#666;margin-bottom:5px;">📈 Фактический доход</div>
                        <div style="font-size:20px;font-weight:700;color:#27ae60;">${formatMoney(plan.actualIncome)}</div>
                        <div style="font-size:11px;color:#888;">за период</div>
                    </div>
                    <div>
                        <div style="font-size:12px;color:#666;margin-bottom:5px;">🔮 Прогноз</div>
                        <div style="font-size:20px;font-weight:700;color:#3498db;">${formatMoney(Math.round(plan.projectedIncome))}</div>
                        <div style="font-size:11px;color:#888;">на конец периода</div>
                    </div>
                </div>
                
                <!-- Прогресс -->
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                        <span style="font-size:13px;color:#666;">✅ План выполнен</span>
                        <span style="font-size:14px;font-weight:700;color:${plan.progressPercent >= 100 ? '#27ae60' : '#e67e22'};">${plan.progressPercent.toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar-budget">
                        <div class="progress-fill-budget" style="width:${plan.progressPercent}%;background:${plan.progressPercent >= 100 ? 'linear-gradient(90deg,#27ae60,#2ecc71)' : 'linear-gradient(90deg,#e67e22,#f39c12)'};">
                            ${plan.progressPercent.toFixed(0)}%
                        </div>
                    </div>
                    ${plan.progressPercent < 100 ? `<div style="margin-top:8px;font-size:13px;color:#e74c3c;">⚠️ Не хватает ${formatMoney(Math.round(plan.minIncome - plan.actualIncome))} для выполнения плана</div>` : '<div style="margin-top:8px;font-size:13px;color:#27ae60;">🎉 План выполнен! Можно досрочно гасить долги.</div>'}
                </div>
            </div>
            
            <!-- Распределение дохода -->
            <div class="plan-breakdown" style="background:#fff;padding:15px;border-radius:8px;margin-bottom:15px;border:1px solid #dee2e6;">
                <h4 style="margin:0 0 10px 0;">📊 Распределение при доходе ${formatMoney(Math.round(plan.minIncome))}</h4>
                <div class="budget-result-row"><span class="label">📌 Обязательные платежи:</span><span class="value" style="color:#e74c3c;">${formatMoney(plan.mandatoryTotal)} (76%)</span></div>
                <div class="budget-result-row tax"><span class="label">💰 Налог (4%):</span><span class="value">${formatMoney(Math.round(plan.taxAmount))}</span></div>
                <div class="budget-result-row personal"><span class="label">👤 Личные (${plan.personalPercent}%):</span><span class="value">${formatMoney(Math.round(plan.personalAmount))}</span></div>
                <div class="budget-result-row" style="color:#e67e22;"><span class="label">🚀 Бизнес (5%):</span><span class="value">${formatMoney(Math.round(plan.businessAmount))}</span></div>
                <div class="budget-result-row" style="color:#9b59b6;"><span class="label">📈 Инвестиции (5%):</span><span class="value">${formatMoney(Math.round(plan.investmentAmount))}</span></div>
            </div>
            
            <!-- Чистая зарплата администратора -->
            <div style="background:#d4edda;padding:20px;border-radius:8px;margin-top:20px;border-left:4px solid #28a745;">
                <h4 style="margin:0 0 15px 0;">💼 Чистая зарплата администратора</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;">
                    <div style="background:#fff;padding:15px;border-radius:6px;text-align:center;">
                        <div style="font-size:12px;color:#666;margin-bottom:5px;">💰 Общий доход</div>
                        <div style="font-size:20px;font-weight:700;color:#1a3c5e;">${formatMoney(plan.actualIncome)}</div>
                    </div>
                    <div style="background:#fff;padding:15px;border-radius:6px;text-align:center;">
                        <div style="font-size:12px;color:#666;margin-bottom:5px;">📦 Расходы</div>
                        <div style="font-size:20px;font-weight:700;color:#e74c3c;">-${formatMoney((plan.totalMaterialCost + plan.totalHelperPay))}</div>
                    </div>
                    <div style="background:#fff;padding:15px;border-radius:6px;text-align:center;">
                        <div style="font-size:12px;color:#666;margin-bottom:5px;">✨ Валовая прибыль</div>
                        <div style="font-size:20px;font-weight:700;color:#27ae60;">${formatMoney(plan.grossProfit)}</div>
                    </div>
                    <div style="background:#e3f2fd;padding:15px;border-radius:6px;text-align:center;border:2px solid #2196f3;">
                        <div style="font-size:12px;color:#666;margin-bottom:5px;">👤 Личные расходы</div>
                        <div style="font-size:20px;font-weight:700;color:#2196f3;">${formatMoney(plan.personalAmount)}</div>
                        <div style="font-size:11px;color:#888;margin-top:4px;">(${plan.personalPercent}% от дохода)</div>
                    </div>
                </div>
                <div style="margin-top:15px;padding-top:15px;border-top:1px solid #dee2e6;font-size:13px;color:#666;">
                    💡 <b>Чистая зарплата администратора</b> = Доход - Расходы - Налог - Личные - Бизнес - Инвестиции<br>
                    💡 Деньги на личные расходы распределяются автоматически при оплате заказов
                </div>
            </div>
        `;
        
        // Рендерим дополнительные цели в goalsContainer
        if (goalsContainer && plan.goalsProgress && plan.goalsProgress.length > 0) {
            goalsContainer.innerHTML = plan.goalsProgress.map((goal, idx) => `
                <div class="budget-progress-item" style="margin-bottom:10px;">
                    <div class="budget-progress-header">
                        <span class="name">${goal.icon} ${goal.name}</span>
                        <span class="amount">${goal.saved.toLocaleString()} / ${formatMoney(goal.target)}</span>
                    </div>
                    <div class="progress-bar-budget">
                        <div class="progress-fill-budget" style="width:${goal.percent}%;background:${goal.color};">${goal.percent.toFixed(0)}%</div>
                    </div>
                    <div style="margin-top:8px;display:flex;gap:6px;">
                        <button class="btn-budget-pay" onclick="addGoalSaved(${idx})">➕ Добавить накопление</button>
                    </div>
                </div>
            `).join('');
        }
    }

    function updatePersonalPercent(value) {
        budgetData.incomePlan = budgetData.incomePlan || {};
        budgetData.incomePlan.personalPercent = parseInt(value) || 10;
        saveBudgetData();
    }

    function savePersonalPercent() {
        renderAll();
        alert('✅ Процент на личные расходы сохранён!');
    }

    function addGoalSaved(goalIdx) {
        const goals = budgetData.incomePlan?.additionalGoals || [];
        const goal = goals[goalIdx];
        if (!goal) return;
        const amount = prompt(`Внеси накопление на "${goal.name}" (текущий остаток: ${formatMoney(goal.saved)}):`, '0');
        if (!amount || isNaN(amount)) return;
        goal.saved += parseFloat(amount) || 0;
        saveBudgetData();
        renderAll();
    }


    // ========== МОДУЛЬ 4: АВТОРИЗАЦИЯ И ПОЛЬЗОВАТЕЛИ ==========
    // Роль определяется автоматически из Firebase при входе

    // ========== МОДУЛЬ 5: СИСТЕМА ПОМОЩНИКОВ (задачи, штрафы, выплаты) ==========
    function renderHelperTasks() {
        const container = document.getElementById('helperTasksContainer');
        if (!container || !window.currentUserData) return;
        
        const helperEmail = window.currentUserData.email;
        
        // Собираем все задачи из всех заказов
        let allTasks = [];
        ordersData.forEach(order => {
            (order.services || []).forEach(service => {
                (service.tasks || []).forEach(task => {
                    if (task.assignedTo === helperEmail) {
                        allTasks.push({
                            ...task,
                            orderNumber: order.orderNumber,
                            client: order.client,
                            serviceName: service.serviceName,
                            orderDate: order.date
                        });
                    }
                });
            });
        });
        
        // Сортируем: сначала просроченные, затем по сроку
        allTasks.sort((a, b) => {
            if (a.status === 'overdue' && b.status !== 'overdue') return -1;
            if (a.status !== 'overdue' && b.status === 'overdue') return 1;
            return new Date(a.deadline) - new Date(b.deadline);
        });
        
        if (allTasks.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">У вас пока нет задач. Администратор назначит задачи в заказах.</div>';
            return;
        }
        
        container.innerHTML = allTasks.map((task, idx) => {
            const isOverdue = task.status === 'overdue';
            const isCompleted = task.status === 'completed';
            const isReview = task.status === 'review';
            const statusText = isCompleted ? '✅ Выполнена' : isReview ? '🕓 На проверке' : (isOverdue ? '❌ Просрочена' : '⏳ В процессе');
            const statusColor = isCompleted ? '#27ae60' : isReview ? '#3498db' : (isOverdue ? '#e74c3c' : '#f39c12');
            
            return `
                <div class="helper-task-card" style="background:#fff;padding:15px;border-radius:8px;margin-bottom:10px;border-left:4px solid ${isCompleted ? '#27ae60' : (isOverdue ? '#e74c3c' : '#f39c12')};box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div>
                            <span style="font-weight:700;font-size:16px;">Заказ №${safeHTML(task.orderNumber)}</span>
                            <span style="color:#666;margin-left:10px;">(${safeHTML(task.client)})</span>
                        </div>
                        <span style="font-weight:600;color:${statusColor};">${statusText}</span>
                    </div>
                    <div style="font-size:14px;margin-bottom:6px;"><b>Услуга:</b> ${safeHTML(task.serviceName)}</div>
                    <div style="font-size:14px;margin-bottom:6px;"><b>Задача:</b> ${safeHTML(task.description)}</div>
                    <div style="display:flex;gap:15px;font-size:13px;color:#666;margin-bottom:8px;">
                        <span>📅 Срок: <b style="color:${isOverdue ? '#e74c3c' : '#333'};">${formatTaskDeadline(task.deadline)}</b></span>
                        <span>💰 Оплата: <b style="color:#27ae60;">${task.helperPay} ₽</b></span>
                        ${task.penalty ? `<span>⚠️ Штраф: <b style="color:#e74c3c;">${task.penalty} ₽</b></span>` : ''}
                    </div>
                    ${isReview ? `<div style="font-size:13px;color:#3498db;">Ждёт подтверждения администратора — оплата начислится после проверки</div>` : ''}
                    ${!isCompleted && !isReview ? `
                        <div style="display:flex;gap:8px;">
                            <button class="btn-add" onclick="completeTask('${safeHTML(task.orderNumber)}', '${safeHTML(task.id)}')" style="padding:6px 12px;font-size:12px;">✅ Выполнил — на проверку</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // ========== ФУНКЦИЯ ОТЧЁТА ПОМОЩНИКА ==========
    function renderHelperReport() {
        const container = document.getElementById('helperReportContainer');
        if (!container || !window.currentUserData) return;
        
        const helperEmail = window.currentUserData.email;

        // Фильтруем заказы по периоду
        const filteredOrders = getTasksForPeriod(ordersData, currentHelperReportPeriod);
        
        // Название периода
        const periodNames = { day: 'За сегодня', week: 'За неделю', month: 'За месяц', year: 'За год', all: 'За всё время' };
        
        let totalEarned = 0;
        let totalLost = 0;
        let totalPenalties = 0;
        let completedTasks = 0;
        let overdueTasks = 0;
        
        filteredOrders.forEach(order => {
            (order.services || []).forEach(service => {
                (service.tasks || []).forEach(task => {
                    if (task.assignedTo === helperEmail) {
                        if (task.status === 'completed') {
                            totalEarned += parseFloat(task.helperPay) || 0;
                            completedTasks++;
                        } else if (task.status === 'overdue') {
                            totalLost += parseFloat(task.helperPay) || 0;
                            totalPenalties += parseFloat(task.penalty) || 0;
                            overdueTasks++;
                        }
                    }
                });
            });
        });
        
        // Штрафы, выписанные админом отдельно (не за просроченную задачу)
        totalPenalties += getPenaltiesForPeriod(helperPenalties, currentHelperReportPeriod)
            .filter(p => p.helperEmail === helperEmail)
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        const netEarned = totalEarned - totalPenalties;

        // Выплачено и долг — за всё время, независимо от периода (js/finance.js)
        const accrual = finHelperAccrual(helperEmail);
        const totalPaid = accrual.paid;
        const totalUnpaid = Math.max(0, accrual.owed);
        
        container.innerHTML = `
            <div style="background:#e3f2fd;padding:15px;border-radius:8px;margin-bottom:15px;border-left:4px solid #2196f3;">
                <h4 style="margin:0 0 5px 0;">📊 ${periodNames[currentHelperReportPeriod]}</h4>
                <div style="font-size:13px;color:#666;">Период отчёта: ${periodNames[currentHelperReportPeriod]}</div>
            </div>
            <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:15px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:15px;">
                    <div style="background:#fff;padding:15px;border-radius:6px;text-align:center;">
                        <div style="font-size:13px;color:#666;margin-bottom:5px;">✅ Выполнено</div>
                        <div style="font-size:24px;font-weight:700;color:#27ae60;">${completedTasks}</div>
                    </div>
                    <div style="background:#fff;padding:15px;border-radius:6px;text-align:center;">
                        <div style="font-size:13px;color:#666;margin-bottom:5px;">❌ Просрочено</div>
                        <div style="font-size:24px;font-weight:700;color:#e74c3c;">${overdueTasks}</div>
                        <div style="font-size:12px;color:#e74c3c;margin-top:4px;">⚠️ Штрафы: -${formatMoney(totalPenalties)}</div>
                    </div>
                    <div style="background:#fff;padding:15px;border-radius:6px;text-align:center;">
                        <div style="font-size:13px;color:#666;margin-bottom:5px;">💰 Заработано</div>
                        <div style="font-size:24px;font-weight:700;color:#27ae60;">${formatMoney(totalEarned)}</div>
                    </div>
                    <div style="background:#d4edda;padding:15px;border-radius:6px;text-align:center;border:2px solid #27ae60;">
                        <div style="font-size:13px;color:#666;margin-bottom:5px;">✨ Итого за период</div>
                        <div style="font-size:28px;font-weight:700;color:#27ae60;">${formatMoney(netEarned)}</div>
                    </div>
                    <div style="background:#f8d7da;padding:15px;border-radius:6px;text-align:center;border:2px solid #e74c3c;">
                        <div style="font-size:13px;color:#666;margin-bottom:5px;">😢 Не заработано</div>
                        <div style="font-size:24px;font-weight:700;color:#e74c3c;">-${formatMoney(totalLost)}</div>
                    </div>
                </div>
            </div>
            
            <div style="background:#e3f2fd;padding:20px;border-radius:8px;margin-bottom:15px;border-left:4px solid #2196f3;">
                <h4 style="margin:0 0 15px 0;">💳 Статус выплат</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;">
                    <div style="background:#fff;padding:15px;border-radius:6px;text-align:center;">
                        <div style="font-size:13px;color:#666;margin-bottom:5px;">✅ Выплачено</div>
                        <div style="font-size:24px;font-weight:700;color:#27ae60;">${formatMoney(totalPaid)}</div>
                    </div>
                    <div style="background:#fff3cd;padding:15px;border-radius:6px;text-align:center;border:2px solid #ffc107;">
                        <div style="font-size:13px;color:#666;margin-bottom:5px;">⏳ Не выплачено</div>
                        <div style="font-size:24px;font-weight:700;color:#e67e22;">${formatMoney(totalUnpaid)}</div>
                    </div>
                </div>
            </div>
            
            <div style="background:#fff3cd;padding:15px;border-radius:8px;border-left:4px solid #ffc107;">
                <h4 style="margin:0 0 10px 0;">💡 Как начисляется зарплата:</h4>
                <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">
                    <li>За каждую выполненную задачу начисляется <b>указанная сумма</b> ₽</li>
                    <li>За просроченную задачу вы <b>не получаете оплату</b> и платите <b>штраф</b></li>
                    <li>Чистая зарплата = Выполненные задачи - Штрафы</li>
                    <li>Выплаты отмечаются администратором во вкладке "👥 Задачи помощников"</li>
                </ul>
            </div>
        `;
        
        // Отрисовать штрафы
        renderHelperPenalties();
    }
    window.renderHelperTasks = renderHelperTasks;
    window.renderHelperReport = renderHelperReport;
    
    // ========== МОДУЛЬ 5.1: УПРАВЛЕНИЕ ПОМОЩНИКАМИ (ТОЛЬКО АДМИН) ==========
    window.openAddHelperModal = function() {
        const modal = document.getElementById('addHelperModal');
        if (!modal) return;
        
        // Сбросить форму
        document.getElementById('helperName').value = '';
        document.getElementById('helperEmail').value = '';
        document.getElementById('helperPassword').value = '';
        document.getElementById('helperCreatedResult').style.display = 'none';
        document.getElementById('helperCredentials').innerHTML = '';
        
        modal.classList.add('active');
        // НЕ блокируем скролл body на мобильных
        if (window.innerWidth > 768) {
            document.body.classList.add('modal-open');
        }
    };

    window.closeAddHelperModal = function() {
        const modal = document.getElementById('addHelperModal');
        if (modal) {
            modal.classList.remove('active');
            // Разблокировать скролл body (только на десктопе)
            if (window.innerWidth > 768) {
                document.body.classList.remove('modal-open');
            }
        }
    };

    window.toggleHelperPassword = function() {
        const passwordInput = document.getElementById('helperPassword');
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
        } else {
            passwordInput.type = 'password';
        }
    };

    window.copyHelperCredentials = function() {
        const name = document.getElementById('helperName').value;
        const email = document.getElementById('helperEmail').value;
        const password = document.getElementById('helperPassword').value;
        
        const text = `Данные для входа в систему учёта авто-ателье:\n\nEmail: ${email}\nПароль: ${password}\n\nНе сообщайте эти данные другим людям!`;
        
        navigator.clipboard.writeText(text).then(() => {
            alert('✅ Данные скопированы в буфер обмена!\n\nОтправьте их помощнику удобным способом (мессенджер, SMS и т.д.)');
        }).catch(() => {
            // Fallback для старых браузеров
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('✅ Данные скопированы в буфер обмена!');
        });
    };

    window.createHelper = async function() {
        const name = document.getElementById('helperName').value.trim();
        const email = document.getElementById('helperEmail').value.trim();
        const password = document.getElementById('helperPassword').value;
        
        // Валидация
        if (!name || !email || !password) {
            alert('❌ Заполните все поля!');
            return;
        }
        
        if (password.length < 6) {
            alert('❌ Пароль должен быть минимум 6 символов!');
            return;
        }
        
        // Проверка формата email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('❌ Неверный формат email!');
            return;
        }
        
        const saveBtn = document.querySelector('#addHelperModal .btn-add');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '⏳ Создание...';
        saveBtn.disabled = true;
        
        try {
            // Регистрация пользователя через Firebase Auth (админ остаётся в своём аккаунте)
            const uid = await window.createHelperAuthUser(email, password, name);
            const user = { uid: uid };

            // Сохранение данных пользователя в Realtime Database
            await window.set(window.fbRef(window.db, 'users/' + user.uid), {
                email: email,
                displayName: name,
                role: 'helper',
                createdAt: new Date().toISOString(),
                createdBy: window.currentUserData ? window.currentUserData.email : 'system'
            });
            
            // Показать результат
            document.getElementById('helperCreatedResult').style.display = 'block';
            document.getElementById('helperCredentials').innerHTML = `
                <div><b>👤 Имя:</b> ${name}</div>
                <div><b>📧 Email:</b> ${email}</div>
                <div><b>🔒 Пароль:</b> <span style="color:#dc3545;font-weight:700;">${password}</span></div>
                <div><b>🆔 UID:</b> ${user.uid}</div>
            `;
            
            // Обновить список помощников в фильтре
            updateHelperFilter();
            
        } catch (error) {
            console.error('Ошибка создания помощника:', error);
            let msg = '❌ Ошибка создания помощника';
            
            if (error.code === 'auth/email-already-in-use') {
                msg = '❌ Этот email уже зарегистрирован в системе!';
            } else if (error.code === 'auth/weak-password') {
                msg = '❌ Пароль должен быть минимум 6 символов!';
            } else if (error.code === 'auth/invalid-email') {
                msg = '❌ Неверный формат email!';
            } else if (error.code === 'auth/network-request-failed') {
                msg = '❌ Ошибка сети. Проверьте подключение к интернету.';
            } else if (error.code === 'auth/too-many-requests') {
                msg = '❌ Слишком много попыток. Попробуйте позже.';
            }
            
            alert(msg);
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    };

    // Список всех помощников в базе
    window.listAllHelpersInDB = async function() {
        const resultDiv = document.getElementById('helperDbCheckResult');
        if (!resultDiv) return;
        
        if (!window.db || !window.get || !window.child || !window.fbRef) {
            resultDiv.innerHTML = '<div style="background:#f8d7da;padding:10px;border-radius:6px;font-size:13px;">❌ Firebase не подключён</div>';
            return;
        }
        
        resultDiv.innerHTML = '<div style="background:#e3f2fd;padding:10px;border-radius:6px;font-size:13px;">⏳ Загрузка...</div>';
        
        try {
            const ref = window.fbRef(window.db);
            
            // Сначала пробуем atelier_data/users, если пусто — читаем из /users
            let snapshot = await window.get(window.child(ref, 'atelier_data/users'));
            if (!snapshot.exists()) {
                snapshot = await window.get(window.child(ref, 'users'));
            }
            
            
            if (!snapshot.exists()) {
                resultDiv.innerHTML = '<div style="background:#f8d7da;padding:10px;border-radius:6px;font-size:13px;margin-top:8px;">❌ База пользователей пуста!</div>';
                return;
            }
            
            const users = snapshot.val();
            const helpers = [];
            const admins = [];
            
            for (const uid in users) {
                const user = users[uid];
                if (user.role === 'helper') {
                    helpers.push(user);
                } else if (user.role === 'admin') {
                    admins.push(user);
                }
            }
            
            let html = '<div style="background:#d4edda;padding:10px;border-radius:6px;font-size:13px;margin-top:8px;">';
            html += '<b>👥 Все помощники (' + helpers.length + '):</b><br><br>';
            
            if (helpers.length === 0) {
                html += 'Нет зарегистрированных помощников<br><br>';
            } else {
                helpers.forEach((h, i) => {
                    html += (i + 1) + '. <b>' + (h.displayName || 'Без имени') + '</b><br>';
                    html += '   📧 ' + h.email + '<br>';
                    html += '   🆔 ' + Object.keys(users).find(uid => users[uid].email === h.email) + '<br>';
                    html += '   📅 ' + (h.createdAt || '—') + '<br><br>';
                });
            }
            
            html += '<b>👨‍💼 Администраторы (' + admins.length + '):</b><br><br>';
            admins.forEach((a, i) => {
                html += (i + 1) + '. <b>' + (a.displayName || 'Без имени') + '</b><br>';
                html += '   📧 ' + a.email + '<br><br>';
            });
            
            html += '</div>';
            resultDiv.innerHTML = html;
        } catch (error) {
            console.error('Ошибка загрузки списка:', error);
            resultDiv.innerHTML = '<div style="background:#f8d7da;padding:10px;border-radius:6px;font-size:13px;margin-top:8px;">❌ Ошибка: ' + error.message + '</div>';
        }
    };

    // Задача по её id во всех заказах (номера заказов на разных устройствах раньше совпадали)
    function findTaskById(taskId) {
        for (const order of ordersData) {
            for (const service of (order.services || [])) {
                const task = (service.tasks || []).find(t => String(t.id) === String(taskId));
                if (task) return { order, task };
            }
        }
        return null;
    }

    // Помощник отметил задачу выполненной — она уходит админу на проверку,
    // оплата начисляется только после подтверждения (adminChangeTaskStatus → completed)
    function completeTask(orderNumber, taskId) {
        const found = findTaskById(taskId);
        if (!found) return;
        const { order, task } = found;
        if (task.status === 'completed') return;
        task.status = 'review';
        task.submittedAt = new Date().toISOString();
        const taskDescription = task.description;
        orderNumber = order.orderNumber;
        
        // Уведомляем админа о завершении задачи
        if (window.currentUserData) {
            notifyAdminAboutTaskCompletion(orderNumber, window.currentUserData.email, taskDescription);
        }
        
        saveAll();
        renderHelperTasks();
        renderHelperReport();
    }

    // ========== МОДУЛЬ 5.2: УПРАВЛЕНИЕ ЗАДАЧАМИ (ADMIN) ==========
    let currentEditingTask = null;

    // Обновление списка помощников из Firebase (все зарегистрированные)
    async function updateHelperFilter() {
        const filterSelect = document.getElementById('adminHelperFilter');
        if (!filterSelect) return;
        
        // Сначала показываем помощников из существующих задач (синхронно)
        populateAdminHelperFilterFallback();
        
        // ИСПРАВЛЕНО: Ждём готовности Firebase
        if (!window.firebaseReady) {
            // Retry через 500мс
            setTimeout(updateHelperFilter, 500);
            return;
        }
        
        if (!window.db || typeof window.get !== 'function' || typeof window.child !== 'function') {
            console.warn('Firebase функции недоступны для updateHelperFilter');
            // Retry через 1с
            setTimeout(updateHelperFilter, 1000);
            return;
        }
        
        try {
            const ref = window.fbRef(window.db);
            
            // Сначала пробуем atelier_data/users, если пусто — читаем из /users
            let snapshot = await window.get(window.child(ref, 'atelier_data/users'));
            if (!snapshot.exists()) {
                snapshot = await window.get(window.child(ref, 'users'));
            }
            
            if (!snapshot.exists()) {
                return;
            }
            
            const users = snapshot.val();
            const helpers = [];
            
            for (const uid in users) {
                if (users[uid].role === 'helper') {
                    helpers.push({
                        uid: uid,
                        email: users[uid].email,
                        displayName: users[uid].displayName || users[uid].email
                    });
                }
            }
            
            // Сортируем по имени
            helpers.sort((a, b) => a.displayName.localeCompare(b.displayName));
            
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = '<option value="all">Все помощники</option>';
            helpers.forEach(helper => {
                const option = document.createElement('option');
                option.value = helper.email;
                option.textContent = `${helper.displayName} (${helper.email})`;
                filterSelect.appendChild(option);
            });
            
            if (currentValue && [...helpers].some(h => h.email === currentValue)) {
                filterSelect.value = currentValue;
            }
            
            console.log('✅ updateHelperFilter: загружено', helpers.length, 'помощников');
        } catch (e) {
            console.error('Ошибка в updateHelperFilter:', e);
            // Retry при ошибке
            setTimeout(() => updateHelperFilter(), 2000);
        }
    }
    
    // Fallback для случаев когда Firebase недоступен
    function populateAdminHelperFilterFallback() {
        const filterSelect = document.getElementById('adminHelperFilter');
        if (!filterSelect) return;
        
        const emails = new Set();
        ordersData.forEach(order => {
            (order.services || []).forEach(service => {
                (service.tasks || []).forEach(task => {
                    if (task.assignedTo) emails.add(task.assignedTo);
                });
            });
        });
        
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">Все помощники</option>';
        emails.forEach(email => {
            const opt = document.createElement('option');
            opt.value = email;
            opt.textContent = email;
            filterSelect.appendChild(opt);
        });
        if (currentValue && [...emails].includes(currentValue)) {
            filterSelect.value = currentValue;
        }
    }
    
    // Делаем функции глобально доступными
    window.updateHelperFilter = updateHelperFilter;

    function renderAdminPenalties(filterEmail, period) {
        const filtered = getPenaltiesForPeriod(helperPenalties, period || 'all')
            .filter(p => filterEmail === 'all' || p.helperEmail === filterEmail)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (filtered.length === 0) {
            return `<div style="text-align:center;padding:15px;color:#856404;font-size:14px;">Штрафов за выбранный период нет ✅</div>`;
        }
        
        const totalPenalties = filtered.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        
        return `
            <div style="background:#fff3cd;padding:10px;border-radius:6px;margin-bottom:15px;">
                <div style="font-weight:600;color:#856404;">Итого штрафов: <span style="color:#dc3545;font-size:16px;">${formatMoney(totalPenalties)}</span></div>
            </div>
            ${filtered.map(p => {
                const helperName = p.helperEmail;
                return `
                    <div style="background:#fff;padding:12px;border-radius:6px;margin-bottom:8px;border-left:3px solid #dc3545;">
                        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px;">
                            <div>
                                <div style="font-weight:600;color:#dc3545;">-${formatMoney(p.amount)}</div>
                                <div style="font-size:12px;color:#888;">
                                    ${new Date(p.createdAt).toLocaleDateString('ru-RU')} в ${new Date(p.createdAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:13px;font-weight:600;">${safeHTML(helperName)}</div>
                                ${p.orderNumber ? `<div style="font-size:12px;color:#666;">Заказ #${safeHTML(p.orderNumber)}</div>` : ''}
                            </div>
                        </div>
                        <div style="font-size:14px;color:#333;margin-bottom:6px;">${safeHTML(p.reason)}</div>
                        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#666;">
                            <span>Назначил: ${safeHTML(p.createdBy)}</span>
                            <button class="btn-extra" onclick="deletePenalty('${escAttr(p.id)}')" style="padding:4px 10px;font-size:12px;">Отменить</button>
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    }
    
    function renderAdminHelperTasks() {
        const container = document.getElementById('adminHelperTasksContainer');
        if (!container) return;
        
        const filterEmail = document.getElementById('adminHelperFilter')?.value || 'all';
        
        // Фильтруем заказы по периоду
        const filteredOrders = getTasksForPeriod(ordersData, currentAdminHelperReportPeriod);
        
        // Название периода
        const periodNames = { day: 'За сегодня', week: 'За неделю', month: 'За месяц', year: 'За год', all: 'За всё время' };
        
        // Собираем все задачи
        let allTasks = [];
        filteredOrders.forEach(order => {
            // Фильтр по датам заказов
            if (currentHelperDateFrom && order.date < currentHelperDateFrom) return;
            if (currentHelperDateTo && order.date > currentHelperDateTo) return;
            (order.services || []).forEach((service, svcIdx) => {
                (service.tasks || []).forEach(task => {
                    if (filterEmail !== 'all' && task.assignedTo !== filterEmail) return;
                    allTasks.push({
                        ...task,
                        orderNumber: order.orderNumber,
                        client: order.client,
                        serviceName: service.serviceName,
                        orderDate: order.date,
                        serviceIndex: svcIdx
                    });
                });
            });
        });
        
        // Сортируем: сначала просроченные, затем по сроку
        allTasks.sort((a, b) => {
            if (a.status === 'review' && b.status !== 'review') return -1;
            if (a.status !== 'review' && b.status === 'review') return 1;
            if (a.status === 'overdue' && b.status !== 'overdue') return -1;
            if (a.status !== 'overdue' && b.status === 'overdue') return 1;
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        });
        
        // Статистика
        const totalTasks = allTasks.length;
        const pendingTasks = allTasks.filter(t => t.status === 'pending').length;
        const reviewTasks = allTasks.filter(t => t.status === 'review').length;
        const completedTasks = allTasks.filter(t => t.status === 'completed').length;
        const overdueTasks = allTasks.filter(t => t.status === 'overdue').length;
        const totalEarned = allTasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (parseFloat(t.helperPay) || 0), 0);
        const totalPenalties = allTasks.filter(t => t.status === 'overdue').reduce((sum, t) => sum + (parseFloat(t.penalty) || 0), 0)
            + getPenaltiesForPeriod(helperPenalties, currentAdminHelperReportPeriod)
                .filter(p => filterEmail === 'all' || p.helperEmail === filterEmail)
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        // Считаем выплаты для всех помощников
        const helpersStats = {};
        const allHelperEmails = new Set(allTasks.map(t => t.assignedTo));
        const periodPenalties = getPenaltiesForPeriod(helperPenalties, currentAdminHelperReportPeriod);
        allHelperEmails.forEach(email => {
            let earned = 0, penalties = 0;
            allTasks.filter(t => t.assignedTo === email).forEach(task => {
                if (task.status === 'completed') earned += parseFloat(task.helperPay) || 0;
                if (task.status === 'overdue') penalties += parseFloat(task.penalty) || 0;
            });
            periodPenalties.filter(p => p.helperEmail === email).forEach(p => { penalties += parseFloat(p.amount) || 0; });

            // Выплачено и долг — за всё время, независимо от периода (js/finance.js)
            const accrual = finHelperAccrual(email);
            helpersStats[email] = {
                earned,
                penalties,
                net: earned - penalties,
                paid: accrual.paid,
                unpaid: Math.max(0, accrual.owed)
            };
        });
        
        if (allTasks.length === 0) {
            container.innerHTML = `
                <div class="helper-empty-state">
                    <div style="font-size:48px;margin-bottom:15px;">📋</div>
                    <div style="font-size:16px;margin-bottom:8px;">Задач не найдено</div>
                    <div style="font-size:14px;color:#888;">${filterEmail !== 'all' ? 'Нет задач для выбранного помощника' : 'Помощники ещё не получили задач'}</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <!-- Период -->
            <div style="background:#e3f2fd;padding:15px;border-radius:8px;margin-bottom:15px;border-left:4px solid #2196f3;">
                <h4 style="margin:0 0 5px 0;">📊 ${periodNames[currentAdminHelperReportPeriod]}</h4>
                <div style="font-size:13px;color:#666;">Период отчёта: ${periodNames[currentAdminHelperReportPeriod]}</div>
            </div>
            <!-- Статистика -->
            <div class="helper-stat-grid" style="margin-bottom:20px;">
                <div class="helper-stat-item">
                    <div class="helper-stat-label">📋 Всего задач</div>
                    <div class="helper-stat-value" style="color:#1a3c5e;">${totalTasks}</div>
                </div>
                <div class="helper-stat-item">
                    <div class="helper-stat-label">⏳ В процессе</div>
                    <div class="helper-stat-value" style="color:#f39c12;">${pendingTasks}</div>
                </div>
                <div class="helper-stat-item">
                    <div class="helper-stat-label">🕓 На проверке</div>
                    <div class="helper-stat-value" style="color:#3498db;">${reviewTasks}</div>
                </div>
                <div class="helper-stat-item">
                    <div class="helper-stat-label">✅ Выполнено</div>
                    <div class="helper-stat-value" style="color:#27ae60;">${completedTasks}</div>
                </div>
                <div class="helper-stat-item">
                    <div class="helper-stat-label">❌ Просрочено</div>
                    <div class="helper-stat-value" style="color:#e74c3c;">${overdueTasks}</div>
                </div>
                <div class="helper-stat-item highlight">
                    <div class="helper-stat-label">💰 Заработано</div>
                    <div class="helper-stat-value" style="color:#27ae60;">${formatMoney(totalEarned)}</div>
                </div>
                <div class="helper-stat-item warning">
                    <div class="helper-stat-label">⚠️ Штрафы</div>
                    <div class="helper-stat-value" style="color:#e74c3c;">${formatMoney(totalPenalties)}</div>
                </div>
            </div>
            
            <!-- Статистика по помощникам -->
            ${Object.keys(helpersStats).length > 0 ? `
                <div style="background:#e3f2fd;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #2196f3;">
                    <h4 style="margin:0 0 15px 0;">💳 Статус выплат по помощникам</h4>
                    ${Object.entries(helpersStats).map(([email, stats]) => `
                        <div style="background:#fff;padding:12px;border-radius:6px;margin-bottom:10px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                                <div>
                                    <div style="font-weight:700;font-size:16px;">${email}</div>
                                    <div style="font-size:13px;color:#666;margin-top:4px;">
                                        Заработано: <b style="color:#27ae60;">${formatMoney(stats.earned)}</b> | 
                                        Штрафы: <b style="color:#e74c3c;">-${formatMoney(stats.penalties)}</b> | 
                                        Итого: <b style="color:#1a3c5e;">${formatMoney(stats.net)}</b>
                                    </div>
                                    <div style="font-size:13px;color:#666;margin-top:2px;">
                                        Выплачено: <b style="color:#27ae60;">${formatMoney(stats.paid)}</b> | 
                                        Должно быть: <b style="color:#e67e22;">${formatMoney(stats.unpaid)}</b>
                                    </div>
                                </div>
                                <button class="btn-add" onclick="payHelper('${email}')" style="padding:8px 16px;font-size:13px;white-space:nowrap;">
                                    💳 Выплатить ${stats.unpaid > 0 ? '(' + formatMoney(stats.unpaid) + ')' : '(0 ₽)'}
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <!-- Штрафы помощников -->
            <div style="background:#fff3cd;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #ffc107;">
                <h4 style="margin:0 0 15px 0;color:#856404;">⚠️ Штрафы помощников</h4>
                ${renderAdminPenalties(filterEmail, currentAdminHelperReportPeriod)}
            </div>
            
            <!-- Список задач -->
            <div class="helper-section-title">Все задачи</div>
            ${allTasks.map(task => {
                const isOverdue = task.status === 'overdue';
                const isCompleted = task.status === 'completed';
                const isReview = task.status === 'review';
                const statusText = isCompleted ? '✅ Выполнена' : isReview ? '🕓 На проверке' : (isOverdue ? '❌ Просрочена' : '⏳ В процессе');
                const statusColor = isCompleted ? '#27ae60' : isReview ? '#3498db' : (isOverdue ? '#e74c3c' : '#f39c12');
                const cardClass = isCompleted ? 'completed' : (isOverdue ? 'overdue' : '');
                
                return `
                    <div class="helper-task-card ${cardClass}" style="background:#fff;padding:15px;border-radius:8px;margin-bottom:10px;border-left:4px solid ${statusColor};box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                            <div style="flex:1;min-width:200px;">
                                <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                                    <span style="font-weight:700;font-size:16px;">Заказ №${safeHTML(task.orderNumber)}</span>
                                    <span style="color:#666;font-size:14px;">(${safeHTML(task.client)})</span>
                                </div>
                                <div style="font-size:13px;color:#666;">
                                    <span>👷 ${safeHTML(task.assignedTo)}</span>
                                    ${task.serviceName ? `<span style="margin-left:10px;">🔧 ${safeHTML(task.serviceName)}</span>` : ''}
                                    ${task.orderDate ? `<span style="margin-left:10px;">📅 ${safeHTML(task.orderDate)}</span>` : ''}
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <span style="font-weight:600;color:${statusColor};font-size:14px;">${statusText}</span>
                            </div>
                        </div>
                        <div style="font-size:14px;margin-bottom:6px;"><b>Задача:</b> ${safeHTML(task.description)}</div>
                        <div style="display:flex;gap:15px;font-size:13px;color:#666;margin-bottom:8px;flex-wrap:wrap;">
                            <span>📅 Срок: <b style="color:${isOverdue ? '#e74c3c' : '#333'};">${formatTaskDeadline(task.deadline)}</b></span>
                            <span>💰 Оплата: <b style="color:#27ae60;">${task.helperPay} ₽</b></span>
                            ${task.penalty ? `<span>⚠️ Штраф: <b style="color:#e74c3c;">${task.penalty} ₽</b></span>` : ''}
                            ${task.createdAt ? `<span>🕐 Создана: ${new Date(task.createdAt).toLocaleDateString('ru-RU')}</span>` : ''}
                            ${task.completedAt ? `<span>✅ Выполнена: ${new Date(task.completedAt).toLocaleDateString('ru-RU')}</span>` : ''}
                        </div>
                        ${isReview ? `
                        <div style="background:#e8f4fd;border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                            <span>🕓 Помощник отметил выполненной${task.submittedAt ? ' ' + new Date(task.submittedAt).toLocaleDateString('ru-RU') : ''}</span>
                            <button class="btn-add" onclick="adminChangeTaskStatus('${safeHTML(task.orderNumber)}', '${safeHTML(task.id)}', 'completed')" style="padding:6px 12px;font-size:12px;background:#28a745;">✅ Подтвердить</button>
                            <button class="btn-extra" onclick="adminChangeTaskStatus('${safeHTML(task.orderNumber)}', '${safeHTML(task.id)}', 'pending')" style="padding:6px 12px;font-size:12px;">↩️ Вернуть в работу</button>
                        </div>` : ''}
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <button class="btn-add" onclick="openEditTaskModal('${safeHTML(task.orderNumber)}', '${safeHTML(task.id)}')" style="padding:6px 12px;font-size:12px;background:#007bff;">✏️ Редактировать</button>
                            ${!isCompleted ? `<button class="btn-add" onclick="adminChangeTaskStatus('${safeHTML(task.orderNumber)}', '${safeHTML(task.id)}', 'completed')" style="padding:6px 12px;font-size:12px;background:#28a745;">✅ Завершить</button>` : ''}
                            ${!isOverdue && !isCompleted ? `<button class="btn-del" onclick="adminChangeTaskStatus('${safeHTML(task.orderNumber)}', '${safeHTML(task.id)}', 'overdue')" style="padding:6px 12px;font-size:12px;">❌ Просрочить</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    }
    
    // Делаем функции глобально доступными
    window.renderAdminHelperTasks = renderAdminHelperTasks;
    window.renderAdminPenalties = renderAdminPenalties;
    window.populateAdminHelperFilterFallback = populateAdminHelperFilterFallback;

    // ========== МОДУЛЬ 5.3: ВЫПЛАТЫ ПОМОЩНИКАМ ==========
    window.setHelperReportPeriod = function(period) {
        currentHelperReportPeriod = period;
        // Обновляем кнопки
        ['Day', 'Week', 'Month', 'Year', 'All'].forEach(p => {
            const btn = document.getElementById('btnHelper' + p);
            if (btn) {
                btn.style.background = '#6c757d';
                btn.style.color = '#fff';
            }
        });
        const periodMap = { day: 'Day', week: 'Week', month: 'Month', year: 'Year', all: 'All' };
        const activeBtn = document.getElementById('btnHelper' + periodMap[period]);
        if (activeBtn) {
            activeBtn.style.background = '#007bff';
            activeBtn.style.color = '#fff';
        }
        renderHelperReport();
    };

    window.setAdminHelperReportPeriod = function(period) {
        currentAdminHelperReportPeriod = period;
        // Обновляем кнопки
        ['Day', 'Week', 'Month', 'Year', 'All'].forEach(p => {
            const btn = document.getElementById('btnAdmin' + p);
            if (btn) {
                btn.style.background = '#6c757d';
                btn.style.color = '#fff';
            }
        });
        const periodMap = { day: 'Day', week: 'Week', month: 'Month', year: 'Year', all: 'All' };
        const activeBtn = document.getElementById('btnAdmin' + periodMap[period]);
        if (activeBtn) {
            activeBtn.style.background = '#007bff';
            activeBtn.style.color = '#fff';
        }
        renderAdminHelperTasks();
    };

    function getTasksForPeriod(orders, period) {
        const now = new Date();
        let startDate = '';
        
        switch(period) {
            case 'day':
                startDate = formatDate(now);
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = formatDate(weekAgo);
                break;
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                startDate = formatDate(monthAgo);
                break;
            case 'year':
                const yearAgo = new Date(now);
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                startDate = formatDate(yearAgo);
                break;
            default:
                startDate = '2000-01-01'; // Всё время
        }
        
        return orders.filter(o => o.date >= startDate);
    }

    // Выплата помощнику — расход кассы «Помощникам» (js/finance.js)
    window.payHelper = function(helperEmail) {
        finPayHelper(helperEmail);
    };

    // Инициализация кнопок периода
    window.setHelperReportPeriod('all');
    window.setAdminHelperReportPeriod('all');

    // ========== МОДУЛЬ 5.6: УВЕДОМЛЕНИЯ МЕЖДУ АДМИНОМ И ПОМОЩНИКОМ ==========
    // Хранятся в helperNotices и синхронизируются через облако: to — email помощника или 'admin'
    const NOTICE_KEEP_DAYS = 60;
    const NOTICE_MAX = 300;

    function addNotice(to, type, message, orderNumber) {
        helperNotices.push({
            id: 'ntc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            to: to,
            type: type, // new_task, task_submitted, task_confirmed, task_returned, penalty_issued, payment_made
            message: message,
            orderNumber: orderNumber || null,
            read: false,
            createdAt: new Date().toISOString()
        });
        const cutoff = new Date(Date.now() - NOTICE_KEEP_DAYS * 86400000).toISOString();
        helperNotices = helperNotices.filter(n => n.createdAt >= cutoff).slice(-NOTICE_MAX);
    }

    // Уведомления текущего пользователя: админ видит адресованные 'admin', помощник — своему email
    function myNoticeAddress() {
        if (!window.currentUserData) return null;
        return window.currentUserData.role === 'admin' ? 'admin' : window.currentUserData.email;
    }

    function getMyNotices() {
        const to = myNoticeAddress();
        return helperNotices
            .filter(n => n.to === to)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function markNoticeRead(id) {
        const n = helperNotices.find(x => x.id === id);
        if (!n || n.read) return;
        n.read = true;
        saveAll();
        renderNotices();
    }

    function markAllNoticesRead() {
        let changed = false;
        getMyNotices().forEach(n => { if (!n.read) { n.read = true; changed = true; } });
        if (!changed) return;
        saveAll();
        renderNotices();
    }

    // Перенос старых уведомлений и штрафов, хранившихся только на этом устройстве
    function migrateHelperLocalData() {
        let changed = false;
        const known = new Set(helperNotices.map(n => n.id));
        const move = (key, toOf) => {
            let list = [];
            try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
            list.forEach(n => {
                if (!n || known.has(n.id)) return;
                helperNotices.push({ id: n.id, to: toOf(n), type: n.type, message: n.message, orderNumber: n.orderNumber || null, read: !!n.read, createdAt: n.createdAt });
                changed = true;
            });
            localStorage.removeItem(key);
        };
        move('admin_notifications', () => 'admin');
        move('helper_notifications', n => n.helperEmail);
        if (budgetData && budgetData.helperPenalties && budgetData.helperPenalties.length) {
            const ids = new Set(helperPenalties.map(p => p.id));
            budgetData.helperPenalties.forEach(p => { if (!ids.has(p.id)) { helperPenalties.push(p); changed = true; } });
            delete budgetData.helperPenalties;
            saveBudgetData();
        }
        if (!changed) return;
        // Вызывается из loadData, поэтому сохраняем напрямую, без saveAll
        localStorage.setItem('helperNotices_data', JSON.stringify(helperNotices));
        localStorage.setItem('helperPenalties_data', JSON.stringify(helperPenalties));
        if (typeof window.markChanged === 'function') window.markChanged();
    }

    function notifyHelperAboutTask(helperEmail, orderNumber, taskDescription) {
        const order = ordersData.find(o => o.orderNumber == orderNumber);
        const clientName = order ? order.client : 'Заказ #' + orderNumber;
        addNotice(helperEmail, 'new_task', `📋 Новая задача: ${taskDescription} (Заказ #${orderNumber}, ${clientName})`, orderNumber);
    }

    function notifyAdminAboutTaskCompletion(orderNumber, helperEmail, taskDescription) {
        const name = (window.currentUserData && window.currentUserData.displayName) || helperEmail;
        addNotice('admin', 'task_submitted', `🕓 ${name} сдал задачу на проверку: ${taskDescription} (Заказ #${orderNumber})`, orderNumber);
    }

    function notifyHelperAboutPenalty(helperEmail, amount, reason) {
        addNotice(helperEmail, 'penalty_issued', `⚠️ Штраф: ${formatMoney(amount)}. Причина: ${reason}`, null);
    }

    // Вызывается из js/finance.js (finPayHelper)
    function notifyHelperAboutPayment(helperEmail, amount) {
        addNotice(helperEmail, 'payment_made', `💳 Выплата: ${formatMoney(amount)}`, null);
    }

    // ========== МОДУЛЬ 5.8: ОТОБРАЖЕНИЕ УВЕДОМЛЕНИЙ В UI ==========
    // Значок типа уже в начале текста уведомления

    // Список уведомлений: у админа — во вкладке «Задачи помощников», у помощника — в «Мой отчёт»
    // Новое уведомление, пока программа открыта: на экране — всплывающая подсказка,
    // в фоновой вкладке — системное уведомление (если разрешены). Push по расписанию придёт позже
    // с тем же tag и заменит это уведомление, а не добавит второе.
    function announceNewNotices() {
        const to = myNoticeAddress();
        if (!to) return;
        const key = 'notices_seen_' + to;
        let seen = null;
        try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) {}
        const mine = getMyNotices();
        // Первый запуск — без оповещений; старше 10 минут — уже не «новое» (пришло, пока программа была закрыта)
        const fresh = seen ? mine.filter(n => !n.read && !seen.includes(n.id) && Date.now() - Date.parse(n.createdAt) < 10 * 60000) : [];
        try { localStorage.setItem(key, JSON.stringify(mine.map(n => n.id).slice(0, NOTICE_MAX))); } catch (e) {}
        fresh.slice(0, 3).forEach(n => {
            if (!document.hidden) { showToast(n.message); return; }
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            const options = { body: n.message, tag: n.id, icon: 'icons/icon-192.png' };
            const reg = navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration() : Promise.resolve(null);
            reg.then(r => r ? r.showNotification('Авто-ателье', options) : new Notification('Авто-ателье', options)).catch(() => {});
        });
    }

    function renderNotices() {
        updateNotificationBadges();
        announceNewNotices();
        if (typeof renderPushControls === 'function') renderPushControls();
        const container = document.getElementById(myNoticeAddress() === 'admin' ? 'adminNotificationsList' : 'helperNotificationsList');
        if (!container) return;

        const notices = getMyNotices().slice(0, 30);
        const unread = notices.filter(n => !n.read).length;
        if (notices.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:15px;color:#888;">Уведомлений нет</div>';
            return;
        }
        container.innerHTML = (unread ? `<div style="text-align:right;margin-bottom:6px;"><button class="btn-extra" onclick="markAllNoticesRead()" style="padding:4px 10px;font-size:12px;">Прочитать все</button></div>` : '') +
            notices.map(n => `
                <div class="notice-item${n.read ? '' : ' unread'}" onclick="markNoticeRead('${escAttr(n.id)}')">
                    <span>${safeHTML(n.message)}</span>
                    <span class="notice-date">${new Date(n.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `).join('');
    }

    // Счётчик непрочитанных на кнопках вкладок
    function updateNotificationBadges() {
        const count = getMyNotices().filter(n => !n.read).length;
        document.querySelectorAll('.notif-badge').forEach(badge => {
            badge.textContent = count > 0 ? String(count) : '';
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        });
    }

    window.markNoticeRead = markNoticeRead;
    window.markAllNoticesRead = markAllNoticesRead;
    window.renderNotices = renderNotices;

    // Универсальная функция загрузки помощников для селектов
    function loadHelpersForSelect(selectEl, includeExisting = true, maxRetries = 5) {
        return _loadHelpersForSelect(selectEl, includeExisting, 0, maxRetries);
    }
    
    function _loadHelpersForSelect(selectEl, includeExisting, retry, maxRetries) {
        if (!selectEl) return Promise.resolve([]);
        
        const existingHelpers = [];
        
        // Заполняем из существующих задач (если включено)
        if (includeExisting) {
            ordersData.forEach(order => {
                (order.services || []).forEach(service => {
                    (service.tasks || []).forEach(task => {
                        if (task.assignedTo && !existingHelpers.find(h => h.email === task.assignedTo)) {
                            existingHelpers.push({ email: task.assignedTo, displayName: task.assignedTo });
                        }
                    });
                });
            });
        }
        
        // Заполняем базовый список из существующих помощников
        selectEl.innerHTML = '<option value="">-- Выбери помощника --</option>';
        existingHelpers.forEach(h => {
            const option = document.createElement('option');
            option.value = h.email;
            option.textContent = h.displayName;
            selectEl.appendChild(option);
        });
        
        console.log('loadHelpersForSelect: базовых помощников:', existingHelpers.length);
        
        // ИСПРАВЛЕНО: Ждём готовности Firebase с ограничением retries
        if (!window.firebaseReady) {
            if (retry >= maxRetries) {
              console.warn('[loadHelpersForSelect] Firebase не загрузился, используем локальные данные');
              return Promise.resolve(existingHelpers);
            }
            console.log(`[loadHelpersForSelect] Firebase не готов, retry ${retry + 1}/${maxRetries} через 500мс...`);
            return new Promise((resolve) => {
                setTimeout(() => {
                    _loadHelpersForSelect(selectEl, includeExisting, retry + 1, maxRetries).then(resolve);
                }, 500);
            });
        }
        
        if (!window.db || typeof window.get !== 'function' || typeof window.child !== 'function') {
            console.warn('loadHelpersForSelect: Firebase функции недоступны');
            return Promise.resolve(existingHelpers);
        }
        
        const loadedHelpers = [...existingHelpers];
        
        return window.get(window.child(window.fbRef(window.db), 'users')).then((snapshot) => {
            if (!snapshot.exists()) {
                console.log('loadHelpersForSelect: нет пользователей в Firebase');
                return loadedHelpers;
            }
            
            const users = snapshot.val();
            const existingEmails = new Set();
            selectEl.querySelectorAll('option').forEach(opt => existingEmails.add(opt.value));
            
            let helperCount = 0;
            for (const uid in users) {
                if (users[uid].role === 'helper') {
                    const helperData = {
                        email: users[uid].email,
                        displayName: users[uid].displayName || users[uid].email
                    };
                    
                    if (!existingEmails.has(users[uid].email)) {
                        const option = document.createElement('option');
                        option.value = helperData.email;
                        option.textContent = `${helperData.displayName} (${helperData.email})`;
                        selectEl.appendChild(option);
                        helperCount++;
                        loadedHelpers.push(helperData);
                    }
                }
            }
            
            console.log('✅ loadHelpersForSelect: загружено из Firebase:', helperCount, 'всего:', loadedHelpers.length);
            return loadedHelpers;
        }).catch(err => {
            console.error('❌ loadHelpersForSelect: ошибка загрузки из Firebase:', err);
            if (retry >= maxRetries) {
              console.warn('[loadHelpersForSelect] Максимум retries достигнут, используем локальные данные');
              return Promise.resolve(existingHelpers);
            }
            // Retry через 2 секунды
            return new Promise((resolve) => {
                setTimeout(() => {
                    _loadHelpersForSelect(selectEl, includeExisting, retry + 1, maxRetries).then(resolve);
                }, 2000);
            });
        });
    }
    
    function openPenaltyModal() {
        console.log('🚨 openPenaltyModal вызван');
        
        // Заполнить список помощников
        const helperSelect = document.getElementById('penaltyHelper');
        helperSelect.innerHTML = '<option value="">-- Выбери помощника --</option>';
        
        // Загружаем помощников
        loadHelpersForSelect(helperSelect, true).then((helpers) => {
            if (helpers.length === 0) {
                setTimeout(() => alert('⚠️ Помощники не найдены. Сначала добавьте помощника кнопкой «➕ Добавить помощника».'), 300);
            }
        });
        
        // Заполнить список заказов
        const orderSelect = document.getElementById('penaltyOrder');
        orderSelect.innerHTML = '<option value="">-- Без заказа --</option>';
        ordersData.forEach(order => {
            const option = document.createElement('option');
            option.value = order.orderNumber;
            option.textContent = `Заказ #${order.orderNumber} — ${order.client || 'Без клиента'}`;
            orderSelect.appendChild(option);
        });
        
        // Очистить форму
        document.getElementById('penaltyAmount').value = '';
        document.getElementById('penaltyReason').value = '';
        document.getElementById('penaltyOrder').value = '';
        
        document.getElementById('penaltyModal').classList.add('active');
    }
    
    function closePenaltyModal() {
        document.getElementById('penaltyModal').classList.remove('active');
    }
    
    function savePenalty() {
        const helperEmail = document.getElementById('penaltyHelper').value;
        const amount = parseFloat(document.getElementById('penaltyAmount').value) || 0;
        const reason = document.getElementById('penaltyReason').value.trim();
        const orderNumber = document.getElementById('penaltyOrder').value;
        
        if (!helperEmail) {
            alert('Выбери помощника!');
            return;
        }
        if (amount <= 0) {
            alert('Введи корректную сумму штрафа!');
            return;
        }
        if (!reason) {
            alert('Опиши причину штрафа!');
            return;
        }
        
        const penalty = {
            id: 'pen_' + Date.now(),
            helperEmail: helperEmail,
            amount: amount,
            reason: reason,
            orderNumber: orderNumber || null,
            createdBy: window.currentUserData?.email || 'admin',
            createdAt: new Date().toISOString()
        };

        helperPenalties.push(penalty);
        notifyHelperAboutPenalty(helperEmail, amount, reason);
        saveAll();
        renderAll();
        renderAdminHelperTasks();

        closePenaltyModal();
        showToast(`Штраф ${formatMoney(amount)} для ${helperEmail} выписан`);
    }

    function deletePenalty(id) {
        const idx = helperPenalties.findIndex(p => p.id === id);
        if (idx === -1 || !confirm('Отменить этот штраф?')) return;
        const p = helperPenalties[idx];
        helperPenalties.splice(idx, 1);
        addNotice(p.helperEmail, 'penalty_issued', `✅ Штраф ${formatMoney(p.amount)} отменён (${p.reason})`, p.orderNumber);
        saveAll();
        renderAll();
        renderAdminHelperTasks();
    }
    
    function renderHelperPenalties() {
        if (!window.currentUserData || window.currentUserData.role === 'admin') return;
        
        const container = document.getElementById('helperPenaltiesContainer');
        if (!container) return;
        
        const helperEmail = window.currentUserData.email;
        const periodFilter = currentHelperReportPeriod || 'all';
        const filteredPenalties = getPenaltiesForPeriod(helperPenalties, periodFilter)
            .filter(p => p.helperEmail === helperEmail)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (filteredPenalties.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:20px;color:#888;background:#f8f9fa;border-radius:8px;">
                    <div style="font-size:32px;margin-bottom:8px;">✅</div>
                    <div>Штрафов нет</div>
                    <div style="font-size:13px;margin-top:5px;">За выбранный период штрафов не было</div>
                </div>
            `;
            return;
        }
        
        const totalPenalties = filteredPenalties.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        
        container.innerHTML = `
            <div style="background:#fff3cd;padding:12px;border-radius:8px;margin-bottom:15px;border-left:4px solid #ffc107;">
                <div style="font-weight:600;color:#856404;">Итого штрафов: <span style="color:#dc3545;font-size:18px;">${formatMoney(totalPenalties)}</span></div>
            </div>
            ${filteredPenalties.map(p => `
                <div style="background:#fff;padding:15px;border-radius:8px;margin-bottom:10px;border-left:4px solid #dc3543;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
                        <div>
                            <div style="font-weight:600;color:#dc3545;font-size:16px;">-${formatMoney(p.amount)}</div>
                            <div style="font-size:12px;color:#888;margin-top:4px;">
                                ${new Date(p.createdAt).toLocaleDateString('ru-RU')} в ${new Date(p.createdAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}
                            </div>
                        </div>
                        ${p.orderNumber ? `<span style="background:#e3f2fd;padding:4px 8px;border-radius:4px;font-size:12px;">Заказ #${safeHTML(p.orderNumber)}</span>` : ''}
                    </div>
                    <div style="font-size:14px;color:#333;margin-bottom:8px;">${safeHTML(p.reason)}</div>
                    <div style="font-size:12px;color:#666;">Назначил: ${safeHTML(p.createdBy)}</div>
                </div>
            `).join('')}
        `;
    }
    
    function getPenaltiesForPeriod(penalties, period) {
        if (!penalties || penalties.length === 0) return [];
        
        const now = new Date();
        let startDate = '';
        
        switch(period) {
            case 'day':
                startDate = formatDate(now);
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = formatDate(weekAgo);
                break;
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                startDate = formatDate(monthAgo);
                break;
            case 'year':
                const yearAgo = new Date(now);
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                startDate = formatDate(yearAgo);
                break;
            default:
                startDate = '2000-01-01';
        }
        
        return penalties.filter(p => p.createdAt >= startDate);
    }
    
    window.openPenaltyModal = openPenaltyModal;
    window.closePenaltyModal = closePenaltyModal;
    window.savePenalty = savePenalty;
    window.deletePenalty = deletePenalty;
    window.renderHelperPenalties = renderHelperPenalties;

    function openHelperTaskModalFromAdmin() {
        openHelperTaskModal(null);
        // Очистить поле заказа для создания новой задачи
        document.getElementById('helperTaskOrder').value = '';
    }

    function openEditTaskModal(orderNumber, taskId) {
        const order = ordersData.find(o => o.orderNumber == orderNumber);
        if (!order) return;
        
        // Найти задачу
        let task = null;
        (order.services || []).forEach((service, idx) => {
            (service.tasks || []).forEach(t => {
                if (String(t.id) === String(taskId)) {
                    task = { ...t, orderNumber, client: order.client, serviceName: service.serviceName, serviceIndex: idx };
                }
            });
        });
        
        if (!task) {
            alert('Задача не найдена!');
            return;
        }
        
        currentEditingTask = task;
        
        // Заполнить форму
        document.getElementById('editTaskOrderInfo').innerHTML = `
            <strong>Заказ №${safeHTML(task.orderNumber)}</strong> (${safeHTML(task.client)})<br>
            <span style="color:#666;">Услуга: ${safeHTML(task.serviceName)}</span>
        `;
        document.getElementById('editTaskDescription').value = task.description || '';
        
        // Извлекаем дату и время из deadline (формат ГГГГ-ММ-ДДТЧЧ:ММ)
        let deadlineDate = '';
        let deadlineTime = '18:00';
        if (task.deadline) {
            if (task.deadline.includes('T')) {
                const parts = task.deadline.split('T');
                deadlineDate = parts[0];
                const timePart = parts[1] || '18:00';
                deadlineTime = timePart.substring(0, 5);
            } else {
                deadlineDate = task.deadline;
            }
        }
        
        document.getElementById('editTaskDeadline').value = deadlineDate;
        if (document.getElementById('editTaskTime')) {
            document.getElementById('editTaskTime').value = deadlineTime;
        }
        document.getElementById('editTaskAssignee').value = task.assignedTo || '';
        document.getElementById('editTaskPay').value = task.helperPay || '';
        document.getElementById('editTaskPenalty').value = task.penalty || '';
        document.getElementById('editTaskStatus').value = task.status || 'pending';
        
        document.getElementById('editTaskModal').classList.add('active');
        document.body.classList.add('modal-open');
    }

    function closeEditTaskModal() {
        document.getElementById('editTaskModal').classList.remove('active');
        document.body.classList.remove('modal-open');
        currentEditingTask = null;
    }

    function saveEditTask() {
        if (!currentEditingTask) return;
        
        const { orderNumber, id, serviceIndex } = currentEditingTask;
        const description = document.getElementById('editTaskDescription').value.trim();
        const deadline = document.getElementById('editTaskDeadline').value;
        const taskTime = document.getElementById('editTaskTime') ? document.getElementById('editTaskTime').value : '18:00';
        const assignedTo = document.getElementById('editTaskAssignee').value.trim();
        const helperPay = parseFloat(document.getElementById('editTaskPay').value) || 0;
        let penalty = parseFloat(document.getElementById('editTaskPenalty').value) || 0;
        
        // ИСПРАВЛЕНО: штраф не может превышать оплату за задачу
        if (penalty > helperPay) {
            alert('⚠️ Штраф не может превышать оплату за задачу!\n\nОплата: ' + helperPay + ' ₽\nМакс. штраф: ' + helperPay + ' ₽');
            penalty = helperPay;
            document.getElementById('editTaskPenalty').value = penalty;
        }
        
        const status = document.getElementById('editTaskStatus').value;
        
        if (!description || !deadline || !assignedTo) {
            alert('Заполните все обязательные поля!');
            return;
        }
        
        // Формируем полный срок с временем
        let fullDeadline = deadline;
        if (taskTime) {
            fullDeadline = deadline + 'T' + taskTime;
        }
        
        const order = ordersData.find(o => o.orderNumber == orderNumber);
        if (!order) {
            alert('Заказ не найден!');
            return;
        }
        
        const service = order.services[serviceIndex];
        if (!service) {
            alert('Услуга не найдена!');
            return;
        }
        
        const task = (service.tasks || []).find(t => String(t.id) === String(id));
        if (!task) {
            alert('Задача не найдена!');
            return;
        }
        
        // Обновить задачу
        task.description = description;
        task.deadline = fullDeadline;
        task.assignedTo = assignedTo;
        task.helperPay = helperPay;
        task.penalty = penalty;
        task.status = status;
        
        saveAll();
        closeEditTaskModal();
        renderAll();
        alert('✅ Задача обновлена!');
    }

    function deleteTaskFromEditModal() {
        if (!currentEditingTask) return;
        deleteTask(currentEditingTask.orderNumber, currentEditingTask.id, currentEditingTask.serviceIndex);
        closeEditTaskModal();
    }

    function deleteTask(orderNumber, taskId, serviceIndex) {
        const order = ordersData.find(o => o.orderNumber == orderNumber);
        if (!order) return;
        
        const service = order.services[serviceIndex];
        if (!service) return;
        
        const taskIdx = (service.tasks || []).findIndex(t => String(t.id) === String(taskId));
        if (taskIdx === -1) return;
        
        if (!confirm('Удалить эту задачу?')) return;
        
        service.tasks.splice(taskIdx, 1);
        saveAll();
        renderAll();
    }

    function adminChangeTaskStatus(orderNumber, taskId, newStatus) {
        const found = findTaskById(taskId);
        if (!found) return;
        const { order, task } = found;
        const wasReview = task.status === 'review';
        task.status = newStatus;
        if (newStatus === 'completed') {
            // Подтверждено админом — с этого момента оплата начислена
            task.completedAt = new Date().toISOString();
            task.confirmedBy = window.currentUserData ? window.currentUserData.email : null;
            if (task.assignedTo) addNotice(task.assignedTo, 'task_confirmed', `✅ Задача принята: ${task.description} (Заказ #${order.orderNumber}). Начислено ${formatMoney(parseFloat(task.helperPay) || 0)}`, order.orderNumber);
        } else if (newStatus === 'pending') {
            // Вернули в работу
            delete task.submittedAt;
            delete task.completedAt;
            if (wasReview && task.assignedTo) addNotice(task.assignedTo, 'task_returned', `↩️ Задача возвращена в работу: ${task.description} (Заказ #${order.orderNumber})`, order.orderNumber);
        } else if (newStatus === 'overdue' && task.assignedTo) {
            addNotice(task.assignedTo, 'penalty_issued', `❌ Задача просрочена: ${task.description} (Заказ #${order.orderNumber})${parseFloat(task.penalty) ? '. Штраф ' + formatMoney(parseFloat(task.penalty)) : ''}`, order.orderNumber);
        }

        saveAll();
        renderAll();
        // Всегда обновляем задачи помощника (даже если смотрит админ)
        renderHelperTasks();
        renderHelperReport();
    }

    // ========== МОДАЛКА ЗАДАЧ ДЛЯ ПОМОЩНИКА (ADMIN) ==========
    function openHelperTaskModal(orderNumber) {
        
        // Заполняем список заказов
        const orderSelect = document.getElementById('helperTaskOrder');
        orderSelect.innerHTML = '<option value="">-- Выбери заказ --</option>';
        ordersData.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.orderNumber;
            opt.textContent = `№${o.orderNumber} — ${o.client || 'Без клиента'}`;
            if (o.orderNumber == orderNumber) opt.selected = true;
            orderSelect.appendChild(opt);
        });
        
        // Заполняем список помощников — используем универсальную функцию
        const assigneeSelect = document.getElementById('helperTaskAssignee');
        assigneeSelect.innerHTML = '<option value="">-- Выбери помощника --</option>';
        
        loadHelpersForSelect(assigneeSelect, true);
        
        // Устанавливаем дату по умолчанию - завтра
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('helperTaskDeadline').value = formatDate(tomorrow);
        if (document.getElementById('helperTaskTime')) {
            document.getElementById('helperTaskTime').value = '18:00';
        }
        document.getElementById('helperTaskDescription').value = '';
        document.getElementById('helperTaskPay').value = '';
        document.getElementById('helperTaskPenalty').value = '';
        
        document.getElementById('helperTaskModal').classList.add('active');
        document.body.classList.add('modal-open');
    }

    function closeHelperTaskModal() {
        document.getElementById('helperTaskModal').classList.remove('active');
        document.body.classList.remove('modal-open');
    }
    
    // Делаем функции глобально доступными
    window.openHelperTaskModal = openHelperTaskModal;
    window.closeHelperTaskModal = closeHelperTaskModal;
    window.saveHelperTask = saveHelperTask;

    function saveHelperTask() {
        const orderNumber = document.getElementById('helperTaskOrder').value;
        const assignedTo = document.getElementById('helperTaskAssignee').value;
        const description = document.getElementById('helperTaskDescription').value.trim();
        const deadline = document.getElementById('helperTaskDeadline').value;
        const taskTime = document.getElementById('helperTaskTime') ? document.getElementById('helperTaskTime').value : '18:00';
        const helperPay = parseFloat(document.getElementById('helperTaskPay').value) || 0;
        let penalty = parseFloat(document.getElementById('helperTaskPenalty').value) || 0;
        
        // ИСПРАВЛЕНО: штраф не может превышать оплату за задачу
        if (penalty > helperPay) {
            alert('⚠️ Штраф не может превышать оплату за задачу!\n\nОплата: ' + helperPay + ' ₽\nМакс. штраф: ' + helperPay + ' ₽');
            penalty = helperPay;
            document.getElementById('helperTaskPenalty').value = penalty;
        }
        
        if (!orderNumber || !assignedTo || !description || !deadline) {
            alert('Заполните все поля!');
            return;
        }
        
        const order = ordersData.find(o => o.orderNumber == orderNumber);
        if (!order) {
            alert('Заказ не найден!');
            return;
        }
        
        // Формируем полный срок с временем
        let fullDeadline = deadline;
        if (taskTime) {
            fullDeadline = deadline + 'T' + taskTime;
        }
        
        // Добавляем задачу в первую услугу заказа
        if (!order.services || order.services.length === 0) {
            alert('В заказе нет услуг!');
            return;
        }
        
        const service = order.services[0];
        if (!service.tasks) service.tasks = [];
        
        service.tasks.push({
            id: Date.now().toString(),
            description,
            deadline: fullDeadline,
            assignedTo,
            helperPay,
            penalty,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        
        // Уведомляем помощника о новой задаче
        notifyHelperAboutTask(assignedTo, orderNumber, description);
        
        saveAll();
        closeHelperTaskModal();
        renderAll();
        alert('✅ Задача создана для ' + assignedTo + '\n📬 Помощник получит уведомление!');
    }


    // ========== МОДУЛЬ 6: УПРАВЛЕНИЕ ЗАКАЗАМИ (CRUD, услуги, расходники) ==========
    function getOrderColorObj(order) {
        // Преобразуем строковые значения в boolean
        const isDone = order.done === true || order.done === 'true' || order.done === 1;
        if (isDone) return 'done';
        
        const manualColor = order.manualColor;
        if (manualColor && manualColor !== 'auto') return manualColor;
        
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

    function formatDateDDMMYYYY(dateStr) {
        if (!dateStr) return '';
        // Если уже в формате ДД.ММ.ГГГГ, возвращаем как есть
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
        // Преобразуем ГГГГ-ММ-ДД в ДД.ММ.ГГГГ
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const parts = dateStr.split('-');
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return dateStr;
    }

    function formatTaskDeadline(deadline) {
        if (!deadline) return '—';
        // Формат: ГГГГ-ММ-ДДТЧЧ:ММ или ГГГГ-ММ-ДД
        let datePart = deadline;
        let timePart = '';
        if (deadline.includes('T')) {
            const parts = deadline.split('T');
            datePart = parts[0];
            timePart = parts[1] || '';
        }
        const formatted = formatDateDDMMYYYY(datePart);
        if (timePart) {
            return formatted + ' ' + timePart.substring(0, 5);
        }
        return formatted;
    }

    function formatPhone(input) {
        const cursorPos = input.selectionStart;
        const oldVal = input.value;
        let val = input.value.replace(/\D/g,'');
        if (val.startsWith('8')) val = '7'+val.slice(1);
        if (!val.startsWith('7')) val = '7'+val;
        if (val.length > 11) val = val.slice(0,11);
        const newVal = '+'+val;
        // Не перезаписываем если значение не изменилось - важно для iOS
        if (newVal !== oldVal) {
            input.value = newVal;
            // Восстанавливаем позицию курсора
            const newPos = cursorPos + (newVal.length - oldVal.length);
            input.setSelectionRange(Math.max(0, newPos), Math.max(0, newPos));
        }
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

    // ========== МОДУЛЬ 6.1: РАСЧЕТ СЕБЕСТОИМОСТИ ==========
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
        order.grossProfit = (parseFloat(order.clientPrice)||0) - totalCost;
        return order;
    }

    // ========== МОДУЛЬ 8: СКЛАД И МАТЕРИАЛЫ ==========
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
            if (!order.services || !Array.isArray(order.services)) return;
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

    // ========== МОДУЛЬ 9: ДЕНЬГИ И ОПЕРАЦИИ ==========
    // Вкладка «Деньги» — js/finance.js
    function renderCash() {
        renderFinance();
    }

    function renderCashBudgetSummary() {
        const container = document.getElementById('cashBudgetSummary');
        if (!container || !budgetData || !budgetData.wallets) return;
        
        // Считаем общий доход из заказов
        const totalIncome = ordersData.reduce((sum, o) => sum + (parseFloat(o.clientPrice) || 0), 0);
        const totalCost = ordersData.reduce((sum, o) => sum + (parseFloat(o.materialCost) || 0), 0);
        const totalHelper = ordersData.reduce((sum, o) => sum + (parseFloat(o.helperPay) || 0), 0);
        const netProfit = totalIncome - totalCost - totalHelper;
        
        container.innerHTML = `
            <div class="budget-result-row"><span class="label">💰 Общий доход:</span><span class="value" style="color:#27ae60;">${formatMoney(totalIncome)}</span></div>
            <div class="budget-result-row"><span class="label">📦 Расходы на материалы:</span><span class="value" style="color:#e74c3c;">-${formatMoney(totalCost)}</span></div>
            <div class="budget-result-row"><span class="label">👥 Помощнику:</span><span class="value" style="color:#e74c3c;">-${formatMoney(totalHelper)}</span></div>
            <div class="budget-result-row highlight"><span class="label">✨ Чистая прибыль:</span><span class="value" style="color:#27ae60;">${formatMoney(netProfit)}</span></div>
            <div style="font-size:12px;color:#6c757d;margin-top:8px;">Накопления по копилкам — в блоке «Кошельки» ниже</div>
        `;
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

    function deleteCashOp(idx) {
        cashOps.splice(idx, 1);
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

    // ========== МОДАЛКИ ОПЕРАЦИЙ И РЕГУЛЯРНЫХ ПЛАТЕЖЕЙ ==========
    // opts.fund — сразу «потратить из копилки»
    function openAddCashModal(opts) {
        const fund = opts && opts.fund ? opts.fund : '';
        const fundCategory = { tax: 'tax', reserve: 'business', dev: 'business', savings: 'personal', invest: 'personal' };
        document.getElementById('addCashModalTitle').textContent = fund ? '− Трата из копилки' : '➕ Новая операция';
        document.getElementById('cashOpDate').value = formatDate(new Date());
        document.getElementById('cashOpDesc').value = '';
        document.getElementById('cashOpIncome').value = '0';
        document.getElementById('cashOpExpense').value = '0';
        document.getElementById('cashOpCategory').value = fundCategory[fund] || 'business';
        document.getElementById('cashOpFund').value = fund;
        updateCashOpPreview();
        document.getElementById('addCashModal').classList.add('active');
        document.body.classList.add('modal-open');
    }

    function closeAddCashModal() {
        document.getElementById('addCashModal').classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    function saveCashOp() {
        const date = document.getElementById('cashOpDate').value;
        const desc = document.getElementById('cashOpDesc').value.trim();
        const income = parseFloat(document.getElementById('cashOpIncome').value) || 0;
        const expense = parseFloat(document.getElementById('cashOpExpense').value) || 0;
        
        if (!date) { alert('❌ Укажите дату'); return; }
        if (!desc) { alert('❌ Введите описание'); return; }
        if (income <= 0 && expense <= 0) { alert('❌ Укажите приход или расход'); return; }
        
        // Приход вручную (не оплата заказа) — «Прочее»; выручкой считаются только оплаты заказов
        const category = income > 0 && expense <= 0 ? 'other' : (document.getElementById('cashOpCategory').value || 'other');
        const fund = document.getElementById('cashOpFund').value;
        const op = { id: 'op-' + Date.now(), date, desc, income, expense, category };
        if (fund && expense > 0) op.fund = fund; // трата из копилки не уменьшает прибыль второй раз
        cashOps.push(op);
        saveAll();
        closeAddCashModal();
        renderAll();
    }

    function openAddRegularExpenseModal(editIdx) {
        document.getElementById('regExpenseEditIdx').value = editIdx || -1;
        if (editIdx !== undefined && editIdx >= 0) {
            const exp = regularExpenses[editIdx];
            document.getElementById('regExpenseDesc').value = exp.desc;
            document.getElementById('regExpenseDay').value = exp.day;
            document.getElementById('regExpenseAmount').value = exp.amount;
            document.getElementById('addRegularExpenseModalTitle').textContent = '✏️ Редактировать расход';
        } else {
            document.getElementById('regExpenseDesc').value = '';
            document.getElementById('regExpenseDay').value = '';
            document.getElementById('regExpenseAmount').value = '';
            document.getElementById('addRegularExpenseModalTitle').textContent = '➕ Новый регулярный расход';
        }
        document.getElementById('addRegularExpenseModal').classList.add('active');
        document.body.classList.add('modal-open');
    }

    function closeAddRegularExpenseModal() {
        document.getElementById('addRegularExpenseModal').classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    function saveRegularExpense() {
        const editIdx = parseInt(document.getElementById('regExpenseEditIdx').value);
        const desc = document.getElementById('regExpenseDesc').value.trim();
        const day = parseInt(document.getElementById('regExpenseDay').value);
        const amount = parseFloat(document.getElementById('regExpenseAmount').value);
        
        if (!desc) { alert('❌ Введите название'); return; }
        if (isNaN(day) || day < 1 || day > 31) { alert('❌ Неверный день (1-31)'); return; }
        if (isNaN(amount) || amount <= 0) { alert('❌ Неверная сумма'); return; }
        
        if (editIdx >= 0) {
            regularExpenses[editIdx] = {desc, day, amount};
        } else {
            regularExpenses.push({desc, day, amount});
        }
        saveAll();
        closeAddRegularExpenseModal();
        renderAll();
    }

    function openAddRegularIncomeModal(editIdx) {
        document.getElementById('regIncomeEditIdx').value = editIdx || -1;
        if (editIdx !== undefined && editIdx >= 0) {
            const inc = regularIncomes[editIdx];
            document.getElementById('regIncomeDesc').value = inc.desc;
            document.getElementById('regIncomeDay').value = inc.day;
            document.getElementById('regIncomeAmount').value = inc.amount;
            document.getElementById('addRegularIncomeModalTitle').textContent = '✏️ Редактировать доход';
        } else {
            document.getElementById('regIncomeDesc').value = '';
            document.getElementById('regIncomeDay').value = '';
            document.getElementById('regIncomeAmount').value = '';
            document.getElementById('addRegularIncomeModalTitle').textContent = '➕ Новый регулярный доход';
        }
        document.getElementById('addRegularIncomeModal').classList.add('active');
        document.body.classList.add('modal-open');
    }

    function closeAddRegularIncomeModal() {
        document.getElementById('addRegularIncomeModal').classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    function saveRegularIncome() {
        const editIdx = parseInt(document.getElementById('regIncomeEditIdx').value);
        const desc = document.getElementById('regIncomeDesc').value.trim();
        const day = parseInt(document.getElementById('regIncomeDay').value);
        const amount = parseFloat(document.getElementById('regIncomeAmount').value);
        
        if (!desc) { alert('❌ Введите название'); return; }
        if (isNaN(day) || day < 1 || day > 31) { alert('❌ Неверный день (1-31)'); return; }
        if (isNaN(amount) || amount <= 0) { alert('❌ Неверная сумма'); return; }
        
        if (editIdx >= 0) {
            regularIncomes[editIdx] = {desc, day, amount};
        } else {
            regularIncomes.push({desc, day, amount});
        }
        saveAll();
        closeAddRegularIncomeModal();
        renderAll();
    }

    function updateCashOpPreview() {
        const income = parseFloat(document.getElementById('cashOpIncome').value) || 0;
        const expense = parseFloat(document.getElementById('cashOpExpense').value) || 0;
        const diff = income - expense;
        const preview = document.getElementById('cashOpPreview');
        if (diff >= 0) {
            preview.textContent = `+${formatMoney(diff)}`;
            preview.style.color = '#28a745';
        } else {
            preview.textContent = `${formatMoney(diff)}`;
            preview.style.color = '#dc3545';
        }
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
                const unit = getUnitFromArticleName(art.name);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${art.code}</td><td>${art.name}</td><td>${unit}</td>
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

    // Автоматическое определение единицы измерения по названию артикула
    function getUnitFromArticleName(articleName, articleCode) {
        const code = (articleCode || '').toLowerCase();
        const name = (articleName || '').toLowerCase();
        // Сначала проверяем код артикула
        if (code.includes('пачка')) return 'пачка';
        if (code.includes('м2') || code.includes('м²')) return 'м²';
        if (code.includes('лист')) return 'лист';
        // Затем проверяем название
        if (name.includes('пачка')) return 'пачка';
        if (name.includes('м2') || name.includes('м²')) return 'м²';
        if (name.includes('лист')) return 'лист';
        return 'лист'; // по умолчанию
    }

    function renderMaterialTypes() {
        const container = document.getElementById('materialTypesContainer');
        if (!container) return;
        container.innerHTML = '';
        materialTypes.forEach((mt, idx) => {
            const div = document.createElement('div');
            div.innerHTML = `<strong>${mt.name}</strong> (${mt.unit}) <button class="btn-extra" onclick="addArticleToType(${idx})">➕ Артикул</button> <button class="btn-del" onclick="deleteMaterialType(${idx})">✕</button>`;
            const table = document.createElement('table');
            table.innerHTML = `<tr><th>Артикул</th><th>Наименование</th><th>Цена</th><th></th></tr>`;
            mt.articles.forEach((art, artIdx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><input type="text" value="${art.code}" onchange="updateTypeArticleCode(${idx}, ${artIdx}, this.value)" style="width:100px;"></td><td><input type="text" value="${art.name}" onchange="updateTypeArticleName(${idx}, ${artIdx}, this.value)" style="width:150px;"></td><td><input type="number" value="${parseFloat(art.price)||0}" onchange="updateTypeArticlePrice(${idx}, ${artIdx}, this.value)" step="0.01" style="width:80px;"></td><td><button class="btn-del" onclick="deleteArticleFromType(${idx}, ${artIdx})">✕</button></td>`;
                table.appendChild(tr);
            });
            div.appendChild(table);
            container.appendChild(div);
        });
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
          document.body.classList.add('modal-open');
        }
        function closeAddColorModal() { 
            document.getElementById('addColorModal').classList.remove('active');
            document.body.classList.remove('modal-open');
        }
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
         document.body.classList.add('modal-open');
     }
     function closeAddPaintModal() { 
         document.getElementById('addPaintModal').classList.remove('active');
         document.body.classList.remove('modal-open');
     }
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
        document.body.classList.add('modal-open');
    }
    function closeAddFilmModal() { 
        document.getElementById('addFilmModal').classList.remove('active');
        document.body.classList.remove('modal-open');
    }
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
        document.body.classList.add('modal-open');
    }
    function closeAddExtraRefModal() { 
        document.getElementById('addExtraRefModal').classList.remove('active');
        document.body.classList.remove('modal-open');
    }
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
        document.body.classList.add('modal-open');
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

    function closeServiceItemsModal() { 
        document.getElementById('serviceItemsModal').classList.remove('active');
        document.body.classList.remove('modal-open');
        editingServiceIndex = null;
    }

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
        // Показать модалку и заблокировать скролл
        const orderModal = document.getElementById('orderModal');
        const isMobile = window.innerWidth <= 768;
        
        // iOS/Android: bottom-sheet анимация
        if (isMobile) {
            const orderModalInner = orderModal.querySelector('.modal');
            if (orderModalInner) {
                orderModalInner.classList.add('order-modal-bottom-sheet');
                // Force reflow для анимации
                orderModalInner.offsetHeight;
                orderModalInner.classList.add('active');
            }
        }
        
        orderModal.classList.add('active');
        // Фон под окном не прокручивается (как у остальных окон); окно прокручивается само
        document.body.classList.add('modal-open');
        orderModal.querySelector('.modal').scrollTop = 0;
        const deleteRow = document.getElementById('orderDeleteRow');
        if (deleteRow) deleteRow.style.display = order ? '' : 'none'; // у нового заказа удалять нечего
        
        // Исправление: защита от null и нечисловых строк
        document.getElementById('orderClientPrice').value = parseFloat(order?.clientPrice) || 0;
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
        updateModalTotals();
        
        // Загружаем помощников и заполняем поле задания
        loadHelpersForSelect(document.getElementById('orderHelperSelect'), false).then(() => {
            if (order) {
                const helperSelect = document.getElementById('orderHelperSelect');
                const taskDesc = document.getElementById('orderTaskDescription');
                const taskDeadline = document.getElementById('orderTaskDeadline');
                const taskTime = document.getElementById('orderTaskTime');
                const taskPay = document.getElementById('orderTaskPay');
                
                if (helperSelect && order.helperEmail) {
                    helperSelect.value = order.helperEmail;
                }
                if (taskDesc && order.taskDescription) {
                    taskDesc.value = order.taskDescription;
                }
                if (taskDeadline && order.taskDeadline) {
                    taskDeadline.value = order.taskDeadline;
                }
                if (taskTime && order.taskTime) {
                    taskTime.value = order.taskTime;
                }
                if (taskPay && order.taskPay) {
                    taskPay.value = order.taskPay;
                }
            }
        });
        
        // Прокрутка модалки вверх при открытии (только на мобильных)
        if (isMobile) {
            const orderModalInner = orderModal.querySelector('.modal');
            if (orderModalInner) {
                setTimeout(() => { 
                    orderModalInner.scrollTop = 0;
                    // Убеждаемся, что скролл включён
                    orderModalInner.style.overflowY = 'auto';
                    orderModalInner.style.webkitOverflowScrolling = 'touch';
                }, 100);
            }
        }
    }

    function openOrderModalFromCalendar() {
        openOrderModal(null, selectedDate ? formatDate(selectedDate) : undefined);
    }

    function closeOrderModal() {
        const orderModal = document.getElementById('orderModal');
        const isMobile = window.innerWidth <= 768;
        
        // iOS/Android: bottom-sheet анимация закрытия
        if (isMobile) {
            const orderModalInner = orderModal.querySelector('.modal');
            if (orderModalInner) {
                orderModalInner.classList.remove('active');
                setTimeout(function() {
                    orderModalInner.classList.remove('order-modal-bottom-sheet');
                    orderModalInner.style.transition = '';
                    orderModalInner.style.transform = '';
                }, 300);
            }
        }
        
        orderModal.classList.remove('active');
        orderEditId = null;
        currentServices = [];
        // Разблокировать прокрутку фона
        document.body.classList.remove('modal-open');
    }
    
    // ========== iOS/Android: СВАЙП ВНИЗ ДЛЯ ЗАКРЫТИЯ ORDER MODAL ==========
    (function() {
        const orderModal = document.getElementById('orderModal');
        if (!orderModal) return;
        const orderModalInner = orderModal.querySelector('.modal');
        if (!orderModalInner) return;
        
        let touchStartY = 0;
        let touchCurrentY = 0;
        let isSwiping = false;
        
        orderModal.addEventListener('touchstart', function(e) {
            if (orderModalInner.scrollTop <= 0) {
                touchStartY = e.touches[0].clientY;
                isSwiping = true;
                orderModalInner.style.transition = 'none';
            }
        }, { passive: true });
        
        orderModal.addEventListener('touchmove', function(e) {
            if (!isSwiping) return;
            touchCurrentY = e.touches[0].clientY;
            var diff = touchCurrentY - touchStartY;
            if (diff > 0) {
                orderModalInner.style.transform = 'translateY(' + diff + 'px)';
                orderModalInner.style.opacity = Math.max(0, 1 - diff / 300);
                e.preventDefault();
            }
        }, { passive: false });
        
        orderModal.addEventListener('touchend', function() {
            if (!isSwiping) return;
            isSwiping = false;
            var diff = touchCurrentY - touchStartY;
            if (diff > 150) {
                closeOrderModal();
            } else {
                orderModalInner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                orderModalInner.style.transform = '';
                orderModalInner.style.opacity = '';
            }
        }, { passive: true });
    })();
    
    // Универсальные функции для управления модалками
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            // НЕ блокируем скролл body на мобильных — модалка скроллится внутри
            if (window.innerWidth > 768) {
                document.body.classList.add('modal-open');
            }
        }
    }
    
    function closeModalById(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            // Разблокировать скролл body (только на десктопе)
            if (window.innerWidth > 768) {
                document.body.classList.remove('modal-open');
            }
        }
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
        // 1: точное совпадение кода
        const exactCode = references.find(r => String(r.code || '').toLowerCase() === query);
        if (exactCode) return exactCode;
        // 2: точное совпадение названия
        const exactName = references.find(r => String(r.name || '').toLowerCase() === query);
        if (exactName) return exactName;
        // 3: начинается с
        const startsWith = references.find(r => 
            String(r.code || '').toLowerCase().startsWith(query) || 
            String(r.name || '').toLowerCase().startsWith(query));
        if (startsWith) return startsWith;
        // 4: содержит
        const includes = references.find(r => String(r.name || '').toLowerCase().includes(query));
        return includes || null;
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
                <label>Артикул <span style="color:#999;font-size:11px;">(введи код или название)</span></label>
                <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" class="fabric-code" value="${inst.fabric.code||''}" list="fabricCodes" placeholder="Артикул или название" style="flex:1;">
                    <button type="button" class="btn-clear-art" data-target="fabric-code" style="padding:6px 12px;font-size:16px;background:#dc3545;color:#fff;border:none;border-radius:6px;cursor:pointer;min-width:40px;min-height:40px;flex-shrink:0;" title="Очистить артикул">✕</button>
                </div>
                <label>Цена</label><input type="number" class="fabric-price" value="${parseFloat(inst.fabric.price)||0}">
                <label>Метры</label><input type="number" class="fabric-meters" value="${parseFloat(inst.fabric.meters)||0}">
                <label>Стоимость</label><input type="text" class="fabric-cost" readonly>`;
            container.appendChild(div);
            const catInput = div.querySelector('.fabric-category');
            const codeInput = div.querySelector('.fabric-code');
            const clearBtn = div.querySelector('.btn-clear-art');
            const priceInput = div.querySelector('.fabric-price');
            const metersInput = div.querySelector('.fabric-meters');
            const costInput = div.querySelector('.fabric-cost');
            createDatalist('fabricCodes', colors.map(c => c.code));
            
            // Кнопка очистки артикула — полностью очищает все поля ткани
            clearBtn.addEventListener('click', function() {
                inst.fabric = {};
                codeInput.value = '';
                catInput.value = '';
                priceInput.value = '0';
                metersInput.value = '0';
                costInput.value = '0.00';
                updateModalTotals();
                // Показываем подсказку
                codeInput.placeholder = 'Артикул очищен — введи новый';
                setTimeout(() => { codeInput.placeholder = 'Артикул или название'; }, 2000);
            });
            
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
                <label>Артикул <span style="color:#999;font-size:11px;">(введи код или название)</span></label>
                <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" class="paint-code" value="${inst.paint.code||''}" list="paintCodes" placeholder="Артикул или название" style="flex:1;">
                    <button type="button" class="btn-clear-art" data-target="paint-code" style="padding:6px 12px;font-size:16px;background:#dc3545;color:#fff;border:none;border-radius:6px;cursor:pointer;min-width:40px;min-height:40px;flex-shrink:0;" title="Очистить артикул">✕</button>
                </div>
                <label>Цена</label><input type="number" class="paint-price" value="${parseFloat(inst.paint.price)||0}" readonly>
                <label>Мл</label><input type="number" class="paint-qty" value="${parseFloat(inst.paint.qty)||0}">
                <label>Стоимость</label><input type="text" class="paint-cost" readonly>`;
            container.appendChild(div);
            const codeInput = div.querySelector('.paint-code');
            const clearBtn = div.querySelector('.btn-clear-art');
            const priceInput = div.querySelector('.paint-price');
            const qtyInput = div.querySelector('.paint-qty');
            const costInput = div.querySelector('.paint-cost');
            createDatalist('paintCodes', paints.map(p => p.code));
            
            // Кнопка очистки артикула
            clearBtn.addEventListener('click', function() {
                inst.paint = {};
                codeInput.value = '';
                priceInput.value = '0';
                qtyInput.value = '0';
                costInput.value = '0.00';
                updateModalTotals();
                codeInput.placeholder = 'Артикул очищен — введи новый';
                setTimeout(() => { codeInput.placeholder = 'Артикул или название'; }, 2000);
            });
            
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
                <label>Артикул <span style="color:#999;font-size:11px;">(введи код или название)</span></label>
                <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" class="film-code" value="${inst.film.code||''}" list="filmCodes" placeholder="Артикул или название" style="flex:1;">
                    <button type="button" class="btn-clear-art" data-target="film-code" style="padding:6px 12px;font-size:16px;background:#dc3545;color:#fff;border:none;border-radius:6px;cursor:pointer;min-width:40px;min-height:40px;flex-shrink:0;" title="Очистить артикул">✕</button>
                </div>
                <label>Цена</label><input type="number" class="film-price" value="${parseFloat(inst.film.price)||0}" readonly>
                <label>Метры</label><input type="number" class="film-meters" value="${parseFloat(inst.film.meters)||0}">
                <label>Стоимость</label><input type="text" class="film-cost" readonly>`;
            container.appendChild(div);
            const codeInput = div.querySelector('.film-code');
            const clearBtn = div.querySelector('.btn-clear-art');
            const priceInput = div.querySelector('.film-price');
            const metersInput = div.querySelector('.film-meters');
            const costInput = div.querySelector('.film-cost');
            createDatalist('filmCodes', films.map(f => f.code));
            
            // Кнопка очистки артикула
            clearBtn.addEventListener('click', function() {
                inst.film = {};
                codeInput.value = '';
                priceInput.value = '0';
                metersInput.value = '0';
                costInput.value = '0.00';
                updateModalTotals();
                codeInput.placeholder = 'Артикул очищен — введи новый';
                setTimeout(() => { codeInput.placeholder = 'Артикул или название'; }, 2000);
            });
            
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
                // Определяем единицу измерения по коду и названию артикула
                const unitLabel = getUnitFromArticleName(mt.name, null);
                div.innerHTML = `<div class="section-title">${icon} ${mt.name}</div>
                    <label>Артикул <span style="color:#999;font-size:11px;">(введи код или название)</span></label>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <input type="text" class="custom-code" data-mt="${mt.name}" value="${markerData.code||''}" list="${mt.name}Codes" placeholder="Артикул или название" style="flex:1;">
                        <button type="button" class="btn-clear-art" data-target="custom-code-${mt.name}" style="padding:6px 12px;font-size:16px;background:#dc3545;color:#fff;border:none;border-radius:6px;cursor:pointer;min-width:40px;min-height:40px;flex-shrink:0;" title="Очистить артикул">✕</button>
                    </div>
                    <label>Цена за ${unitLabel}</label><input type="number" class="custom-price" value="${markerData.price||0}" readonly>
                    <label>Количество ${unitLabel}</label><input type="number" class="custom-qty" value="${markerData.qty||''}" step="0.1" placeholder="0.0">
                    <label>Стоимость</label><input type="text" class="custom-cost" value="0.00" readonly>`;
                container.appendChild(div);
                const codeInput = div.querySelector('.custom-code');
                const clearBtn = div.querySelector('.btn-clear-art');
                const priceInput = div.querySelector('.custom-price');
                const qtyInput = div.querySelector('.custom-qty');
                const costInput = div.querySelector('.custom-cost');
                createDatalist(`${mt.name}Codes`, mt.articles.map(a => a.code + ' - ' + a.name));
                
                // Кнопка очистки артикула
                clearBtn.addEventListener('click', function() {
                    inst[mt.name] = {};
                    codeInput.value = '';
                    priceInput.value = '0';
                    qtyInput.value = '';
                    costInput.value = '0.00';
                    updateModalTotals();
                    codeInput.placeholder = 'Артикул очищен — введи новый';
                    setTimeout(() => { codeInput.placeholder = 'Артикул или название'; }, 2000);
                });
                
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
                        // Автоматически определяем единицу измерения по коду и названию артикула
                        const detectedUnit = getUnitFromArticleName(art.name, art.code);
                        priceInput.value = parseFloat(art.price)||0;
                        // Обновляем лейблы если единица изменилась
                        const priceLabel = priceInput.parentElement;
                        const qtyLabel = qtyInput.parentElement;
                        if (priceLabel) priceLabel.textContent = `Цена за ${detectedUnit}`;
                        if (qtyLabel) qtyLabel.textContent = `Количество ${detectedUnit}`;
                    }
                    inst[mt.name] = {
                        code: codeInput.value, 
                        price: art ? (parseFloat(art.price)||0) : (parseFloat(priceInput.value)||0), 
                        qty: parseFloat(qtyInput.value) || 0,
                        unit: art ? getUnitFromArticleName(art.name, art.code) : unitLabel
                    };
                    costInput.value = ((parseFloat(inst[mt.name].price)||0) * (parseFloat(inst[mt.name].qty)||0)).toFixed(2);
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
            // Скрываем Клей и Растворитель из отображения (но они считаются в стоимости)
            if (item.name === 'Клей' || item.name === 'Растворитель') return;
            // Скрываем Грунт для пластика из услуги "Восстановление после ДТП"
            if (item.name === 'Грунт для пластика' && inst.serviceName === 'Восстановление после ДТП') return;
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
                        const qty = parseFloat(markerData.sheets || markerData.qty || markerData.m2 || 0);
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
        const taskPay = parseFloat(document.getElementById('orderTaskPay') ? document.getElementById('orderTaskPay').value : '0') || 0;
        document.getElementById('orderGrossProfit').value = (client - totalCost - taskPay).toFixed(2);
    }

    function saveOrderModal() {
        const date = document.getElementById('orderDate').value;
        const client = document.getElementById('orderClient').value.trim();
        const phone = document.getElementById('orderPhone').value.trim();
        const clientPrice = parseFloat(document.getElementById('orderClientPrice').value)||0;
        const durationDays = parseInt(document.getElementById('orderDurationDays').value)||1;
        const done = document.getElementById('orderDone').checked;
        const paid = document.getElementById('orderPaid').checked;
        
        // Читаем данные задания помощнику
        const orderHelperSelect = document.getElementById('orderHelperSelect');
        const helperEmail = orderHelperSelect ? orderHelperSelect.value : '';
        const taskDescription = document.getElementById('orderTaskDescription') ? document.getElementById('orderTaskDescription').value.trim() : '';
        const taskDeadline = document.getElementById('orderTaskDeadline') ? document.getElementById('orderTaskDeadline').value : '';
        const taskTime = document.getElementById('orderTaskTime') ? document.getElementById('orderTaskTime').value : '18:00';
        const taskPay = parseFloat(document.getElementById('orderTaskPay') ? document.getElementById('orderTaskPay').value : '0') || 0;
        
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
        
        // Формируем полный срок с временем
        let fullDeadline = taskDeadline;
        if (fullDeadline && taskTime) {
            fullDeadline = fullDeadline + 'T' + taskTime;
        }
        
        const orderData = {
            id: orderEditId || Date.now(),
            orderNumber: orderEditId ? ordersData.find(o=>o.id===orderEditId)?.orderNumber : finNextOrderNumber(ordersData, localStorage.getItem('lastOrderNumber')),
            date, client, phone, services: servicesCopy, clientPrice, durationDays,
            extraData, done, paid, manualColor: currentManualColor,
            // Данные задания помощнику
            helperEmail: helperEmail,
            taskDescription: taskDescription,
            taskDeadline: taskDeadline,
            taskTime: taskTime,
            taskPay: taskPay
        };
        if (!orderEditId) localStorage.setItem('lastOrderNumber', orderData.orderNumber);
        if (orderEditId) {
            const idx = ordersData.findIndex(o=>o.id===orderEditId);
            if (idx !== -1) ordersData[idx] = orderData;
        } else {
            ordersData.push(orderData);
        }
        
        // Если есть задание помощнику — создаём задачу и уведомляем
        if (helperEmail && taskDescription && taskDeadline) {
            const order = ordersData.find(o => o.id === orderData.id);
            if (order) {
                // Добавляем задачу в первую услугу
                if (!order.services || order.services.length === 0) {
                    order.services = [{serviceName: order.services?.[0]?.serviceName || 'Услуга', tasks: []}];
                }
                if (!order.services[0].tasks) order.services[0].tasks = [];
                
                order.services[0].tasks.push({
                    id: Date.now().toString(),
                    description: taskDescription,
                    deadline: fullDeadline || taskDeadline,
                    assignedTo: helperEmail,
                    helperPay: taskPay,
                    penalty: 0,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                });
                
                // Уведомляем помощника
                notifyHelperAboutTask(helperEmail, orderData.orderNumber, taskDescription);
            }
        }
        
        recalcOrder(orderData);
        recalculateStockFromAllOrders();
        if (paid) {
            // При редактировании существующего оплаченного заказа - удаляем старые транзакции
            if (orderEditId) {
                const existingOrder = ordersData.find(o => o.id === orderEditId);
                if (existingOrder && existingOrder.paid) {
                    removePaymentDistribution(existingOrder.orderNumber);
                }
            }
            distributePayment(orderData);
        }
        saveAll();
        renderAll();
        closeOrderModal();
    }

// Приход по неоплаченному/удалённому заказу убирает finReconcile() (js/finance.js).
// Раньше здесь удалялись все операции кассы с «№N» в описании — в том числе внесённые вручную.
function removePaymentDistribution(orderNumber) {}

// Оплата заказа теперь — приход в кассу, который создаёт finReconcile() (js/finance.js)
// при каждом сохранении. Распределение по копилкам считается из заказов и не пишется в кассу.
function distributePayment(order) {}

// ========== ОЧИСТКА СТАРЫХ ЗАПИСЕЙ ИЗ CASHOPS ==========
function cleanCashOps() {
    const unwantedPatterns = [
        'Налог 4%',
        'Помощнику',
        'Материалы',
        'Личные расходы',
        'Бизнес',
        'Инвестиции',
        'Оплата заказа'
    ];
    
    cashOps = cashOps.filter(op => {
        return !unwantedPatterns.some(pattern => op.desc.includes(pattern));
    });
}

function togglePaid(id, checked) {
    // id бывает и числом, и строкой (новые заказы) — сравниваем как строки
    const order = ordersData.find(o => String(o.id) === String(id));
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

    // ========== МОДУЛЬ 6.2: ДОПОЛНИТЕЛЬНЫЕ РАСХОДНИКИ ==========
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
        document.body.classList.add('modal-open');
    }
    function closeExtraModal() { 
        document.getElementById('extraModal').classList.remove('active');
        document.body.classList.remove('modal-open');
    }
    function saveExtraModal() {
        document.querySelectorAll('.extra-qty').forEach(input => {
            const val = parseFloat(input.value);
            if (val > 0) currentExtraData[input.dataset.name] = val;
            else delete currentExtraData[input.dataset.name];
        });
        document.getElementById('extraModal').classList.remove('active');
        document.body.classList.remove('modal-open');
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

    // ========== МОДУЛЬ 12: ЗАКУПКА МАТЕРИАЛОВ ==========
    function renderPurchaseOrdersList() {
        const container = document.getElementById('purchaseOrdersList');
        container.innerHTML = '';
        ordersData.forEach(order => {
            // Пропускаем выполненные заказы
            if (order.done) return;
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
        
        // Общая сумма закупки
        let totalPurchaseSum = 0;
        
        const markers = { 'Ткань': [], 'Краска': [], 'Пленка': [] };
        materialTypes.forEach(mt => markers[mt.name] = []);
        const otherMaterials = {};
        selectedOrders.forEach(order => {
            order.services.forEach(inst => {
                const svc = rates.find(r => r.service === inst.serviceName);
                if (!svc) return;
                if (svc.usesFabric && inst.fabric && inst.fabric.code) {
                    markers['Ткань'].push({article: inst.fabric.code, name: inst.fabric.colorName || inst.fabric.code, qty: parseFloat(inst.fabric.meters)||0, unit:'м', price: parseFloat(inst.fabric.price)||0});
                }
                if (serviceUsesPaint(svc) && inst.paint && inst.paint.code) {
                    markers['Краска'].push({article: inst.paint.code, name: inst.paint.colorName || inst.paint.code, qty: parseFloat(inst.paint.qty)||0, unit:'мл', price: parseFloat(inst.paint.price)||0});
                }
                if (svc.usesFilm && inst.film && inst.film.code) {
                    markers['Пленка'].push({article: inst.film.code, name: inst.film.name || inst.film.code, qty: parseFloat(inst.film.meters)||0, unit:'м', price: parseFloat(inst.film.price)||0});
                }
                materialTypes.forEach(mt => {
                    const markerData = inst[mt.name];
                    if (markerData && markerData.code) {
                        markers[mt.name].push({article: markerData.code, name: mt.articles.find(a=>a.code===markerData.code)?.name || markerData.code, qty: parseFloat(markerData.qty)||0, unit: mt.unit, price: parseFloat(markerData.price)||0});
                    }
                });
                svc.items.forEach(item => {
                    if (item.customMarker) return;
                    if (item.name === 'Краска' && serviceUsesPaint(svc)) return;
                    if (item.name === 'Пленка для аквапринта' && svc.usesFilm) return;
                    if (item.name === 'Ткань' && svc.usesFabric) return;
                    if (materialTypes.some(mt=>mt.name===item.name)) return;
                    let qty = (inst.manualItems || {})[item.name] ? parseFloat((inst.manualItems || {})[item.name]) : (item.manual ? 0 : (item.perMeter ? (parseFloat(item.quantity)||0)*(parseFloat(inst.fabric?.meters)||0) : (parseFloat(item.quantity)||0)));
                    if (qty > 0) otherMaterials[item.name] = {qty: (parseFloat(otherMaterials[item.name]?.qty || 0)) + qty, price: item.price || 0};
                });
            });
            let extra = {};
            try { extra = JSON.parse(order.extraData || '{}'); } catch(e) {}
            for (let key in extra) {
                const ref = extraRef.find(e => e.name === key);
                if (ref) {
                    otherMaterials[key] = {
                        qty: (parseFloat(otherMaterials[key]?.qty || 0)) + (parseFloat(extra[key])||0),
                        price: ref.price || 0
                    };
                }
            }
        });
        
        // Рендерим маркеры (ткань, краска, плёнка, материалы)
        for (let markerName in markers) {
            if (markers[markerName].length) {
                const section = document.createElement('h3');
                section.textContent = markerName;
                docContainer.appendChild(section);
                const table = document.createElement('table');
                table.innerHTML = '<tr><th>Артикул</th><th>Наименование</th><th>Цена за ед.</th><th>Требуется</th><th>Ед.</th><th>Остаток</th><th>К закупке</th><th>Сумма</th></tr>';
                const grouped = {};
                markers[markerName].forEach(m => {
                    if (!grouped[m.article]) grouped[m.article] = {name:m.name, qty:0, unit:m.unit, price: m.price || 0};
                    grouped[m.article].qty += m.qty;
                    if (m.price > 0) grouped[m.article].price = m.price;
                });
                const stock = loadStock();
                let sectionTotal = 0;
                for (let art in grouped) {
                    const g = grouped[art];
                    const stockItem = stock.find(s => s.name === g.name) || {remain:0};
                    const remain = parseFloat(stockItem.remain) || 0;
                    const toBuy = Math.max(0, g.qty - remain);
                    const itemSum = toBuy * g.price;
                    sectionTotal += itemSum;
                    totalPurchaseSum += itemSum;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${art}</td><td>${g.name}</td><td>${formatMoney(g.price)}</td><td>${g.qty.toFixed(2)}</td><td>${g.unit}</td><td>${remain.toFixed(2)}</td><td><b>${toBuy.toFixed(2)}</b></td><td style="font-weight:600;color:#dc3545;">${formatMoney(itemSum)}</td>`;
                    table.appendChild(tr);
                }
                // Итого по секции
                const totalRow = document.createElement('tr');
                totalRow.style.cssText = 'background:#f8f9fa;font-weight:700;';
                totalRow.innerHTML = `<td colspan="6" style="text-align:right;">Итого по ${markerName}:</td><td style="color:#dc3545;">${formatMoney(sectionTotal)}</td>`;
                table.appendChild(totalRow);
                docContainer.appendChild(table);
            }
        }
        
        // Прочие расходники
        if (Object.keys(otherMaterials).length) {
            const section = document.createElement('h3');
            section.textContent = 'Прочие расходники';
            docContainer.appendChild(section);
            const table = document.createElement('table');
            table.innerHTML = '<tr><th>Материал</th><th>Цена за ед.</th><th>Требуется</th><th>Ед.</th><th>Остаток</th><th>К закупке</th><th>Сумма</th></tr>';
            const stock = loadStock();
            let sectionTotal = 0;
            for (let name in otherMaterials) {
                const data = otherMaterials[name];
                const ref = extraRef.find(e=>e.name===name) || {unit:'шт', price:0};
                const stockItem = stock.find(s => s.name === name) || {remain:0};
                const remain = parseFloat(stockItem.remain) || 0;
                const toBuy = Math.max(0, data.qty - remain);
                const itemSum = toBuy * (data.price || ref.price || 0);
                sectionTotal += itemSum;
                totalPurchaseSum += itemSum;
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${name}</td><td>${formatMoney((data.price || ref.price || 0))}</td><td>${data.qty.toFixed(2)}</td><td>${ref.unit}</td><td>${remain.toFixed(2)}</td><td><b>${toBuy.toFixed(2)}</b></td><td style="font-weight:600;color:#dc3545;">${formatMoney(itemSum)}</td>`;
                table.appendChild(tr);
            }
            // Итого по секции
            const totalRow = document.createElement('tr');
            totalRow.style.cssText = 'background:#f8f9fa;font-weight:700;';
            totalRow.innerHTML = `<td colspan="6" style="text-align:right;">Итого по прочим расходникам:</td><td style="color:#dc3545;">${formatMoney(sectionTotal)}</td>`;
            table.appendChild(totalRow);
            docContainer.appendChild(table);
        }
        
        // ИТОГО ЗАКУПКА
        if (totalPurchaseSum > 0) {
            const totalDiv = document.createElement('div');
            totalDiv.style.cssText = 'background:#fff3cd;padding:15px;border-radius:8px;margin-top:15px;border-left:4px solid #ffc107;font-size:18px;font-weight:700;';
            totalDiv.innerHTML = `💰 ИТОГО К ОПЛАТЕ: <span style="color:#dc3545;">${formatMoney(totalPurchaseSum)}</span>`;
            docContainer.appendChild(totalDiv);
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

    // ========== МОДУЛЬ 13: ЭКСПОРТ/ИМПОРТ ДАННЫХ ==========
    function exportData() {
        const data = {colors, paints, films, extraRef, rates, ordersData, cashOps, bookings, materialTypes, regularExpenses, regularIncomes, notes, lastOrderNumber: localStorage.getItem('lastOrderNumber'), stock: loadStock()};
        const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_${formatDate(new Date())}.json`;
        a.click();
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
        const orderNumber = finNextOrderNumber(ordersData, localStorage.getItem('lastOrderNumber'));
        localStorage.setItem('lastOrderNumber', orderNumber);
        const svc = rates.find(r => r.service === service);
        const orderData = {
            id: Date.now(),
            orderNumber,
            date, client:name, phone,
            services: [{serviceName:service, usesFabric:svc?.usesFabric, usesPaint:serviceUsesPaint(svc), usesFilm:svc?.usesFilm, fabric:{}, paint:{}, film:{}, manualItems:{}}],
            clientPrice:0, durationDays:duration, extraData:'{}', done:false, paid:false, manualColor:'auto'
        };
        ordersData.push(orderData);
        recalculateStockFromAllOrders();
        saveAll(); // Вызов единой внешней функции сохранения
        closeModal();
        renderAll();
   
   }
      function closeModal() { 
          const modal = document.getElementById('bookingModal');
          if (modal) {
              modal.classList.remove('active');
              document.body.classList.remove('modal-open');
          }
      }

     // ========== МОДУЛЬ 10: КАЛЕНДАРЬ И ЗАМЕТКИ ==========
     
    // Календарь: только заказы и расходы, без распределения бюджета
    function getRegularPaymentsForDate(dateStr) {
        return []; // Убрано: регулярные платежи не показываются в календаре
    }

    function getRegularIncomesForDate(dateStr) {
        return []; // Убрано: регулярные доходы не показываются в календаре
    }

    function renderCalendar() {
        // Проверяем авторизацию
        if (!window.currentUserData) {
            const grid = document.getElementById('calendarGrid');
            if (grid) {
                grid.innerHTML = '<div style="text-align:center;padding:40px;color:#888;font-size:18px;">🔒 Для просмотра календаря необходимо <b>войти в систему</b></div>';
            }
            return;
        }
        
        // Обновляем фильтр услуг
        document.getElementById('serviceFilterContainer').innerHTML = getServiceFilterButtons();
        
        // Обновляем сводку
        renderCalendarSummary();
        
        // Проверяем уведомления
        checkTomorrowNotifications();
        
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;
        
        if (calendarViewMode === 'week') {
            renderWeekView();
            return;
        }
        
        const year = currentDate.getFullYear(), month = currentDate.getMonth();
        const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        const calendarTitle = document.getElementById('calendarTitle');
        if (calendarTitle) calendarTitle.textContent = `${months[month]} ${year}`;
        
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
            const dayNotes = notes.filter(n => n.date === dateStr);
            // Оплаченные обязательные платежи показываются как платежи (💳), а не как расходы
            const cashPayments = cashOps.filter(op => op.date === dateStr && parseFloat(op.expense) > 0 && !op.paymentId);
            const dayDuePayments = finPaymentsForDate(dateStr);
            
            // Определяем цвет дня по приоритету
            let classes = `day-cell${isSelected?' selected':''}`;
            let dayBadge = { orders: 0, notes: 0, expenses: 0, payments: 0 };
            
            // Считаем количество записей
            dayBadge.orders = dayOrders.length;
            dayBadge.notes = dayNotes.length;
            dayBadge.expenses = cashPayments.length;
            dayBadge.payments = dayDuePayments.length;
            if (dayDuePayments.some(x => x.status.state === 'overdue')) classes += ' pay-overdue';
            
            // Определяем цвет дня (приоритет: красный > жёлтый > зелёный > синий)
            if (criticalOrder) {
                // Очень срочный заказ - красный (переопределяет всё)
                classes += ' color-critical';
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
            
            // Вставляем цифру дня
            const dayNum = document.createElement('span');
            dayNum.className = 'day-number';
            dayNum.textContent = d;
            div.appendChild(dayNum);
            
            // Показываем значки с количеством
            let badgeText = [];
            if (dayBadge.orders > 0) badgeText.push(`📋${dayBadge.orders}`);
            if (dayBadge.notes > 0) badgeText.push(`📝${dayBadge.notes}`);
            if (dayBadge.expenses > 0) badgeText.push(`💰${dayBadge.expenses}`);
            if (dayBadge.payments > 0) badgeText.push(`💳${dayBadge.payments}`);
            
            if (badgeText.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'task-badge';
                badge.textContent = badgeText.join('+');
                badge.style.cssText = 'font-size:9px; line-height:1.2; padding:2px 4px; max-width:50px; word-wrap:break-word;';
                div.appendChild(badge);
            }
            
            div.title = `${dateStr}\nЗаказов: ${dayBadge.orders}\nЗаметок: ${dayBadge.notes}\nРасходов: ${dayBadge.expenses}` +
                dayDuePayments.map(x => `\n💳 ${x.p.name}: ${formatMoney(x.p.amount)}${x.status.state === 'paid' ? ' ✅' : x.status.state === 'overdue' ? ' — просрочен' : ''}`).join('');
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
        const dayPayments = cashOps.filter(op => op.date === dateStr && parseFloat(op.expense) > 0 && !op.paymentId && !op.desc.includes('Оплата заказа'));
        const dayDuePayments = finPaymentsForDate(dateStr);
        // Обязательные платежи по плану на этот день
        dayDuePayments.forEach(({ p, status }) => {
            const div = document.createElement('div');
            div.className = `schedule-slot payment-slot due-${status.state}`;
            const label = status.state === 'paid' ? `✅ оплачено ${formatDateDDMMYYYY(status.op.date)}`
                : status.state === 'overdue' ? '🔴 просрочен' : '🕒 к оплате';
            const debt = finDebtRemaining(p, cashOps);
            div.innerHTML = `<div>💳 ${safeHTML(p.name)} – ${formatMoney(p.amount)} · ${label}` +
                (debt !== null ? `<div class="fin-muted">долг: осталось ${formatMoney(debt)}</div>` : '') + `</div>` +
                (status.state === 'paid' ? '' : `<button class="fin-pay-btn" onclick="event.stopPropagation(); finPayFromCalendar('${escAttr(p.id)}', '${dateStr}')">Оплатил</button>`);
            grid.appendChild(div);
        });
        const dayIncomes = cashOps.filter(op => op.date === dateStr && parseFloat(op.income) > 0 && !op.desc.includes('Оплата заказа'));
        const dayNotes = notes.filter(n => n.date === dateStr);
        dayPayments.forEach(p => {
            const div = document.createElement('div');
            div.className = 'schedule-slot payment-slot';
            div.innerHTML = `<div>💰 ${safeHTML(p.desc)} – ${formatMoney((parseFloat(p.expense)||0))}</div>`;
            grid.appendChild(div);
        });
        dayIncomes.forEach(income => {
            const div = document.createElement('div');
            div.className = 'schedule-slot';
            div.style.background = '#d4edda';
            div.style.borderColor = '#28a745';
            div.innerHTML = `<div>💵 ${safeHTML(income.desc)} – ${formatMoney((parseFloat(income.income)||0))}</div>`;
            grid.appendChild(div);
        });
        dayNotes.forEach(n => {
            const div = document.createElement('div');
            div.className = 'schedule-slot note-slot';
            div.innerHTML = `<div>📝 ${safeHTML(n.time ? n.time + ' ' : '')}${safeHTML(n.text)}</div><button class="btn-del" onclick="deleteNote(${n.id})">✕</button>`;
            grid.appendChild(div);
        });
        dayOrders.forEach(order => {
            const color = getOrderColorObj(order);
            const div = document.createElement('div');
            div.className = `schedule-slot color-${color}`;
            div.innerHTML = `<div>№${safeHTML(order.orderNumber)} ${safeHTML(order.client)} – ${safeHTML(order.services.map(s=>s.serviceName).join(', '))}</div><div>${formatMoney((parseFloat(order.clientPrice)||0))}</div>`;
            div.addEventListener('click', () => openOrderModal(order.id));
            grid.appendChild(div);
        });
        if (dayOrders.length === 0 && dayPayments.length === 0 && dayIncomes.length === 0 && dayNotes.length === 0 && dayDuePayments.length === 0) {
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
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        selectedDate = tomorrow;
        // Если в режиме месяца — не меняем currentDate, чтобы не сдвигать календарь
        // Если в режиме недели — показываем неделю с завтрашнего дня
        if (calendarViewMode === 'week') {
            currentDate = new Date(tomorrow);
        }
        renderCalendar();
    }
    
    // ========== ФИЛЬТР ПО УСЛУГАМ ==========
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
            <span style="color:#28a745;">💰 Прогноз: ${formatMoney(summary.sum)}</span>
            <span style="color:#6c757d;">📅 ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}</span>
            ${finCalendarPaymentsSummaryHTML(formatDate(currentDate).slice(0, 7))}
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
            
            // Показываем обязательные платежи этого дня
            finPaymentsForDate(dateStr).forEach(({ p, status }) => {
                const payBadge = document.createElement('div');
                const colors = { paid: '#d4edda;color:#155724', overdue: '#f8d7da;color:#721c24', due: '#e2e3f5;color:#383d7c' };
                payBadge.style.cssText = `font-size:10px; margin-top:2px; padding:2px 4px; border-radius:4px; background:${colors[status.state]};`;
                payBadge.textContent = `💳 ${p.name}${status.state === 'paid' ? ' ✅' : ''}`;
                div.appendChild(payBadge);
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
                html += '<li>№' + safeHTML(o.orderNumber) + ' ' + safeHTML(o.client) + ' – ' + safeHTML(o.services.map(s=>s.serviceName).join(', ')) + ' (' + colorName + ')</li>';
            });
            html += '</ul></div>';
        }
        
        if (notes.length > 0) {
            html += '<div class="notification-item notes">';
            html += '<div class="notification-title">📝 Заметок: ' + notes.length + '</div>';
            html += '<ul class="notification-list">';
            notes.forEach(n => {
                html += '<li>' + safeHTML(n.text) + '</li>';
            });
            html += '</ul></div>';
        }
        
        if (payments.length > 0) {
            html += '<div class="notification-item payments">';
            html += '<div class="notification-title">💰 Регулярные платежи:</div>';
            html += '<ul class="notification-list">';
            payments.forEach(p => {
                html += '<li>' + safeHTML(p.desc) + ' – ' + formatMoney(p.expense) + '</li>';
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
        document.body.classList.add('modal-open');
    }
    function closeNoteModal() { 
        document.getElementById('noteModal').classList.remove('active');
        document.body.classList.remove('modal-open');
    }
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

    // ========== МОДУЛЬ 14: UI И РЕНДЕРИНГ ==========
    function renderAll() {
        console.log('renderAll вызван, ordersData.length:', ordersData.length);
        // Если appContent скрыт — ничего не рендерим
        const appContent = document.getElementById('appContent');
        if (appContent && appContent.style.display === 'none') {
            return;
        }
        
        renderOrders();
        renderStock();
        renderCash();
        populateSummarySelects();
        renderSummary();
        renderCalendar();
        renderRefs();
        renderPurchaseOrdersList();
        updateUnpaidSummary();
        // Рендеринг для помощника (любой не-админ)
        if (window.currentUserData && window.currentUserData.role !== 'admin') {
            renderHelperTasks();
            renderHelperReport();
        }
        renderNotices();
        renderAttendance();
    }
    
    // Делаем renderAll глобально доступной
    window.renderAll = renderAll;

    // ========== МОДУЛЬ 7: СПРАВОЧНИКИ (ткани, краски, плёнки, расходники) ==========
    function renderRefs() {
        renderServicesTable();
        renderMarkersTable();
        // renderMaterialTypes() — удалён: элемент materialTypesContainer отсутствует в HTML
        // Материалы отображаются через renderMarkersTable() (вибро/шумоизоляция)
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
        
        // Сортируем: новые заказы сверху (по дате создания/номеру)
        const sortedOrders = [...ordersData].sort((a, b) => {
            // Сначала по дате (новые сверху)
            if (a.date && b.date) {
                if (a.date !== b.date) return b.date.localeCompare(a.date);
            }
            // Если даты равны - по ID (новые сверху)
            return String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true });
        });
        
        sortedOrders.forEach(order => {
            const color = getOrderColorObj(order);
            const show = filterCheck(order, currentFilter);
            if (!show) return;
            
            // Фильтр по датам
            if (currentOrderDateFrom && order.date < currentOrderDateFrom) return;
            if (currentOrderDateTo && order.date > currentOrderDateTo) return;
            
            const div = document.createElement('div');
            div.className = 'order-item';
            
            // Цвета срочности через inline style для гарантии
            const colorStyles = {
                'new': 'background:#d4edda;border-color:#28a745;',
                'middle': 'background:#fff3cd;border-color:#ffc107;',
                'critical': 'background:#f8d7da;border-color:#dc3545;',
                'done': 'background:#e9ecef;border-color:#6c757d;'
            };
            div.style.cssText = colorStyles[color] || '';
            
            // Считаем количество задач
            let taskCount = 0;
            (order.services || []).forEach(s => { taskCount += (s.tasks || []).length; });
            
            // Форматируем дату в ДД.ММ.ГГГГ
            const formattedDate = formatDateDDMMYYYY(order.date);
            const formattedDeadline = formatDateDDMMYYYY(getDeadline(order));
            
            div.innerHTML = `
                <div class="order-header">
                    <span class="order-number">№${safeHTML(order.orderNumber)}</span>
                    <span class="order-date">${safeHTML(formattedDate)}</span>
                    <span class="order-deadline">${safeHTML(formattedDeadline)}</span>
                    <span class="order-client">${safeHTML(order.client)}</span>
                    <span class="order-phone">${safeHTML(order.phone||'')}</span>
                    <span class="order-service">${safeHTML(order.services.map(s => s.serviceName).join(', '))}</span>
                    <span class="order-sum ${order.paid?'paid':'unpaid'}">${formatMoney((parseFloat(order.clientPrice)||0))}</span>
                    <span class="order-paid"><input type="checkbox" ${order.paid?'checked':''} onchange="togglePaid(${escAttr(JSON.stringify(String(order.id)))}, this.checked)"> Оплачено</span>
                    <span class="color-indicator ${color}"></span>
                    <button class="btn-extra" onclick="event.stopPropagation(); openHelperTaskModal(${safeHTML(order.orderNumber)})" title="Добавить задачу">📝 Задача${taskCount > 0 ? ' (' + taskCount + ')' : ''}</button>
                </div>`;
            div.onclick = (e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') openOrderModal(order.id); };
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
        document.getElementById('unpaidSum').textContent = formatNumber(unpaid.reduce((s,o)=>s+(parseFloat(o.clientPrice)||0),0));
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
            const totalSum = (parseFloat(item.price)||0) * (parseFloat(item.income)||0);
            // data-label — подписи ячеек для вида карточками на телефоне
            tr.innerHTML = `
                <td class="stock-name" data-label="Материал">${safeHTML(name)}</td>
                <td data-label="Ед.">${safeHTML(item.unit)}</td>
                <td data-label="Цена">${formatNumber(item.price)}</td>
                <td data-label="Приход"><input type="number" class="stock-income" value="${parseFloat(item.income)||0}" data-name="${escAttr(name)}"></td>
                <td data-label="Расход"><input type="number" class="stock-used" value="${parseFloat(item.used)||0}" data-name="${escAttr(name)}"></td>
                <td data-label="Остаток">${formatNumber((parseFloat(item.income)||0) - (parseFloat(item.used)||0))}</td>
                <td data-label="Сумма" style="font-weight:600;color:#27ae60;">${formatMoney(totalSum)}</td>
                <td class="stock-del"><button class="btn-del" onclick="deleteStockItem(${escAttr(JSON.stringify(name))})" title="Удалить">🗑️</button></td>`;
            tbody.appendChild(tr);
        });
        applyStockSearch();
        // Делегирование: обработчик вешаем один раз (раньше он добавлялся при каждой перерисовке)
        if (tbody.dataset.bound) return;
        tbody.dataset.bound = '1';
        tbody.addEventListener('change', (e) => {
            const input = e.target;
            if (!input || !input.dataset.name) return;
            const name = input.dataset.name;
            const val = parseFloat(input.value) || 0;
            const stock = loadStock();
            let item = stock.find(s => s.name === name);
            if (!item) {
                // Материала ещё нет в учёте склада — заводим, иначе введённое значение терялось
                item = {name, unit:'шт', price:0, income:0, used:0, remain:0};
                stock.push(item);
            }
            if (input.classList.contains('stock-income')) {
                item.income = val;
            } else if (input.classList.contains('stock-used')) {
                item.used = val;
            }
            saveStock(stock);
            if (typeof window.markChanged === 'function') window.markChanged(); // склад синхронизируется
            renderStock();
        });
    }

    // Поиск по складу: скрываем строки, где название не содержит запрос
    function applyStockSearch() {
        const input = document.getElementById('stockSearch');
        const query = (input ? input.value : '').trim().toLowerCase();
        document.querySelectorAll('#stockBody tr').forEach(tr => {
            const nameCell = tr.querySelector('.stock-name');
            const name = nameCell ? nameCell.textContent.toLowerCase() : '';
            tr.style.display = !query || name.includes(query) ? '' : 'none';
        });
    }
    window.applyStockSearch = applyStockSearch;

    function deleteStockItem(name) {
        if (!confirm(`Удалить позицию "${name}" из склада?`)) return;
        const stock = loadStock();
        const filtered = stock.filter(s => s.name !== name);
        saveStock(filtered);
        if (typeof window.markChanged === 'function') window.markChanged(); // склад синхронизируется
        renderStock();
    }

    // ========== МОДУЛЬ 11: ИТОГИ И ОТЧЁТЫ ==========
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
        
        // Отчёт-«водопад» и план месяца — js/finance.js
        renderFinanceSummary(startDate, endDate);
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
            ordersData.push({id:Date.now() + index, orderNumber:index + 1, date:sample.date, client:sample.client, phone:'+7 900 000-00-0' + (index + 1), services:[service], clientPrice:sample.clientPrice, durationDays:sample.durationDays, extraData:'{}', done:sample.done, paid:false, manualColor:'auto'});
        });
        ordersData.forEach(order => recalcOrder(order));
        recalculateStockFromAllOrders();
        saveAll();
    }

    // ========== МОДУЛЬ 16: ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ ==========
    function addRegularPaymentsToCash() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        
        // ИСПРАВЛЕНО: удаляем платежи за предыдущие месяцы, которые уже прошли
        // Оставляем только платежи за текущий и будущие месяцы
        cashOps = cashOps.filter(op => {
            if (!op.date) return true;
            const opYear = parseInt(op.date.substring(0, 4));
            const opMonth = parseInt(op.date.substring(5, 7));
            // Удаляем платежи за прошлые месяцы
            if (opYear < year || (opYear === year && opMonth < month)) {
                return false;
            }
            return true;
        });
        
        // Добавляем регулярные расходы для текущего месяца
        regularExpenses.forEach(exp => {
            const dateStr = `${monthPrefix}-${String(exp.day).padStart(2, '0')}`;
            const exists = cashOps.some(op => op.desc === exp.desc && op.date === dateStr);
            if (!exists) {
                cashOps.push({date: dateStr, desc: exp.desc, income: 0, expense: exp.amount});
            }
        });
        
        // Добавляем регулярные доходы для текущего месяца
        regularIncomes.forEach(income => {
            const dateStr = `${monthPrefix}-${String(income.day).padStart(2, '0')}`;
            const exists = cashOps.some(op => op.desc === income.desc && op.date === dateStr);
            if (!exists) {
                cashOps.push({date: dateStr, desc: income.desc, income: income.amount, expense: 0});
            }
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

// ========== СЛИЯНИЕ ДАННЫХ С ОБЛАКОМ (БЕЗ ПОТЕРЬ) ==========
// У облака есть номер версии (rev). Устройство помнит, с какой версией оно синхронизировано
// (cloud_rev), и есть ли у него неотправленные изменения (cloud_dirty).
const SYNC_KEYS = ['colors', 'paints', 'films', 'extraRef', 'rates', 'ordersData', 'cashOps', 'bookings', 'materialTypes', 'regularExpenses', 'regularIncomes', 'notes', 'payments', 'financeSettings', 'helperNotices', 'helperPenalties', 'attendance', 'helperSchedules'];

function syncToArray(value) {
    if (Array.isArray(value)) return value.filter(item => item != null);
    if (value && typeof value === 'object') return Object.values(value).filter(item => item != null);
    return [];
}

// Каноническая запись значения: ключи по алфавиту, без пустых полей — как хранит Firebase.
// Без этого одна и та же запись на устройстве и в облаке выглядела по-разному
// (Firebase отдаёт поля по алфавиту), и операции кассы удваивались при слиянии.
function syncCanon(value) {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
        const list = value.map(syncCanon).filter(v => v !== undefined);
        return list.length ? list : undefined;
    }
    if (typeof value === 'object') {
        const out = {};
        Object.keys(value).sort().forEach(key => {
            const v = syncCanon(value[key]);
            if (v !== undefined) out[key] = v;
        });
        return Object.keys(out).length ? out : undefined;
    }
    return value;
}
function syncCanonJSON(value) {
    return JSON.stringify(syncCanon(value)) || '';
}

function syncItemKey(item) {
    if (item && typeof item === 'object') {
        if (item.id != null) return 'id:' + item.id;
        if (item.service != null) return 'service:' + item.service;
        if (item.code) return 'code:' + item.code;
        if (item.desc != null && item.day != null) return 'regular:' + String(item.desc).trim().toLowerCase();
        if (item.name != null && item.date == null) return 'name:' + String(item.name).trim().toLowerCase();
    }
    return 'json:' + syncCanonJSON(item);
}

// ========== ТРЁХСТОРОННЕЕ СЛИЯНИЕ ==========
// База — облачная версия, с которой устройство было синхронизировано последний раз.
// По каждой записи: не меняли на устройстве — берём облако; не меняли в облаке — берём своё;
// меняли и там, и там — правка устройства (удаление не побеждает правку).
function loadSyncBase() {
    try { return JSON.parse(localStorage.getItem('cloud_base') || 'null'); } catch (e) { return null; }
}
window.setSyncBase = function(data) {
    try {
        const base = {};
        SYNC_KEYS.concat('stock').forEach(key => { base[key] = syncToArray(data && data[key]); });
        localStorage.setItem('cloud_base', JSON.stringify(base));
    } catch (e) {
        localStorage.removeItem('cloud_base'); // нет места — без базы слияние будет простым объединением
    }
};
function mergeThreeWay(localList, baseList, cloudList) {
    const group = list => {
        const map = new Map();
        syncToArray(list).forEach(item => {
            const key = syncItemKey(item);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(item);
        });
        return map;
    };
    const L = group(localList), B = group(baseList), C = group(cloudList);
    const same = (a, b) => syncCanonJSON(a) === syncCanonJSON(b);
    const keys = [...new Set([...C.keys(), ...L.keys()])];
    const result = [];
    keys.forEach(key => {
        const l = L.get(key) || [], b = B.get(key) || [], c = C.get(key) || [];
        let pick;
        if (same(l, b)) pick = c;
        else if (same(c, b)) pick = l;
        else if (key.startsWith('json:')) {
            // одинаковые записи без id: сколько добавили/удалили на устройстве и в облаке
            const count = Math.max(0, c.length + l.length - b.length);
            pick = Array(count).fill(c[0] || l[0]);
        } else pick = l.length ? l : c;
        result.push(...pick);
    });
    return result;
}

// Объединяет два списка: ничего не теряется, при совпадении берётся локальная версия.
// Одинаковые записи без id (например, две одинаковые операции кассы) учитываются по количеству.
function mergeSyncLists(localList, cloudList) {
    const result = [];
    const localCount = new Map();
    syncToArray(localList).forEach(item => {
        const key = syncItemKey(item);
        localCount.set(key, (localCount.get(key) || 0) + 1);
        result.push(item);
    });
    const cloudSeen = new Map();
    syncToArray(cloudList).forEach(item => {
        const key = syncItemKey(item);
        const seen = (cloudSeen.get(key) || 0) + 1;
        cloudSeen.set(key, seen);
        if (seen > (localCount.get(key) || 0)) result.push(item);
    });
    return result;
}

window.syncHasData = function(data) {
    return !!data && SYNC_KEYS.some(key => syncToArray(data[key]).length > 0);
};

// Полностью берёт облачную версию (устройство было синхронизировано и ничего не меняло)
function applyCloudVersion(data) {
    colors = syncToArray(data.colors);
    paints = syncToArray(data.paints);
    films = syncToArray(data.films);
    extraRef = syncToArray(data.extraRef);

    // rates обновляем только если нет локальных изменений
    const localRates = JSON.parse(localStorage.getItem('rates_data') || '[]');
    if (localChangesPending) {
        // Есть локальные изменения — оставляем локальные rates
        console.log("[Sync] Пропускаем обновление rates из облака (есть локальные изменения)");
    } else {
        rates = syncToArray(data.rates).map(cloudService => {
            const localService = localRates.find(service => service.service === cloudService.service);
            if (!localService) return cloudService;
            const cloudItems = cloudService.items || [];
            const localItems = localService.items || [];
            const localNames = new Set(localItems.map(item => String(item.name || '').trim().toLowerCase()));
            const cloudOnlyItems = cloudItems.filter(item => !localNames.has(String(item.name || '').trim().toLowerCase()));
            return {...cloudService, ...localService, items: [...localItems, ...cloudOnlyItems]};
        });
        localRates.forEach(localService => {
            if (!rates.some(service => service.service === localService.service)) rates.push(localService);
        });
    }

    ordersData = syncToArray(data.ordersData);
    cashOps = syncToArray(data.cashOps);
    bookings = syncToArray(data.bookings);

    // materialTypes обновляем только если нет локальных изменений
    const localMaterialTypes = JSON.parse(localStorage.getItem('materialTypes_data') || '[]');
    if (localChangesPending) {
        console.log("[Sync] Пропускаем обновление materialTypes из облака (есть локальные изменения)");
    } else {
        materialTypes = syncToArray(data.materialTypes).map(cloudType => {
            const localType = localMaterialTypes.find(type => String(type.name || '').trim().toLowerCase() === String(cloudType.name || '').trim().toLowerCase());
            return localType ? {...cloudType, ...localType} : cloudType;
        });
        localMaterialTypes.forEach(localType => {
            if (!materialTypes.some(type => String(type.name || '').trim().toLowerCase() === String(localType.name || '').trim().toLowerCase())) materialTypes.push(localType);
        });
    }

    regularExpenses = syncToArray(data.regularExpenses);
    regularIncomes = syncToArray(data.regularIncomes);
    notes = syncToArray(data.notes);
    payments = syncToArray(data.payments);
    financeSettings = syncToArray(data.financeSettings);
    helperNotices = syncToArray(data.helperNotices);
    helperPenalties = syncToArray(data.helperPenalties);
    attendance = syncToArray(data.attendance);
    helperSchedules = syncToArray(data.helperSchedules);
}

// ========== РЕЖИМ ВОССТАНОВЛЕНИЯ ==========
// true: при загрузке из облака записи на устройстве НЕ удаляются — только объединяются с облачными
// (так 25.10.2026 возвращали данные с устройств). Минус: удаление на одном устройстве
// может вернуться с другого. Выключен — устройство без своих правок берёт облачную версию целиком.
const RECOVERY_MERGE_ONLY = false;

// Тестовые заказы (createSampleOrders), случайно попавшие в облако при проверке 25.10.2026.
// Узнаются по имени «Тест … N» и телефону «+7 900 000-00-0N» одновременно.
function isSampleOrder(order) {
    return !!order &&
        /^Тест (выполнен|срочный|очень срочный|новый) \d+$/.test(order.client || '') &&
        /^\+7 900 000-00-0\d{1,2}$/.test(order.phone || '');
}

// Есть ли в списке записи, которых нет в облачном списке
function hasRecordsMissingInCloud(list, cloudList) {
    return mergeSyncLists(cloudList, list).length > syncToArray(cloudList).length;
}

// Резервная копия данных устройства перед слиянием (3 последние, в localStorage)
function backupLocalData(reason) {
    const local = window.getSyncData();
    if (!syncToArray(local.ordersData).length && !syncToArray(local.cashOps).length) return; // пустое не храним
    try {
        for (let i = 3; i > 1; i--) {
            const prev = localStorage.getItem('sync_backup_' + (i - 1));
            if (prev !== null) localStorage.setItem('sync_backup_' + i, prev);
        }
        localStorage.setItem('sync_backup_1', JSON.stringify({ savedAt: new Date().toISOString(), reason, data: local }));
    } catch (e) {
        console.warn('[Sync] Не удалось сохранить резервную копию:', e);
    }
}

// Сливает локальные данные с облачными без потерь.
// preferLocal: при совпадении записи берётся версия устройства (у него неотправленные правки),
// иначе — облачная (чтобы правки с других устройств доходили).
function applyMergedVersion(data, preferLocal) {
    const local = window.getSyncData();
    const base = loadSyncBase();
    // Есть база — трёхстороннее слияние по каждой записи; нет (первый раз) — объединение
    const merge = key => base
        ? mergeThreeWay(local[key], base[key], data[key])
        : (preferLocal ? mergeSyncLists(local[key], data[key]) : mergeSyncLists(data[key], local[key]));
    colors = merge('colors');
    paints = merge('paints');
    films = merge('films');
    extraRef = merge('extraRef');
    rates = merge('rates');
    ordersData = merge('ordersData');
    cashOps = merge('cashOps');
    bookings = merge('bookings');
    materialTypes = merge('materialTypes');
    regularExpenses = merge('regularExpenses');
    regularIncomes = merge('regularIncomes');
    notes = merge('notes');
    payments = merge('payments');
    financeSettings = merge('financeSettings');
    helperNotices = merge('helperNotices');
    helperPenalties = merge('helperPenalties');
    attendance = merge('attendance');
    helperSchedules = merge('helperSchedules');
}

window.updateCloudData = function(data) {
    data = data || {};
    const cloudRev = Number(data.rev) || 0;
    const storedRev = localStorage.getItem('cloud_rev');
    const everSynced = storedRev !== null;
    const localRev = Number(storedRev) || 0;
    const dirty = localStorage.getItem('cloud_dirty') === '1';
    const localHasData = window.syncHasData(window.getSyncData());

    // Облако пустое — локальные данные не трогаем, а если они есть — отправляем их в облако
    if (!window.syncHasData(data)) {
        console.log("[Sync] Облако пусто — оставляем локальные данные");
        if (localHasData && typeof window.markChanged === 'function') window.markChanged();
        return;
    }

    // Устройство уже синхронизировано с этой версией
    if (everSynced && cloudRev === localRev) {
        // Первый запуск с синхронизацией склада: если в облаке склада ещё нет, отправляем свой
        if (!localStorage.getItem('stock_synced') && !syncToArray(data.stock).length &&
            loadStock().some(s => (parseFloat(s.income) || 0) > 0) && typeof window.markChanged === 'function') {
            localStorage.setItem('stock_synced', '1');
            window.markChanged();
        }
        // Перенос старых финансовых записей на уже синхронизированном устройстве
        const renumbered = finFixDuplicateOrderNumbers(ordersData).length > 0;
        if ((finMigrate(true) || renumbered) && typeof window.markChanged === 'function') {
            saveAll(true);
            window.markChanged();
            renderAll();
        }
        return;
    }

    let needUpload = false;
    const canReplace = !RECOVERY_MERGE_ONLY && everSynced && !dirty && cloudRev > localRev;
    if (canReplace || !localHasData) {
        // Устройство ничего не меняло (или пустое) — берём облачную версию целиком
        console.log('[Sync] Загружаю версию', cloudRev, 'из облака');
        applyCloudVersion(data);
    } else {
        // Сливаем без потерь: записи устройства сохраняются
        console.log('[Sync] Сливаю локальные данные с облачной версией', cloudRev);
        backupLocalData('перед слиянием с версией ' + cloudRev);
        applyMergedVersion(data, dirty || !everSynced);
        // Отправляем, только если у устройства есть записи, которых нет в облаке
        // (иначе устройства бесконечно перекладывали бы одно и то же)
        needUpload = SYNC_KEYS.some(key => hasRecordsMissingInCloud(window.getSyncData()[key], data[key]));
    }

    // Убираем тестовые заказы; если они были в облаке — облако нужно обновить
    if (syncToArray(data.ordersData).some(isSampleOrder)) needUpload = true;
    ordersData = ordersData.filter(order => !isSampleOrder(order));

    // Склад: «расход» пересчитывается из заказов на каждом устройстве, поэтому синхронизируем
    // позиции и «приход». Позиции объединяются по названию (удалённая может вернуться с другого устройства).
    const localStock = loadStock();
    const cloudStock = syncToArray(data.stock);
    let stock;
    if (!localStorage.getItem('stock_synced')) {
        // Первая синхронизация склада: по совпадающим позициям берём больший приход,
        // чтобы устройство с нулями не затёрло приход, введённый на другом
        stock = mergeSyncLists(cloudStock, localStock).map(item => {
            const local = localStock.find(s => s.name === item.name);
            return local && (parseFloat(local.income) || 0) > (parseFloat(item.income) || 0) ? { ...item, income: local.income } : item;
        });
        localStorage.setItem('stock_synced', '1');
    } else {
        const base = loadSyncBase();
        stock = base ? mergeThreeWay(localStock, base.stock, cloudStock)
            : (dirty ? mergeSyncLists(localStock, cloudStock) : mergeSyncLists(cloudStock, localStock));
    }
    const stockIncomes = list => JSON.stringify(syncToArray(list).map(s => [s.name, parseFloat(s.income) || 0]).sort());
    if (stockIncomes(stock) !== stockIncomes(cloudStock)) needUpload = true;
    saveStock(stock);
    rates.forEach(r => { if (!r.items) r.items = []; });
    ordersData.forEach(order => (order.services || []).forEach(inst => { inst.manualItems = inst.manualItems || {}; }));
    recalculateStockFromAllOrders(); // «расход» склада — из полученных заказов
    // Перенос старых финансовых записей; если что-то изменилось — облако нужно обновить
    if (finMigrate(true)) needUpload = true;
    // Одинаковые номера заказов с разных устройств — исправляем однозначно (js/finance.js)
    if (finFixDuplicateOrderNumbers(ordersData).length) needUpload = true;

    localStorage.setItem('cloud_rev', String(cloudRev));
    window.setSyncBase(data); // база для следующего слияния — эта облачная версия

    // Сохраняем в localStorage (без повторной отправки того, что пришло из облака)
    saveAll(true);
    // Отправляем, если у устройства есть недостающие в облаке записи или свои неотправленные правки
    if ((needUpload || dirty) && typeof window.markChanged === 'function') {
        window.markChanged(); // отправляем объединённые данные
    }

    // Перерисовываем интерфейс
    renderAll();

    // Повторный рендер задач помощника после загрузки данных из облака
    if (window.currentUserData && window.currentUserData.role !== 'admin') {
        setTimeout(function() {
            if (typeof renderHelperTasks === 'function') renderHelperTasks();
            if (typeof renderHelperReport === 'function') renderHelperReport();
        }, 200);
    }

    // Сбрасываем флаг локальных изменений через 1 секунду
    setTimeout(() => {
        window.localChangesPending = false;
    }, 1000);
};

    // ========== МОДУЛЬ 15: МОБИЛЬНАЯ НАВИГАЦИЯ И UI ==========
    
    // ========== МОДУЛЬ 15.1: ГОРЯЧИЕ КЛАВИШИ ==========
document.addEventListener('keydown', (e) => {
    // Проверяем, что не находимся в поле ввода
    const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const isModalOpen = document.querySelector('.modal-overlay.active') || document.querySelector('.notification-modal.active');
    
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
        openOrderModal(null, formatDate(tomorrow));
    }
    
    // Стрелки влево/вправо — переключение дней
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (calendarViewMode === 'week') {
            currentDate.setDate(currentDate.getDate() - 7);
        } else {
            currentDate.setMonth(currentDate.getMonth() - 1);
        }
        selectedDate = new Date(currentDate);
        renderCalendar();
    }
    
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (calendarViewMode === 'week') {
            currentDate.setDate(currentDate.getDate() + 7);
        } else {
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        selectedDate = new Date(currentDate);
        renderCalendar();
    }
    
    // Escape — закрыть модальные окна
    if (e.key === 'Escape') {
        closeNotificationModal();
        // Закрыть все modal-overlay
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
        // Закрыть notification-modal
        const notifModal = document.getElementById('notificationModal');
        if (notifModal && notifModal.classList.contains('active')) {
            notifModal.classList.remove('active');
        }
    }
});

    // ========== МОДУЛЬ 15.2: МОБИЛЬНЫЕ УЛУЧШЕНИЯ (iOS/Android FIX) ==========

// Закрытие модалки по клику на overlay
function handleOverlayClick(event, modalId) {
    if (event.target.id === modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }
}

// ========== iOS/Android: БЛОКИРОВКА СКРОЛЛА И СВАЙП (UNIFIED) ==========
(function() {
    let touchStartY = 0;
    let isSwiping = false;
    let swipeThreshold = 50;
    
    // Единый обработчик touchstart для всех модалок
    document.addEventListener('touchstart', function(e) {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (!activeModal) return;
        
        // Пропускаем order modal — у него свой bottom-sheet
        if (activeModal.id === 'orderModal') return;
        
        const modal = activeModal.querySelector('.modal');
        if (!modal) return;
        
        touchStartY = e.touches[0].clientY;
        isSwiping = false;
    }, { passive: true });
    
    // Единый обработчик touchmove для блокировки скролла И свайпа
    document.addEventListener('touchmove', function(e) {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (!activeModal) return;
        
        // Пропускаем order modal
        if (activeModal.id === 'orderModal') return;
        
        const modal = activeModal.querySelector('.modal');
        if (!modal) return;
        
        const touchY = e.touches[0].clientY;
        const diff = touchY - touchStartY;
        
        // Проверяем что модалка прокручена в начало (можно свайпать)
        const currentScroll = modal.scrollTop || 0;
        const atTop = currentScroll <= 5;
        
        // Если свайп вниз за порог и модалка вверху — начинаем свайп для закрытия
        if (diff > swipeThreshold && atTop && !isSwiping) {
            isSwiping = true;
            modal.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            modal.style.transform = 'translateY(100%)';
            modal.style.opacity = '0.5';
            return; // Разрешаем свайп, не блокируем
        }
        
        // Если не свайп — блокируем скролл body
        if (!isSwiping) {
            const target = e.target;
            const isInsideModal = modal.contains(target);
            const isScrollableElement = target.tagName === 'SELECT' || 
                target.tagName === 'INPUT' || 
                target.tagName === 'TEXTAREA';
            
            // Если элемент внутри модалки и это поле ввода — разрешаем
            if (isInsideModal && isScrollableElement) return;
            
            // Если элемент внутри модалки и это скроллируемый контейнер — проверяем
            if (isInsideModal && target.scrollHeight > target.clientHeight) {
                const atTopScroll = target.scrollTop <= 0;
                const atBottomScroll = target.scrollTop + target.clientHeight >= target.scrollHeight - 2;
                
                // Если в начале и тянем вниз — разрешаем
                if (atTopScroll && diff > 0) return;
                // Если в конце и тянем вверх — разрешаем
                if (atBottomScroll && diff < 0) return;
            }
            
            // Блокируем скролл body
            e.preventDefault();
        }
    }, { passive: false });
    
    // Обработчик touchend для закрытия модалки по свайпу
    document.addEventListener('touchend', function(e) {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (!activeModal) return;
        
        const modal = activeModal.querySelector('.modal');
        if (!modal) return;
        
        if (isSwiping) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
            
            // Сброс стилей
            setTimeout(function() {
                modal.style.transition = '';
                modal.style.transform = '';
                modal.style.opacity = '';
            }, 300);
        }
        isSwiping = false;
    }, { passive: true });
    
    // При закрытии модалки — сброс
    document.addEventListener('touchcancel', function() {
        isSwiping = false;
    }, { passive: true });
})();

// Закрытие модального уведомления по клику вне него
document.getElementById('notificationModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'notificationModal') {
        closeNotificationModal();
    }
});

    // ========== МОДУЛЬ 15.3: НИЖНЯЯ НАВИГАЦИЯ (МОБИЛЬНАЯ) ==========
(function() {
    // Переключение вкладки через bottom nav
    window.switchBottomNavTab = function(tabId) {
        console.log('switchBottomNavTab called with:', tabId);
        // Закрыть меню "ещё"
        closeBottomNavMoreMenu();
        
        // Скрыть все вкладки
        document.querySelectorAll('.tab-content').forEach(function(tc) {
            tc.classList.remove('active');
        });
        
        // Показать нужную вкладку
        var target = document.getElementById(tabId);
        if (target) {
            target.classList.add('active');
            console.log('✅ Tab shown:', tabId);
        } else {
            console.error('❌ Tab not found:', tabId);
        }
        
        // Обновить active кнопки в нижней навигации
        var isAdminVisible = document.getElementById('adminBottomNav') && document.getElementById('adminBottomNav').style.display !== 'none';
        var navId = isAdminVisible ? 'adminBottomNav' : 'helperBottomNav';
        var visibleNav = document.getElementById(navId);
        
        if (visibleNav) {
            visibleNav.querySelectorAll('.bottom-nav-item').forEach(function(btn) {
                btn.classList.remove('active');
            });
            var activeBtn = visibleNav.querySelector('.bottom-nav-item[data-tab="' + tabId + '"]');
            if (activeBtn) activeBtn.classList.add('active');
        }
        
        // Синхронизировать top tabs
        document.querySelectorAll('#adminTabs .tab-btn, #helperTabs .tab-btn').forEach(function(btn) {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            }
        });
        
        // Перерендерить контент вкладки
        if (tabId === 'tab-orders' && typeof renderOrders === 'function') renderOrders();
        if (tabId === 'tab-calendar' && typeof renderCalendar === 'function') renderCalendar();
        if (tabId === 'tab-helper-admin' && typeof renderAdminHelperTasks === 'function') renderAdminHelperTasks();
        if (tabId === 'tab-stock' && typeof renderStock === 'function') renderStock();
        if (tabId === 'tab-cash' && typeof renderCash === 'function') renderCash();
        if (tabId === 'tab-summary' && typeof renderSummary === 'function') renderSummary();
        if (tabId === 'tab-ref' && typeof renderServicesTable === 'function') renderServicesTable();
        if (tabId === 'helper-tasks' && typeof renderHelperTasks === 'function') renderHelperTasks();
        if (tabId === 'helper-report' && typeof renderHelperReport === 'function') renderHelperReport();
        if ((tabId === 'helper-attendance' || tabId === 'tab-helper-admin') && typeof renderAttendance === 'function') renderAttendance();
    };
    
    // Привязка кликов к bottom nav кнопкам
    window.bindBottomNavClicks = function() {
        document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(function(btn) {
            if (!btn.onclick) {
                btn.onclick = function() {
                    var tabId = this.getAttribute('data-tab');
                    if (typeof window.switchBottomNavTab === 'function') {
                        window.switchBottomNavTab(tabId);
                    }
                };
            }
        });
        
        // Привязка кнопки "Ещё"
        var moreBtn = document.querySelector('.bottom-nav-more');
        if (moreBtn) {
            moreBtn.onclick = function(e) {
                e.stopPropagation();
                toggleBottomNavMoreMenu(e);
            };
        }
    };
    
    // Меню "ещё"
    window.toggleBottomNavMoreMenu = function(e) {
        e.stopPropagation();
        var menu = document.getElementById('bottomNavMoreMenu');
        if (menu) {
            menu.classList.toggle('visible');
        }
    };
    
    function closeBottomNavMoreMenu() {
        var menu = document.getElementById('bottomNavMoreMenu');
        if (menu) menu.classList.remove('visible');
    }
    window.closeBottomNavMoreMenu = closeBottomNavMoreMenu;
    
    // Закрыть меню при клике вне его
    document.addEventListener('click', function(e) {
        var moreMenu = document.getElementById('bottomNavMoreMenu');
        var moreBtn = document.querySelector('.bottom-nav-more');
        if (moreMenu && moreBtn && !moreBtn.contains(e.target) && !moreMenu.contains(e.target)) {
            closeBottomNavMoreMenu();
        }
    });
    
    // Привяжем обработчики после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.bindBottomNavClicks);
    } else {
        window.bindBottomNavClicks();
    }
    
    // Привязка кнопок "Ещё"
    window.bindMoreMenuItems = function() {
        document.querySelectorAll('.bottom-nav-more-item[data-tab]').forEach(function(btn) {
            if (!btn.onclick) {
                btn.onclick = function() {
                    var tabId = this.getAttribute('data-tab');
                    closeBottomNavMoreMenu();
                    if (typeof window.switchBottomNavTab === 'function') {
                        window.switchBottomNavTab(tabId);
                    }
                };
            }
        });
        
        // Кнопка "Закрыть"
        var closeBtn = document.querySelector('.bottom-nav-more-item:last-child');
        if (closeBtn && !closeBtn.onclick) {
            closeBtn.onclick = function() {
                closeBottomNavMoreMenu();
            };
        }
    };
    
    setTimeout(window.bindBottomNavClicks, 100);
    setTimeout(window.bindBottomNavClicks, 500);
    setTimeout(window.bindMoreMenuItems, 100);
    setTimeout(window.bindMoreMenuItems, 500);
    
    // Лог роли при загрузке
    console.log('app.js loaded: currentUserData=', window.currentUserData, 'selectedLoginRole=', window.selectedLoginRole);
    
    // Инициализация ПОСЛЕ всех определений функций
    console.log('Calling initAppIfReady...');
    initAppIfReady();
    
    // Привяжем обработчики навигации после инициализации
    setTimeout(function() {
        console.log('Binding bottom nav clicks...');
        window.bindBottomNavClicks();
        window.bindMoreMenuItems();
        console.log('✅ Bottom nav bound');
    }, 200);
    
    // Инициализация состояния авторизации ПОСЛЕ полной загрузки
    console.log('[App] Вызываю initAuthState...');
    if (typeof window.initAuthState === 'function') {
        window.initAuthState();
    } else {
        console.error('[App] initAuthState не определена!');
    }
    
    // Инициализация real-time синхронизации ПОСЛЕ auth
    console.log('[App] Инициализация real-time sync...');
    if (typeof window.initRealtimeSync === 'function') {
        setTimeout(() => {
            window.initRealtimeSync();
            console.log('[App] Real-time sync инициализирована');
        }, 1000);
    } else {
        console.error('[App] initRealtimeSync не определена!');
    }
    // Push-уведомления: подписка — js/fcm.js (после входа, getUserDataForAuth), отправка — functions/index.js
})();

