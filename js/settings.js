/* ==========================================================================
   НАСТРОЙКИ (вкладка «⚙️ Настройки», 05.11.2026).
   Аккаунт — у всех: имя, почта, смена своего пароля (window.changeOwnPassword в firebase.js).
   Все пользователи — только админу: помощники и админы из /users, кнопка «Создать новых пользователей».
   ========================================================================== */

let settingsUsers = null; // [{ uid, email, displayName, role }] — загружаются из /users при открытии

function settingsIsAdmin() { return !!(window.currentUserData && window.currentUserData.role === 'admin'); }

function settingsLoadUsers() {
    if (!window.db || typeof window.get !== 'function') return Promise.resolve([]);
    return window.get(window.child(window.fbRef(window.db), 'users')).then(snap => {
        const val = snap.exists() ? snap.val() : {};
        settingsUsers = Object.keys(val).map(uid => ({ uid, ...val[uid] })).filter(u => u && u.email);
        return settingsUsers;
    }).catch(() => (settingsUsers = []));
}

function settingsUserRow(u) {
    const name = u.displayName && u.displayName !== u.email ? u.displayName : String(u.email).split('@')[0];
    const me = window.currentUserData && String(window.currentUserData.email).toLowerCase() === String(u.email).toLowerCase();
    const added = u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : '';
    return `<div class="set-user"><span class="set-user-name">${safeHTML(name)}${me ? ' <span class="set-me">это вы</span>' : ''}</span>
        <span class="set-user-mail">📧 ${safeHTML(u.email)}</span>
        <span class="set-user-mail">🆔 ${safeHTML(u.uid)}${added ? ' · добавлен ' + added : ''}</span></div>`;
}

function renderSettings() {
    const box = document.getElementById('settingsContainer');
    if (!box || !window.currentUserData) return;
    const u = window.currentUserData;
    const roleName = u.role === 'admin' ? 'Админ' : 'Помощник';
    let html = `
        <details class="fin-section" open>
            <summary class="fin-section-head"><span>👤 Аккаунт</span></summary>
            <div class="fin-section-body">
                <div class="set-account">
                    <div><span class="set-label">Имя</span><b>${safeHTML(u.displayName || '')}</b></div>
                    <div><span class="set-label">Почта</span><b>${safeHTML(u.email || '')}</b></div>
                    <div><span class="set-label">Роль</span><b>${roleName}</b></div>
                </div>
                <div class="set-pass">
                    <div class="set-subtitle">🔑 Сменить пароль</div>
                    <input type="password" id="setPassOld" placeholder="Текущий пароль" autocomplete="current-password">
                    <input type="password" id="setPassNew" placeholder="Новый пароль (минимум 6 символов)" autocomplete="new-password">
                    <input type="password" id="setPassNew2" placeholder="Новый пароль ещё раз" autocomplete="new-password">
                    <div class="set-error" id="setPassMsg"></div>
                    <button class="btn-add" onclick="settingsChangePassword()">Сохранить пароль</button>
                </div>
                <button class="btn-del set-logout" onclick="handleLogout()">🚪 Выйти из программы</button>
            </div>
        </details>`;
    if (settingsIsAdmin()) {
        const list = settingsUsers || [];
        const helpers = list.filter(x => x.role !== 'admin'), admins = list.filter(x => x.role === 'admin');
        html += `
        <details class="fin-section" open>
            <summary class="fin-section-head"><span>👥 Все пользователи</span><span class="fin-section-aside">${list.length || ''}</span></summary>
            <div class="fin-section-body">
                <button class="btn-add" onclick="openAddHelperModal()">➕ Создать новых пользователей</button>
                ${settingsUsers === null ? '<div class="fin-muted">Загружаю…</div>' : `
                <div class="set-subtitle">👷 Помощники · ${helpers.length}</div>
                ${helpers.length ? helpers.map(settingsUserRow).join('') : '<div class="fin-muted">Помощников пока нет</div>'}
                <div class="set-subtitle">🛡 Админы · ${admins.length}</div>
                ${admins.length ? admins.map(settingsUserRow).join('') : '<div class="fin-muted">Админов нет</div>'}`}
            </div>
        </details>`;
        if (settingsUsers === null) settingsLoadUsers().then(renderSettings);
        if (typeof backupSectionHTML === 'function') html += backupSectionHTML(); // js/backup.js
    }
    box.innerHTML = html;
    if (typeof renderBackupBox === 'function' && document.getElementById('backupBox')) renderBackupBox();
}

async function settingsChangePassword() {
    const msg = document.getElementById('setPassMsg');
    const oldP = document.getElementById('setPassOld').value;
    const p1 = document.getElementById('setPassNew').value, p2 = document.getElementById('setPassNew2').value;
    const say = (text, ok) => { msg.textContent = text; msg.classList.toggle('ok', !!ok); };
    if (!oldP) return say('Введите текущий пароль');
    if (p1.length < 6) return say('Новый пароль — минимум 6 символов');
    if (p1 !== p2) return say('Новые пароли не совпадают');
    if (p1 === oldP) return say('Новый пароль совпадает с текущим');
    say('Сохраняю…', true);
    try {
        await window.changeOwnPassword(oldP, p1);
        ['setPassOld', 'setPassNew', 'setPassNew2'].forEach(id => { document.getElementById(id).value = ''; });
        say('✅ Пароль изменён. Входите с новым паролем.', true);
    } catch (e) {
        const code = String(e && (e.code || e.message) || '');
        say(/wrong-password|invalid-credential|INVALID/.test(code) ? 'Текущий пароль неверный'
            : /weak-password/.test(code) ? 'Слишком простой пароль'
            : /too-many/.test(code) ? 'Слишком много попыток — подождите пару минут'
            : /network/.test(code) ? 'Нет связи — попробуйте ещё раз' : 'Не получилось: ' + code);
    }
}

// Новый пользователь добавлен — список обновится при следующем открытии
document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('#addHelperModal .btn-save')) settingsUsers = null;
});

window.renderSettings = renderSettings;
window.settingsChangePassword = settingsChangePassword;
