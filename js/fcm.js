/* ==========================================================================
   PUSH-УВЕДОМЛЕНИЯ: подписка устройства (Firebase Cloud Messaging)

   1. Человек нажимает «🔔 Включить push» → браузер спрашивает разрешение.
   2. Регистрируется sw.js, Firebase выдаёт токен этого устройства (getPushToken в firebase.js).
   3. Токен сохраняется в fcm_tokens/<uid>/<ключ устройства>.
   4. Отправитель (functions/github-sender.js в GitHub Actions, раз в ~5 минут) находит новые уведомления
      в helperNotices и шлёт push на устройства адресата; sw.js показывает его даже при закрытой программе.
      Пока программа открыта, новое уведомление показывается сразу (announceNewNotices в app.js).

   При выходе из аккаунта токен этого устройства удаляется — push сюда больше не придут.
   ========================================================================== */

// Ключ из Firebase Console → Project settings → Cloud Messaging → Web Push certificates.
// Пока он пустой, push выключены и кнопка не показывается. Ключ публичный — хранить в коде можно.
const VAPID_KEY = 'BELoLE_fBAJp71111QKsj-fGh8KBGOMkRolutJla9294Y9d6lAEVuS0ittqKwqIOVT-uIg0CJnf6ILHd_XeCCEg';

const PUSH_KEY_STORAGE = 'push_device_key';

function pushIsIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function pushIsStandalone() {
    return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

// off — не настроено; ios-install — на iPhone нужно добавить на экран «Домой»;
// unsupported — браузер не умеет; denied / granted / default — разрешение браузера
function pushStatus() {
    if (!VAPID_KEY) return 'off';
    if (pushIsIOS() && !pushIsStandalone()) return 'ios-install';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

// Короткий ключ устройства из токена (токен длинный и меняется редко)
function pushDeviceKey(token) {
    let h = 5381;
    for (let i = 0; i < token.length; i++) h = ((h << 5) + h + token.charCodeAt(i)) >>> 0;
    return 'd' + h.toString(16);
}

async function pushServiceWorker() {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    if (reg.active) return reg;
    // Ждём активации нового Service Worker (не дольше 10 секунд)
    const worker = reg.installing || reg.waiting;
    await new Promise(resolve => {
        if (!worker) return resolve();
        const timer = setTimeout(resolve, 10000);
        worker.addEventListener('statechange', () => { if (worker.state === 'activated') { clearTimeout(timer); resolve(); } });
    });
    return reg;
}

// Получить токен и сохранить в базе. Разрешение уже должно быть выдано.
async function pushSaveToken() {
    const user = window.auth && window.auth.currentUser;
    if (!user || pushStatus() !== 'granted') return false;
    const reg = await pushServiceWorker();
    const token = await window.getPushToken(VAPID_KEY, reg);
    if (!token) return false;
    const key = pushDeviceKey(token);
    const oldKey = localStorage.getItem(PUSH_KEY_STORAGE);
    if (oldKey && oldKey !== key) {
        await window.fbSet(window.fbRef(window.db, `fcm_tokens/${user.uid}/${oldKey}`), null).catch(() => {});
    }
    await window.fbSet(window.fbRef(window.db, `fcm_tokens/${user.uid}/${key}`), {
        token,
        email: user.email,
        device: pushIsIOS() ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'Компьютер',
        updatedAt: new Date().toISOString()
    });
    localStorage.setItem(PUSH_KEY_STORAGE, key);
    return true;
}

// После входа: если разрешение уже есть — тихо обновляем токен (без вопросов)
window.pushOnLogin = function() {
    if (pushStatus() === 'granted') {
        pushSaveToken().catch(e => console.warn('[Push] Не удалось обновить токен:', e));
    }
    renderPushControls();
};

// Кнопка «Включить push» (разрешение можно спросить только по нажатию)
window.pushEnable = async function() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Уведомления не разрешены', 'error');
        } else if (await pushSaveToken()) {
            showToast('Push-уведомления включены на этом устройстве', 'success');
        } else {
            showToast('Этот браузер не поддерживает push', 'error');
        }
    } catch (e) {
        console.error('[Push] Ошибка подписки:', e);
        showToast('Не удалось включить push: ' + (e.message || e), 'error');
    }
    renderPushControls();
};

// Проверка: уведомление самому себе — отправитель пришлёт push на все мои устройства
window.pushTest = function() {
    const to = window.currentUserData.role === 'admin' ? 'admin' : window.currentUserData.email;
    addNotice(to, 'test', '🔔 Проверка push-уведомлений', null);
    saveAll();
    renderNotices();
    showToast('Отправлено. Push придёт через 5–15 минут (бесплатная отправка по расписанию)');
};

// Выход из аккаунта: это устройство больше не получает push
window.pushOnLogout = async function() {
    const key = localStorage.getItem(PUSH_KEY_STORAGE);
    const user = window.auth && window.auth.currentUser;
    localStorage.removeItem(PUSH_KEY_STORAGE);
    if (!key || !user) return;
    try {
        await window.fbSet(window.fbRef(window.db, `fcm_tokens/${user.uid}/${key}`), null);
        await window.deletePushToken();
    } catch (e) {
        console.warn('[Push] Не удалось удалить токен:', e);
    }
};

// Кнопка/подсказка рядом со списками уведомлений (.push-controls)
function renderPushControls() {
    const status = pushStatus();
    const subscribed = status === 'granted' && !!localStorage.getItem(PUSH_KEY_STORAGE);
    const html =
        status === 'off' || status === 'unsupported' ? '' :
        status === 'ios-install' ? '<span class="push-hint">📲 Чтобы получать push на iPhone: «Поделиться» → «На экран Домой», затем откройте программу с экрана «Домой»</span>' :
        status === 'denied' ? '<span class="push-hint">🔕 Push запрещены в настройках браузера для этого сайта</span>' :
        subscribed ? '<span class="push-hint">🔔 Push включены</span> <button class="btn-extra" onclick="pushTest()" style="padding:3px 10px;font-size:12px;">Проверить</button>' :
        '<button class="btn-add" onclick="pushEnable()" style="padding:5px 12px;font-size:13px;">🔔 Включить push на этом устройстве</button>';
    document.querySelectorAll('.push-controls').forEach(el => { el.innerHTML = html; });
}
window.renderPushControls = renderPushControls;
