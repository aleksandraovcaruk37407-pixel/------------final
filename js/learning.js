// ========== ВКЛАДКА «ОБУЧЕНИЕ» ==========
// Список видео-уроков. Чтобы добавить готовое видео:
//  - файл .mp4 положить в папку video/ рядом с index.html и вписать src: 'video/имя.mp4';
//  - или ссылку для встраивания с YouTube/RuTube (https://...embed/...) — тоже в src.
// Пока src пустой, на месте видео показывается «Скоро».
(function () {
    const LEARN_VIDEOS = [
        { id: 'a1', who: 'admin', title: 'Заказы', desc: 'Как принять заказ, указать услуги, срок и предоплату.', src: '' },
        { id: 'a2', who: 'admin', title: 'Деньги', desc: 'Оплата заказа, касса за день, обязательные платежи.', src: '' },
        { id: 'a3', who: 'admin', title: 'Закупка и склад', desc: 'Как заказать материалы и принять их на склад.', src: '' },
        { id: 'a4', who: 'admin', title: 'Календарь', desc: 'Что сегодня сдать, перенос заказа, заметки.', src: '' },
        { id: 'a5', who: 'admin', title: 'Помощники', desc: 'Как дать задачу помощнику и принять работу.', src: '' },
        { id: 'a6', who: 'admin', title: 'Итоги', desc: 'Сколько заработали за месяц и куда ушли деньги.', src: '' },
        { id: 'h1', who: 'helper', title: 'Мои задачи', desc: 'Где смотреть задачи и как отметить, что сделал.', src: '' },
        { id: 'h2', who: 'helper', title: 'Посещаемость', desc: 'Как отметить приход и уход.', src: '' },
        { id: 'h3', who: 'helper', title: 'Мой отчёт', desc: 'Сколько заработал и за что штрафы.', src: '' }
    ];

    const WATCHED_KEY = 'learn_watched';

    function getWatched() {
        try { return JSON.parse(localStorage.getItem(WATCHED_KEY) || '[]'); } catch (e) { return []; }
    }

    function setWatched(id, on) {
        const list = getWatched().filter(x => x !== id);
        if (on) list.push(id);
        try { localStorage.setItem(WATCHED_KEY, JSON.stringify(list)); } catch (e) {}
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function playerHTML(v) {
        if (!v.src) return '<div class="learn-soon">🎬 Видео скоро появится</div>';
        if (/^https?:\/\//.test(v.src)) {
            return `<iframe class="learn-player" src="${esc(v.src)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
        }
        return `<video class="learn-player" src="${esc(v.src)}" controls preload="metadata" playsinline></video>`;
    }

    function cardHTML(v, num, watched) {
        const done = watched.includes(v.id);
        return `<div class="learn-card${done ? ' learn-done' : ''}">
            ${playerHTML(v)}
            <div class="learn-info">
                <div class="learn-title">${num}. ${esc(v.title)}${done ? ' <span class="learn-badge">✅ просмотрено</span>' : ''}</div>
                <div class="learn-desc">${esc(v.desc)}</div>
                ${v.src ? `<label class="learn-check"><input type="checkbox" data-learn-id="${esc(v.id)}"${done ? ' checked' : ''}> Посмотрел(а)</label>` : ''}
            </div>
        </div>`;
    }

    function renderLearning() {
        const box = document.getElementById('learnList');
        if (!box) return;
        const isHelper = window.currentUserData && window.currentUserData.role === 'helper';
        const watched = getWatched();
        const groups = isHelper
            ? [['Для помощника', 'helper']]
            : [['Для администратора', 'admin'], ['Для помощника', 'helper']];
        box.innerHTML = groups.map(([name, who]) => {
            const list = LEARN_VIDEOS.filter(v => v.who === who);
            const ready = list.filter(v => v.src);
            const seen = ready.filter(v => watched.includes(v.id)).length;
            return `<h3 class="learn-group">${name} <span class="learn-progress">${ready.length ? `просмотрено ${seen} из ${ready.length}` : 'видео готовятся'}</span></h3>
                <div class="learn-grid">${list.map((v, i) => cardHTML(v, i + 1, watched)).join('')}</div>`;
        }).join('');
    }

    document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest('[data-tab="tab-learn"]')) renderLearning();
    });
    document.addEventListener('change', e => {
        const id = e.target && e.target.getAttribute && e.target.getAttribute('data-learn-id');
        if (!id) return;
        setWatched(id, e.target.checked);
        renderLearning();
    });

    window.renderLearning = renderLearning;
    window.LEARN_VIDEOS = LEARN_VIDEOS;
})();
