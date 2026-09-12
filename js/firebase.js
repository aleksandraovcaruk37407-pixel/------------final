import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue, off, onDisconnect } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
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
window.fbGet = get;
window.fbChild = child;
window.onAuthStateChanged = onAuthStateChanged;
window.signOut = signOut;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.updateProfile = updateProfile;

let firebaseConnected = false;
let cloudDataLoaded = false;
let lastSyncTime = 0;
let syncInProgress = false;

// ========== ФЛАГ ГОТОВНОСТИ FIREBASE ==========
// Устанавливается сразу после инициализации (до авторизации)
window.firebaseReady = true;
console.log('[Firebase] Инициализация завершена, window.firebaseReady = true');

// ========== ОБРАБОТКА СОСТОЯНИЯ АВТОРИЗАЦИИ ==========
onAuthStateChanged(window.auth, (user) => {
  if (user) {
    console.log("[Firebase] Пользователь авторизован, uid:", user.uid);
    firebaseConnected = true;
    initRealtimeSync();
  } else {
    console.log("[Firebase] Пользователь не авторизован — синхронизация не активна");
    firebaseConnected = false;
  }
});

// ========== ГЛОБАЛЬНАЯ ПРОВЕРКА АВТОРИЗАЦИИ (вызывается ПОСЛЕ загрузки app.js) ==========
window.initAuthState = function() {
  console.log('[Auth] initAuthState вызван');
  
  onAuthStateChanged(window.auth, (user) => {
    console.log('onAuthStateChanged: user есть, uid =', user ? user.uid : 'null');
    if (user) {
      // Пользователь авторизован - показываем приложение
      console.log('Пользователь авторизован:', user.email);
      
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appContent').style.display = 'block';
      
      // Создаём запись пользователя в базе, если её нет, затем загружаем данные
      console.log('Проверяю запись пользователя в базе...');
      window.fbGet(window.fbChild(window.fbRef(window.db), 'users/' + user.uid)).then((snapshot) => {
        console.log('Пользователь найден в базе:', snapshot.exists());
        if (!snapshot.exists()) {
          console.log('Создаю запись пользователя...');
          return window.fbSet(window.fbRef(window.db, 'users/' + user.uid), {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0] || 'Пользователь',
            role: 'admin',
            createdAt: new Date().toISOString()
          }).then(() => {
            console.log('Запись пользователя создана успешно');
          }).catch(err => {
            console.error('Ошибка создания записи пользователя:', err);
          });
        }
      }).then(() => {
        console.log('Вызываю getUserDataForAuth...');
        // Дождаемся синхронизации перед чтением
        setTimeout(() => {
          if (typeof window.getUserDataForAuth === 'function') {
            window.getUserDataForAuth(user);
          } else {
            console.error('getUserDataForAuth не определена!');
          }
        }, 500);
      }).catch(err => {
        console.error('Ошибка работы с пользователем:', err);
        // Даже если ошибка — пробуем войти
        setTimeout(() => {
          if (typeof window.getUserDataForAuth === 'function') {
            window.getUserDataForAuth(user);
          }
        }, 500);
      });
    } else {
      // Пользователь не авторизован - показываем экран входа
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
function initRealtimeSync() {
  const dataRef = ref(window.db, 'atelier_data');
  
  // Слушаем изменения в облаке
  onValue(dataRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      cloudDataLoaded = true;
      console.log("[Firebase] Данные загружены из облака, ключей:", Object.keys(data));
      
      // Проверяем, что функция updateCloudData доступна
      if (typeof window.updateCloudData === 'function') {
        // Устанавливаем флаг, что данные пришли из облака
        window.localChangesPending = true;
        window.updateCloudData(data);
        
        // Сбрасываем флаг через 1 секунду
        setTimeout(() => {
          if (window.localChangesPending !== undefined) {
            window.localChangesPending = false;
          }
        }, 1000);
      }
    } else {
      console.log("[Firebase] Облако пусто — используем localStorage");
      cloudDataLoaded = true;
    }
  }, (error) => {
    console.error("[Firebase] Ошибка real-time listener:", error);
    cloudDataLoaded = true;
    showConnectionStatus(false);
  });
  
  // Отмечаем пользователя как "онлайн"
  const statusRef = ref(window.db, 'status/' + (window.currentUserData?.email || 'anonymous'));
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

// ========== ФУНКЦИЯ СИНХРОНИЗАЦИИ (вызывается из app.js) ==========
window.syncToCloud = function() {
  if (!firebaseConnected || !window.db || !window.fbSet || !window.fbRef) {
    return;
  }
  
  // Debounce — не чаще 1 раза в 2 секунды
  const now = Date.now();
  if (now - lastSyncTime < 2000) return;
  if (syncInProgress) return;
  
  lastSyncTime = now;
  syncInProgress = true;
  
  try {
    // Очищаем от undefined/null значений
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
    
    const syncPayload = {
      colors: cleanForFirebase(window.colors || []),
      paints: cleanForFirebase(window.paints || []),
      films: cleanForFirebase(window.films || []),
      extraRef: cleanForFirebase(window.extraRef || []),
      rates: cleanForFirebase(window.rates || []),
      ordersData: cleanForFirebase(window.ordersData || []),
      cashOps: cleanForFirebase(window.cashOps || []),
      bookings: cleanForFirebase(window.bookings || []),
      materialTypes: cleanForFirebase(window.materialTypes || []),
      regularExpenses: cleanForFirebase(window.regularExpenses || []),
      regularIncomes: cleanForFirebase(window.regularIncomes || []),
      notes: cleanForFirebase(window.notes || []),
      updatedAt: new Date().toISOString()
    };
    
    window.fbSet(window.fbRef(window.db, 'atelier_data'), syncPayload)
      .then(() => {
        console.log("[Firebase] Данные отправлены в облако");
        showConnectionStatus(true);
      })
      .catch((error) => {
        console.error("[Firebase] Ошибка отправки в облако:", error);
        showConnectionStatus(false);
      })
      .finally(() => {
        syncInProgress = false;
      });
  } catch (error) {
    console.error("[Firebase] Ошибка подготовки данных:", error);
    syncInProgress = false;
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
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  } else {
    statusEl.style.display = 'block';
    statusEl.style.background = '#dc3545';
    statusEl.textContent = '🔴 Офлайн — данные не синхронизированы';
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 5000);
  }
}

// ========== ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ ==========
setInterval(() => {
  if (firebaseConnected && typeof window.syncToCloud === 'function') {
    console.log("[Firebase] Периодическая синхронизация...");
    window.syncToCloud();
  }
}, 15000);

// ========== СИНХРОНИЗАЦИЯ ПРИ ВОЗВРАТЕ НА ВКЛАДКУ ==========
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && firebaseConnected) {
    console.log("[Firebase] Вкладка активна — синхронизация");
    if (typeof window.syncToCloud === 'function') {
      window.syncToCloud();
    }
  }
});

// ========== СИНХРОНИЗАЦИЯ ПРИ ВОЗВРАТЕ ФОКУСА ==========
window.addEventListener('focus', () => {
  if (firebaseConnected) {
    console.log("[Firebase] Окно в фокусе — синхронизация");
    if (typeof window.syncToCloud === 'function') {
      window.syncToCloud();
    }
  }
});

// ========== ОБРАБОТКА ОТСУТСТВИЯ ИНТЕРНЕТА ==========
window.addEventListener('online', () => {
  console.log("[Firebase] Подключение восстановлено — синхронизация...");
  if (typeof window.syncToCloud === 'function') {
    window.syncToCloud();
  }
});

window.addEventListener('offline', () => {
  console.log("[Firebase] Подключение потеряно");
  showConnectionStatus(false);
});
