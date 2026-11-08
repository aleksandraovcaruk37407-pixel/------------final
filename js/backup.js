// ========== РЕЗЕРВНЫЕ КОПИИ (Настройки → «💾 Резервные копии», только админ) ==========
// • «Скачать копию» — файл со ВСЕМИ данными программы (заказы, касса, платежи, склад, помощники…).
// • «Восстановить из файла» — вернуть данные из такого файла (сначала скачивается копия того, что есть сейчас).
// • Копия в облаке делается сама раз в неделю (backups/<дата>, список — backups_meta); хранятся последние 6.
//   Её же делает робот на GitHub (functions/github-sender.js), если неделю никто из админов не заходил.
const BACKUP_KEEP = 6;
const BACKUP_EVERY_DAYS = 7;
let backupMeta = null; // { 'ГГГГ-ММ-ДД': { createdAt, by, orders } } — копии в облаке

function backupIsAdmin() { return !!(window.currentUserData && window.currentUserData.role === 'admin'); }
function backupToday() { return typeof formatDate === 'function' ? formatDate(new Date()) : new Date().toISOString().slice(0, 10); }

function backupSnapshot() {
    return {
        kind: 'back-alive-backup', v: 1, createdAt: new Date().toISOString(),
        by: window.currentUserData ? window.currentUserData.email : null,
        lastOrderNumber: localStorage.getItem('lastOrderNumber'),
        data: window.getSyncData()
    };
}

function backupDownloadJSON(obj, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function backupDownload() {
    backupDownloadJSON(backupSnapshot(), `BACK-ALIVE-копия-${backupToday()}.json`);
    if (typeof showToast === 'function') showToast('📤 Копия скачана — сохраните файл в надёжное место', 'success');
}

// Из файла: новая копия ({kind, data}) или старый «Экспорт» (списки прямо в корне)
function backupDataOf(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const d = obj.kind === 'back-alive-backup' && obj.data ? obj.data : obj;
    if (!Array.isArray(d.ordersData) && !(d.ordersData && typeof d.ordersData === 'object')) return null;
    return { ...d, lastOrderNumber: obj.lastOrderNumber || d.lastOrderNumber || null };
}

function backupCount(list) { return Array.isArray(list) ? list.length : (list && typeof list === 'object' ? Object.keys(list).length : 0); }

// Заменить все данные копией — после двух подтверждений и скачивания текущих данных
function backupApply(d, label) {
    if (!backupIsAdmin()) return;
    const summary = `заказов: ${backupCount(d.ordersData)}, операций кассы: ${backupCount(d.cashOps)}, платежей: ${backupCount(d.payments)}`;
    if (!confirm(`Восстановить данные из копии ${label}?\n\nВ копии ${summary}.\n\nВСЕ нынешние данные программы будут заменены копией у всех (Егор, Александра, помощник). Перед этим скачается файл с тем, что есть сейчас.`)) return;
    if (!confirm('Точно восстановить? Изменения, сделанные после копии, пропадут (останутся только в скачанном файле).')) return;
    backupDownloadJSON(backupSnapshot(), `BACK-ALIVE-до-восстановления-${backupToday()}.json`);
    window.replaceAllData(d);
    if (typeof showToast === 'function') showToast(`✅ Данные восстановлены из копии ${label}`, 'success');
}

function backupRestoreFromFile() {
    if (!backupIsAdmin()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            let d = null;
            try { d = backupDataOf(JSON.parse(reader.result)); } catch (e) {}
            if (!d) { alert('❌ Это не файл резервной копии программы'); return; }
            backupApply(d, `из файла «${file.name}»`);
        };
        reader.readAsText(file);
    };
    input.click();
}

// ---------- Копии в облаке ----------
function backupDbReady() { return window.db && window.fbRef && window.fbGet && window.fbSet && window.auth && window.auth.currentUser; }

async function backupLoadMeta() {
    if (!backupDbReady()) return {};
    const snap = await window.fbGet(window.fbRef(window.db, 'backups_meta'));
    backupMeta = (snap && snap.val()) || {};
    return backupMeta;
}

async function backupSaveToCloud(dateKey) {
    const snap = backupSnapshot();
    await window.fbSet(window.fbRef(window.db, 'backups/' + dateKey), snap);
    await window.fbSet(window.fbRef(window.db, 'backups_meta/' + dateKey), { createdAt: snap.createdAt, by: snap.by, orders: backupCount(snap.data.ordersData) });
    const meta = await backupLoadMeta();
    const old = Object.keys(meta).sort().slice(0, -BACKUP_KEEP);
    for (const k of old) {
        await window.fbSet(window.fbRef(window.db, 'backups/' + k), null);
        await window.fbSet(window.fbRef(window.db, 'backups_meta/' + k), null);
        delete meta[k];
    }
}

// Раз в неделю: вызывается у админа после получения облачных данных (js/firebase.js → cloudSeenOnce)
let backupAutoDone = false;
async function backupAutoCloud() {
    if (backupAutoDone || !backupIsAdmin() || !backupDbReady() || !window.cloudSeenOnce) return;
    backupAutoDone = true;
    try {
        const meta = await backupLoadMeta();
        const last = Object.keys(meta).sort().pop();
        const today = backupToday();
        if (last && (Date.parse(today) - Date.parse(last)) / 86400000 < BACKUP_EVERY_DAYS) return;
        await backupSaveToCloud(today);
        console.log('[Копия] Недельная копия в облаке сохранена:', today);
        if (document.getElementById('backupBox')) renderBackupBox();
    } catch (e) {
        console.warn('[Копия] Не удалось сохранить копию в облаке:', e && e.message);
    }
}

async function backupCloudNow() {
    if (!backupIsAdmin() || !backupDbReady()) return;
    try {
        await backupSaveToCloud(backupToday());
        if (typeof showToast === 'function') showToast('☁️ Копия в облаке сохранена', 'success');
    } catch (e) { alert('❌ Не удалось сохранить копию: ' + (e && e.message)); }
    renderBackupBox();
}

async function backupRestoreFromCloud(dateKey) {
    if (!backupIsAdmin() || !backupDbReady()) return;
    const snap = await window.fbGet(window.fbRef(window.db, 'backups/' + dateKey));
    const d = backupDataOf(snap && snap.val());
    if (!d) { alert('❌ Копия не найдена'); return; }
    backupApply(d, 'от ' + (typeof formatDateDDMMYYYY === 'function' ? formatDateDDMMYYYY(dateKey) : dateKey));
}

async function backupDownloadFromCloud(dateKey) {
    const snap = await window.fbGet(window.fbRef(window.db, 'backups/' + dateKey));
    if (!snap || !snap.val()) { alert('❌ Копия не найдена'); return; }
    backupDownloadJSON(snap.val(), `BACK-ALIVE-копия-${dateKey}.json`);
}

// Раздел в Настройках (js/settings.js вставляет <div id="backupBox">)
function backupSectionHTML() {
    if (!backupIsAdmin()) return '';
    return `
        <details class="fin-section" data-key="set-backup">
            <summary class="fin-section-head"><span>💾 Резервные копии</span></summary>
            <div class="fin-section-body" id="backupBox"><div class="fin-muted">Загружаю…</div></div>
        </details>`;
}

async function renderBackupBox() {
    const box = document.getElementById('backupBox');
    if (!box) return;
    let meta = backupMeta;
    try { meta = await backupLoadMeta(); } catch (e) { meta = backupMeta || {}; }
    const dates = Object.keys(meta || {}).sort().reverse();
    const dd = k => typeof formatDateDDMMYYYY === 'function' ? formatDateDDMMYYYY(k) : k;
    box.innerHTML = `
        <div class="fin-muted">Копия в облаке делается сама раз в неделю, хранятся последние ${BACKUP_KEEP}. Файл на телефон или компьютер — на всякий случай, раз в месяц.</div>
        <div class="backup-btns">
            <button class="btn-add" onclick="backupDownload()">📤 Скачать копию файлом</button>
            <button class="btn-extra" onclick="backupRestoreFromFile()">📥 Восстановить из файла</button>
            <button class="btn-extra" onclick="backupCloudNow()">☁️ Сделать копию в облаке сейчас</button>
        </div>
        <div class="set-subtitle">☁️ Копии в облаке · ${dates.length}</div>
        ${dates.length ? dates.map(k => `
            <div class="backup-row">
                <span>📅 ${dd(k)}<small> · заказов ${meta[k].orders || 0}</small></span>
                <span class="backup-row-btns">
                    <button class="btn-extra" onclick="backupDownloadFromCloud('${k}')" title="Скачать файлом">📤</button>
                    <button class="btn-extra" onclick="backupRestoreFromCloud('${k}')">Восстановить</button>
                </span>
            </div>`).join('') : '<div class="fin-muted">Пока нет — первая появится автоматически</div>'}`;
}

window.backupDownload = backupDownload;
window.backupRestoreFromFile = backupRestoreFromFile;
window.backupCloudNow = backupCloudNow;
window.backupRestoreFromCloud = backupRestoreFromCloud;
window.backupDownloadFromCloud = backupDownloadFromCloud;
window.backupSectionHTML = backupSectionHTML;
window.renderBackupBox = renderBackupBox;
window.backupAutoCloud = backupAutoCloud;
