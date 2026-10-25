import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue, off, onDisconnect, runTransaction } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGsjB5bhSL2keL0xTIOJib3ZB9HEqGyMs",
  authDomain: "auto-atelier-1486d.firebaseapp.com",
  databaseURL: "https://auto-atelier-1486d-default-rtdb.firebaseio.com",
  projectId: "auto-atelier-1486d",
  storageBucket: "auto-atelier-1486d.firebasestorage.app",
  messagingSenderId: "893898887206",
  appId: "1:893898887206:web:9f9e760e953fcd780556e7"
};

const app = initializeApp(firebaseConfig);
window.db = getDatabase(app);
window.auth = getAuth(app);
window.fbRef = ref;
window.fbSet = set;
window.set = set;
window.fbGet = get;
window.fbChild = child;
window.get = get;
window.child = child;
window.onAuthStateChanged = onAuthStateChanged;
window.signOut = signOut;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.updateProfile = updateProfile;

// ========== СОЗДАНИЕ АККАУНТА ПОМОЩНИКА БЕЗ ВЫХОДА АДМИНА ==========
// createUserWithEmailAndPassword сразу входит под новым пользователем,
// поэтому создаём аккаунт через отдельный экземпляр приложения
window.createHelperAuthUser = async function(email, password, displayName) {
  const secondaryApp = initializeApp(firebaseConfig, 'helper-creator-' + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await updateProfile(cred.user, { displayName: displayName });
    return cred.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
};

let firebaseConnected = false;
let cloudDataLoaded = false;
let lastSyncTime = 0;
let syncInProgress = false;
let hasUnsavedChanges = localStorage.getItem('cloud_dirty') === '1'; // неотправленные изменения с прошлого запуска

// ========== ФЛАГ ГОТОВНОСТИ FIREBASE ==========
window.firebaseReady = true;
console.log('[Firebase] Инициализация завершена, window.firebaseReady = true');

// ========== ОБЪЕДИНЁННАЯ ОБРАБОТКА АВТОРИЗАЦИИ (ОДИН onAuthStateChanged) ==========
window.initAuthState = function() {
  console.log('[Auth] initAuthState вызван');
  
  onAuthStateChanged(window.auth, (user) => {
    console.log('onAuthStateChanged: user =', user ? user.uid : 'null');
    
    // Устанавливаем флаг подключения сразу
    firebaseConnected = !!user;
    
    if (user) {
      console.log('Пользователь авторизован:', user.email);
      
      const isAdminByEmail = window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes(user.email.toLowerCase());
      if (isAdminByEmail) {
        console.log('>>> ✅ Email админа в списке, принудительно устанавливаем роль admin');
      }
      
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appContent').style.display = 'block';
      
      console.log('Проверяю запись пользователя в базе...');
      window.fbGet(window.fbChild(window.fbRef(window.db), 'users/' + user.uid)).then((snapshot) => {
        console.log('Пользователь найден в базе:', snapshot.exists());
        if (!snapshot.exists() && !isAdminByEmail) {
          // Запись помощника создаёт только админ — правила базы не дадут создать её самому
          console.log('Записи пользователя нет в базе — доступ к данным закрыт до добавления админом');
          return null;
        } else if (!snapshot.exists()) {
          console.log('Создаю запись пользователя...');
          return window.fbSet(window.fbRef(window.db, 'users/' + user.uid), {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0] || 'Пользователь',
            role: isAdminByEmail ? 'admin' : 'helper',
            createdAt: new Date().toISOString()
          }).then(() => {
            console.log('Запись пользователя создана успешно');
          }).catch(err => {
            console.error('Ошибка создания записи пользователя:', err);
          });
        } else {
          return window.fbGet(window.fbChild(window.fbRef(window.db), 'users/' + user.uid)).then((snap) => {
            if (snap.exists() && snap.val().role === 'helper' && isAdminByEmail) {
              console.log('>>> Исправляю роль в базе с helper на admin при авторизации');
              return window.fbSet(window.fbRef(window.db, 'users/' + user.uid), {
                ...snap.val(),
                role: 'admin',
                updatedAt: new Date().toISOString()
              });
            }
            return null;
          });
        }
      }).then(async () => {
        console.log('Вызываю getUserDataForAuth...');
        if (typeof window.syncUsersToCloud === 'function') {
          await window.syncUsersToCloud();
        }
        // Подписка на изменения в облаке (после входа)
        initRealtimeSync();
        setTimeout(() => {
          if (typeof window.getUserDataForAuth === 'function') {
            window.getUserDataForAuth(user);
          } else {
            console.error('getUserDataForAuth не определена!');
          }
        }, 500);
      }).catch(err => {
        console.error('Ошибка работы с пользователем:', err);
        setTimeout(() => {
          if (typeof window.getUserDataForAuth === 'function') {
            window.getUserDataForAuth(user);
          }
        }, 500);
      });
    } else {
      console.log('Пользователь не авторизован');
      window.currentUserData = null;
      
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('appContent').style.display = 'none';
      if (typeof window.updateAuthUI === 'function') {
        window.updateAuthUI();
      }
    }
  });
};

// ========== REAL-TIME СИНХРОНИЗАЦИЯ ==========
let realtimeSyncListener = null; // Сохраняем ссылку для cleanup

function initRealtimeSync() {
  // Слушать облако можно только после входа (правила базы не пускают гостей)
  if (!window.auth.currentUser) return;

  // Удаляем старый listener если есть
  if (realtimeSyncListener) {
    const dataRef = ref(window.db, 'atelier_data');
    off(dataRef, 'value', realtimeSyncListener);
    console.log('[Firebase] Старый listener удалён');
  }
  
  const dataRef = ref(window.db, 'atelier_data');
  
  realtimeSyncListener = (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      cloudDataLoaded = true;
      console.log("[Firebase] Данные обновлены из облака, ключей:", Object.keys(data));
      
      if (typeof window.updateCloudData === 'function') {
        window.updateCloudData(data);
      }
    } else {
      console.log("[Firebase] Облако пусто — используем localStorage");
      cloudDataLoaded = true;
    }
  };
  
  onValue(dataRef, realtimeSyncListener, (error) => {
    console.error("[Firebase] Ошибка real-time listener:", error);
    cloudDataLoaded = true;
    showConnectionStatus(false);
  });
  
  // Статус онлайн/оффлайн
  const statusKey = (window.auth.currentUser.email || 'anonymous').replace(/[.#$\[\]]/g, ',');
  const statusRef = ref(window.db, 'status/' + statusKey);
  onDisconnect(statusRef).set({
    online: false,
    lastSeen: new Date().toISOString()
  });
  set(statusRef, {
    online: true,
    lastSeen: new Date().toISOString(),
    email: window.currentUserData?.email || 'anonymous'
  });
}

window.initRealtimeSync = initRealtimeSync;

// ========== ФУНКЦИЯ СИНХРОНИЗАЦИИ ==========
// Отправка идёт транзакцией: облако перезаписывается, только если оно всё ещё в той версии,
// с которой синхронизировано устройство. Иначе (облако изменили с другого устройства,
// или устройство новое) запись отменяется, данные сливаются и отправляются заново.
const SYNC_DATA_KEYS = ['colors', 'paints', 'films', 'extraRef', 'rates', 'ordersData', 'cashOps', 'bookings', 'materialTypes', 'regularExpenses', 'regularIncomes', 'notes'];
let changeCounter = 0;
let syncTimer = null;

function cleanForFirebase(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirebase);
  if (typeof obj !== 'object') return obj;

  const cleaned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const val = cleanForFirebase(obj[key]);
      if (val !== undefined) cleaned[key] = val;
    }
  }
  return cleaned;
}

window.syncToCloud = function() {
  if (!firebaseConnected || !window.db || typeof window.getSyncData !== 'function') {
    return;
  }

  const now = Date.now();
  if (now - lastSyncTime < 5000) return;
  if (syncInProgress) return;
  if (!hasUnsavedChanges) return; // Нет изменений — не отправляем

  lastSyncTime = now;
  syncInProgress = true;
  const changesAtStart = changeCounter;

  const local = window.getSyncData();
  const storedRev = localStorage.getItem('cloud_rev');
  const baseRev = storedRev === null ? null : Number(storedRev);
  const payload = {};
  SYNC_DATA_KEYS.forEach(key => { payload[key] = cleanForFirebase(local[key] || []); });

  let rejectReason = null;
  runTransaction(ref(window.db, 'atelier_data'), (current) => {
    current = current || {};
    const currentRev = Number(current.rev) || 0;
    const cloudHasData = window.syncHasData ? window.syncHasData(current) : false;

    // Защита: не перезаписываем облако с данными, если устройство не видело его текущую версию
    if (cloudHasData && (baseRev === null || currentRev !== baseRev)) {
      rejectReason = 'Облако изменено (версия ' + currentRev + ', у устройства ' + baseRev + ') — сначала сливаем';
      return; // отмена транзакции
    }
    rejectReason = null;

    return {
      ...payload,
      users: current.users || null,
      rev: currentRev + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: window.auth.currentUser ? window.auth.currentUser.email : null
    };
  }, { applyLocally: false })
    .then((result) => {
      const cloudData = result.snapshot.val() || {};
      if (result.committed) {
        localStorage.setItem('cloud_rev', String(cloudData.rev));
        if (changeCounter === changesAtStart) {
          hasUnsavedChanges = false;
          localStorage.removeItem('cloud_dirty');
        }
        console.log('[Firebase] Данные отправлены в облако, версия', cloudData.rev);
        showConnectionStatus(true);
      } else {
        console.warn('[Firebase]', rejectReason || 'Отправка отменена');
        // Сливаем облачную версию с локальной — updateCloudData сам пометит данные к отправке
        if (typeof window.updateCloudData === 'function') window.updateCloudData(cloudData);
      }
    })
    .catch((error) => {
      console.error("[Firebase] Ошибка отправки в облако:", error);
      showConnectionStatus(false);
    })
    .finally(() => {
      syncInProgress = false;
    });
};

// ========== ПОМЕТИТЬ ИЗМЕНЕНИЯ ==========
// Флаг сохраняется в localStorage, чтобы неотправленные изменения не потерялись после перезапуска
window.markChanged = function() {
  hasUnsavedChanges = true;
  changeCounter++;
  try { localStorage.setItem('cloud_dirty', '1'); } catch (e) {}

  // Отправляем вскоре после изменения, не дожидаясь периодической синхронизации
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    lastSyncTime = 0;
    window.syncToCloud();
  }, 2000);
};

// ========== ДВУСТОРОННЯЯ СИНХРОНИЗАЦИЯ ПОЛЬЗОВАТЕЛЕЙ ==========
window.syncUsersToCloud = async function() {
  if (!firebaseConnected || !window.db || !window.fbSet || !window.fbRef || !window.fbGet || !window.child) {
    return null;
  }
  
  try {
    const cloudSnapshot = await window.fbGet(window.child(window.fbRef(window.db), 'atelier_data/users'));
    const cloudUsers = cloudSnapshot.exists() ? cloudSnapshot.val() : {};
    
    const rootSnapshot = await window.fbGet(window.child(window.fbRef(window.db), 'users'));
    const rootUsers = rootSnapshot.exists() ? rootSnapshot.val() : {};
    
    const mergedUsers = {};
    for (const uid in rootUsers) {
      mergedUsers[uid] = rootUsers[uid];
    }
    for (const uid in cloudUsers) {
      if (!mergedUsers[uid]) {
        mergedUsers[uid] = cloudUsers[uid];
      }
    }
    
    console.log('[Firebase] 📊 Из /users:', Object.keys(rootUsers).length);
    console.log('[Firebase] 📊 Из /atelier_data/users:', Object.keys(cloudUsers).length);
    console.log('[Firebase] 📊 Объединено:', Object.keys(mergedUsers).length);
    
    if (Object.keys(mergedUsers).length === 0) return null;
    
    await window.fbSet(window.fbRef(window.db, 'users'), mergedUsers);
    await window.fbSet(window.fbRef(window.db, 'atelier_data/users'), mergedUsers);
    
    console.log('[Firebase] ✅ Пользователи синхронизированы:', Object.keys(mergedUsers).length);
    
    return mergedUsers;
  } catch (error) {
    console.error('[Firebase] Ошибка синхронизации пользователей:', error);
    return null;
  }
};

// ========== ИНДИКАТОР СТАТУСА ПОДКЛЮЧЕНИЯ ==========
function showConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;
  
  if (connected) {
    statusEl.style.display = 'block';
    statusEl.style.background = '#28a745';
    statusEl.textContent = '🟢 Онлайн — синхронизировано';
    setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
  } else {
    statusEl.style.display = 'block';
    statusEl.style.background = '#dc3545';
    statusEl.textContent = '🔴 Офлайн — данные не синхронизированы';
    setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
  }
}

// ========== ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ (только если есть изменения) ==========
setInterval(() => {
  if (firebaseConnected && hasUnsavedChanges && typeof window.syncToCloud === 'function') {
    window.syncToCloud();
  }
}, 30000); // 30 секунд вместо 15

// ========== СИНХРОНИЗАЦИЯ ПРИ ВОЗВРАТЕ НА ВКЛАДКУ ==========
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && firebaseConnected) {
    if (typeof window.syncToCloud === 'function') window.syncToCloud();
  }
});

window.addEventListener('focus', () => {
  if (firebaseConnected && typeof window.syncToCloud === 'function') {
    window.syncToCloud();
  }
});

window.addEventListener('online', () => {
  console.log("[Firebase] Подключение восстановлено");
  if (typeof window.syncToCloud === 'function') window.syncToCloud();
});

window.addEventListener('offline', () => {
  console.log("[Firebase] Подключение потеряно");
  showConnectionStatus(false);
});
