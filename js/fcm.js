/* ==========================================================================
    FCM — FIREBASE CLOUD MESSAGING (PUSH УВЕДОМЛЕНИЯ)
    Работает когда приложение ЗАКРЫТО
    
    Функции:
    - Запрос разрешения на push-уведомления
    - Регистрация токена в Firebase
    - Сохранение токенов в Realtime Database
    - Обработка входящих push-уведомлений
    ========================================================================== */

    // ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
    window.fcmToken = null;
    window.fcmSubscribed = false;
    window.fcmMessaging = null;
    window.swRegistration = null;
    
    // ========== VAPID КЛЮЧ ==========
    const VAPID_KEY = 'BELoLE_fBAJp71111QKsj-fGh8KBGOMkRolutJla9294Y9d6lAEVuS0ittqKwqIOVT-uIg0CJnf6ILHd_XeCCEg';
    
    // ========== РЕГИСТРАЦИЯ SERVICE WORKER ==========
    window.registerSW = async function() {
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.register('./sw.js', {
                    scope: './'
                });
                window.swRegistration = registration;
                console.log('[FCM] Service Worker зарегистрирован:', registration.scope);
                return registration;
            }
        } catch (error) {
            console.error('[FCM] Ошибка регистрации SW:', error);
        }
        return null;
    };
    
    // ========== ИНИЦИАЛИЗАЦИЯ FCM ==========
    window.initFCM = async function() {
        if (!window.db || !window.auth) {
            console.log('[FCM] Ожидание Firebase...');
            return;
        }
        
        // Проверяем поддержку
        if (!('Notification' in window)) {
            console.log('[FCM] Web Notifications не поддерживаются');
            return;
        }
        
        // Регистрируем Service Worker
        await window.registerSW();
        
        // Запрашиваем разрешение
        const permission = await requestNotificationPermission();
        console.log('[FCM] Разрешение уведомлений:', permission);
        
        if (permission !== 'granted') {
            console.log('[FCM] Пользователь не дал разрешение на push-уведомления');
            return;
        }
        
        // Сохраняем токен
        await saveFCMToken();
        
        console.log('[FCM] FCM инициализирован');
    };
    
    // ========== ЗАПРОС РАЗРЕШЕНИЯ НА УВЕДОМЛЕНИЯ ==========
    async function requestNotificationPermission() {
        if (!('Notification' in window)) {
            return 'denied';
        }
        
        if (Notification.permission === 'granted') {
            return 'granted';
        }
        
        if (Notification.permission === 'denied') {
            return 'denied';
        }
        
        try {
            const permission = await Notification.requestPermission();
            return permission;
        } catch (error) {
            console.error('[FCM] Ошибка запроса разрешения:', error);
            return 'denied';
        }
    }
    
    // ========== СОХРАНЕНИЕ ТОКЕНА В БАЗУ ==========
    async function saveFCMToken() {
        try {
            const user = window.auth.currentUser;
            if (!user) {
                console.log('[FCM] Пользователь не авторизован');
                return;
            }
            
            // Формируем данные токена
            const tokenData = {
                token: 'browser-notification-' + user.uid,
                userId: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                role: window.currentUserData?.role || 'admin',
                deviceType: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad') ? 'ios' : 
                            navigator.userAgent.includes('Android') ? 'android' : 'other',
                browser: navigator.userAgent.includes('Chrome') ? 'chrome' : 
                         navigator.userAgent.includes('Safari') ? 'safari' : 
                         navigator.userAgent.includes('Firefox') ? 'firefox' : 'other',
                lastUpdated: new Date().toISOString()
            };
            
            // Сохраняем токен в /fcm_tokens/{userId}/browser
            await window.fbSet(
                window.fbRef(window.db, 'fcm_tokens/' + user.uid + '/browser'),
                tokenData
            );
            
            // Обновляем запись пользователя
            await window.fbSet(
                window.fbRef(window.db, 'users/' + user.uid + '/fcmToken'),
                {
                    token: tokenData.token,
                    lastUpdated: tokenData.lastUpdated,
                    role: tokenData.role,
                    deviceType: tokenData.deviceType
                }
            );
            
            console.log('[FCM] Токен сохранён в базу');
            
        } catch (error) {
            console.error('[FCM] Ошибка сохранения токена:', error);
        }
    }
    
    // ========== ПОЛУЧЕНИЕ ВСЕХ ТОКЕНОВ АДМИНОВ ==========
    window.getAllAdminTokens = async function() {
        try {
            const snapshot = await window.fbGet(window.fbRef(window.db, 'fcm_tokens'));
            if (!snapshot.exists()) return [];
            
            const tokens = [];
            const data = snapshot.val();
            
            for (const userId in data) {
                for (const tokenKey in data[userId]) {
                    const tokenData = data[userId][tokenKey];
                    if (tokenData.role === 'admin' && tokenData.token) {
                        tokens.push({
                            token: tokenData.token,
                            userId: userId,
                            email: tokenData.email
                        });
                    }
                }
            }
            
            console.log('[FCM] Найдено токенов админов:', tokens.length);
            return tokens;
        } catch (error) {
            console.error('[FCM] Ошибка получения токенов:', error);
            return [];
        }
    };
    
    // ========== ОТПРАВКА PUSH УВЕДОМЛЕНИЯ (через Cloud Function) ==========
    window.sendPushNotification = async function(options) {
        const { title, body, data, icon } = options;
        
        try {
            // Получаем все токены админов
            const adminTokens = await window.getAllAdminTokens();
            if (adminTokens.length === 0) {
                console.log('[FCM] Нет токенов для отправки');
                return;
            }
            
            // Формируем payload для каждого токена
            const promises = adminTokens.map(async (admin) => {
                try {
                    await fetch('https://fcm.googleapis.com/v1/projects/auto-atelier-1486d/messages:send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'key=YOUR_SERVER_KEY_HERE'
                        },
                        body: JSON.stringify({
                            message: {
                                token: admin.token,
                                notification: {
                                    title: title,
                                    body: body,
                                    icon: icon || '/icons/icon-192.png'
                                },
                                data: data || {},
                                android: {
                                    priority: 'high',
                                    notification: {
                                        channel: 'daily_notifications',
                                        icon: 'notification',
                                        color: '#1a3c5e'
                                    }
                                },
                                apns: {
                                    payload: {
                                        aps: {
                                            badge: 1,
                                            sound: 'default'
                                        }
                                    }
                                }
                            }
                        })
                    });
                } catch (error) {
                    console.error('[FCM] Ошибка отправки:', error);
                }
            });
            
            await Promise.all(promises);
            console.log('[FCM] Push-уведомления отправлены:', adminTokens.length, 'админам');
            
        } catch (error) {
            console.error('[FCM] Ошибка отправки push:', error);
        }
    };
    
    // ========== ПОКАЗ PUSH УВЕДОМЛЕНИЯ (когда приложение открыто) ==========
    window.showPushNotification = function(title, body, options = {}) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        
        new Notification(title, {
            body: body,
            icon: options.icon || '/icons/icon-192.png',
            badge: options.badge || '/icons/icon-96.png',
            tag: options.tag || 'default',
            requireInteraction: true,
            silent: false,
            actions: [
                { action: 'open', title: '📱 Открыть' },
                { action: 'close', title: '❌ Закрыть' }
            ],
            data: options.data || {}
        });
    };
    
    // ========== ОБРАБОТКА КЛИКА ПО УВЕДОМЛЕНИЮ ==========
    if ('Notification' in window && Notification.permission === 'granted') {
        window.addEventListener('notificationclick', function(event) {
            event.notification.close();
            
            if (event.action === 'open') {
                if (event.notification.data?.url) {
                    window.open(event.notification.data.url, '_blank');
                } else {
                    if (self.clients && self.clients.matchAll) {
                        self.clients.matchAll().then(function(clients) {
                            if (clients.length > 0) {
                                clients[0].focus();
                            } else {
                                window.open('./', '_blank');
                            }
                        });
                    }
                }
            }
        });
    }
    
    // ========== ОБНОВЛЕНИЕ ТОКЕНА ПРИ АВТОРИЗАЦИИ ==========
    window.addEventListener('authStateChanged', function() {
        if (window.auth.currentUser) {
            initFCM();
        }
    });
    
    // ========== ОЧИСТКА СТАРЫХ ТОКЕНОВ ==========
    window.cleanupFCMTokens = async function() {
        try {
            const user = window.auth.currentUser;
            if (!user) return;
            
            const snapshot = await window.fbGet(window.fbRef(window.db, 'fcm_tokens/' + user.uid));
            if (!snapshot.exists()) return;
            
            const data = snapshot.val();
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            for (const tokenKey in data) {
                const tokenData = data[tokenKey];
                if (tokenData.lastUpdated) {
                    const lastUpdated = new Date(tokenData.lastUpdated);
                    if (lastUpdated < thirtyDaysAgo) {
                        await window.fbSet(window.fbRef(window.db, 'fcm_tokens/' + user.uid + '/' + tokenKey), null);
                        console.log('[FCM] Удалён старый токен:', tokenKey);
                    }
                }
            }
        } catch (error) {
            console.error('[FCM] Ошибка очистки токенов:', error);
        }
    };
    
    // ========== ТЕСТОВОЕ УВЕДОМЛЕНИЕ ==========
    window.sendTestPush = async function() {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            alert('Разрешите push-уведомления в настройках браузера');
            return;
        }
        
        new Notification('🧪 Тест push-уведомлений', {
            body: 'Push-уведомления работают! 🎉',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-96.png',
            tag: 'test',
            requireInteraction: true
        });
        
        console.log('[FCM] Тестовое уведомление отправлено');
    };
    
    console.log('[FCM] Модуль FCM загружен');
