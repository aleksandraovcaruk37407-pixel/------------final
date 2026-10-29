/* ==========================================================================
   РЕЖИМ «ВИДЖЕТ»: маленькое окно только с календарём.
   Открывается по ссылке index.html?widget=1 (ярлык «Календарь ателье» на рабочем столе)
   или calendar.html (для телефона: «На экран Домой»).
   Это сама программа — все кнопки работают, данные те же; скрыты только вкладки и меню.
   Админ видит «Список по дням» (js/agenda.js), помощник — свой «Календарь» с делами и приходом.
   ========================================================================== */

const WIDGET_MODE = new URLSearchParams(location.search).has('widget');

function widgetFullAppUrl() {
    return location.pathname.replace(/[^/]*$/, '') + 'index.html';
}

// Вызывается из updateRoleTabs (index.html) после входа: открываем нужную вкладку
function applyWidgetMode() {
    if (!WIDGET_MODE || !window.currentUserData) return;
    const isAdmin = window.currentUserData.role === 'admin';
    const tabId = isAdmin ? 'tab-calendar' : 'helper-attendance';
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
    const title = document.getElementById('widgetTitle');
    if (title) title.textContent = isAdmin ? '📅 Календарь' : '📅 Мой календарь';
    widgetRefresh();
}

function widgetRefresh() {
    if (!window.currentUserData) return;
    if (window.currentUserData.role === 'admin') { if (typeof renderCalendar === 'function') renderCalendar(); }
    else if (typeof renderAttendance === 'function') renderAttendance();
}

if (WIDGET_MODE) {
    document.documentElement.classList.add('widget-mode');
    // «На экран Домой» из этого окна — отдельная иконка «Календарь», открывающая виджет
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest) manifest.href = 'manifest-calendar.json';
    let appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appTitle) { appTitle = document.createElement('meta'); appTitle.name = 'apple-mobile-web-app-title'; document.head.appendChild(appTitle); }
    appTitle.content = 'Календарь';
    document.title = 'Календарь ателье';
    document.addEventListener('DOMContentLoaded', () => {
        const toolbar = document.querySelector('#appContent .toolbar');
        if (toolbar) {
            const bar = document.createElement('div');
            bar.className = 'widget-bar';
            bar.innerHTML = `<b id="widgetTitle">📅 Календарь</b>
                <button class="widget-btn" title="Обновить" onclick="widgetRefresh()">⟳</button>
                <button class="widget-btn" title="Открыть всю программу" onclick="window.open('${widgetFullAppUrl()}', '_blank')">↗ Вся программа</button>`;
            toolbar.insertAdjacentElement('afterend', bar);
        }
    });
    // Окно может висеть открытым весь день: раз в 5 минут перерисовываем («Сегодня» сменится в полночь)
    setInterval(widgetRefresh, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) widgetRefresh(); });
}

window.applyWidgetMode = applyWidgetMode;
window.widgetRefresh = widgetRefresh;
