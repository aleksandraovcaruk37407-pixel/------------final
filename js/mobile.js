/* ==========================================================================
   МОБИЛЬНАЯ ОПТИМИЗАЦИЯ — iOS & Android
   ========================================================================== */

(function() {
    'use strict';

    // ========== ОПРЕДЕЛЕНИЕ МОБИЛЬНОГО УСТРОЙСТВА ==========
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    var isAndroid = /Android/.test(navigator.userAgent);
    var isSmallScreen = window.innerWidth <= 768;

    // ========== SAFE AREAS (iPhone notch, Android nav bar) ==========
    function applySafeAreas() {
        if (isIOS || isAndroid) {
            document.documentElement.style.setProperty('--safe-top', 'env(safe-area-inset-top, 0px)');
            document.documentElement.style.setProperty('--safe-bottom', 'env(safe-area-inset-bottom, 0px)');
            document.documentElement.style.setProperty('--safe-left', 'env(safe-area-inset-left, 0px)');
            document.documentElement.style.setProperty('--safe-right', 'env(safe-area-inset-right, 0px)');
        }
    }

    // ========== МОБИЛЬНАЯ НАВИГАЦИЯ ==========
    function initMobileNav() {
        if (!isMobile && !isSmallScreen) return;

        // Показываем нижнюю навигацию (bottom-nav)
        var adminNav = document.getElementById('adminBottomNav');
        var helperNav = document.getElementById('helperBottomNav');
        
        if (adminNav) {
            adminNav.classList.add('visible');
            adminNav.style.display = 'flex';
        }
        if (helperNav) {
            helperNav.classList.add('visible');
            helperNav.style.display = 'flex';
        }

        // Скрываем десктопные табы
        var desktopTabs = document.querySelector('.desktop-tabs');
        if (desktopTabs) {
            desktopTabs.style.display = 'none';
        }

        // Обработчики для кнопок нижней навигации
        var navItems = document.querySelectorAll('.bottom-nav-item, .bottom-nav-more-item');
        navItems.forEach(function(item) {
            item.addEventListener('click', function(e) {
                var tabId = this.getAttribute('data-tab');
                if (!tabId) return;

                // Убираем активный класс у всех кнопок в той же навигации
                var parentNav = this.closest('.bottom-nav, .bottom-nav-more-menu');
                if (parentNav) {
                    parentNav.querySelectorAll('.bottom-nav-item, .bottom-nav-more-item').forEach(function(nav) {
                        nav.classList.remove('active');
                    });
                }
                this.classList.add('active');

                // Переключаем контент
                var tabContents = document.querySelectorAll('.tab-content');
                tabContents.forEach(function(content) { content.classList.remove('active'); });

                var targetTab = document.getElementById(tabId);
                if (targetTab) {
                    targetTab.classList.add('active');
                }

                // Обновляем данные вкладки
                if (tabId === 'tab-calendar' && typeof renderCalendar === 'function') {
                    renderCalendar();
                }
                if (tabId === 'tab-ref' && typeof renderRefs === 'function') {
                    renderRefs();
                }
                if (tabId === 'tab-purchase' && typeof renderPurchaseOrdersList === 'function') {
                    renderPurchaseOrdersList();
                }
                if (tabId === 'helper-tasks' && typeof renderHelperTasks === 'function') {
                    renderHelperTasks();
                }
                if (tabId === 'helper-report' && typeof renderHelperReport === 'function') {
                    renderHelperReport();
                }
                if (tabId === 'tab-helper-admin') {
                    if (typeof updateHelperFilter === 'function') updateHelperFilter();
                    if (typeof renderAdminHelperTasks === 'function') renderAdminHelperTasks();
                    if (typeof renderAdminNotifications === 'function') renderAdminNotifications();
                    if (typeof listAllHelpersInDB === 'function') listAllHelpersInDB();
                }
                if (tabId === 'helper-report') {
                    if (typeof renderHelperNotifications === 'function') renderHelperNotifications();
                }

                // Вибрация при нажатии (если поддерживается)
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }

                // Закрываем меню "Ещё" если открыто
                var moreMenu = document.getElementById('bottomNavMoreMenu');
                if (moreMenu) {
                    moreMenu.classList.remove('visible');
                }
            });
        });

        // Обработчик для кнопки "Ещё"
        var moreBtn = document.querySelector('.bottom-nav-more');
        if (moreBtn) {
            moreBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var moreMenu = document.getElementById('bottomNavMoreMenu');
                if (moreMenu) {
                    moreMenu.classList.toggle('visible');
                }
            });
        }

        // Закрываем меню "Ещё" при клике вне его
        document.addEventListener('click', function(e) {
            var moreMenu = document.getElementById('bottomNavMoreMenu');
            var moreBtn = document.querySelector('.bottom-nav-more');
            if (moreMenu && moreBtn && !moreMenu.contains(e.target) && !moreBtn.contains(e.target)) {
                moreMenu.classList.remove('visible');
            }
        });
    }

    // ========== ЖЕСТЫ (SWIPE) ==========
    function initSwipeGestures() {
        if (!isMobile) return;

        var touchStartX = 0;
        var touchStartY = 0;
        var touchEndX = 0;
        var touchEndY = 0;
        var minSwipeDistance = 50;

        var tabOrder = ['tab-orders', 'tab-calendar', 'tab-ref', 'tab-purchase', 'tab-budget', 'tab-helper', 'tab-cash', 'tab-summary', 'tab-settings'];

        document.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            var diffX = touchEndX - touchStartX;
            var diffY = touchEndY - touchStartY;

            // Определяем направление (горизонтальный свайп)
            if (Math.abs(diffX) > Math.abs(diffY)) {
                var currentTab = document.querySelector('.tab-content.active');
                if (!currentTab) return;

                var currentIndex = tabOrder.indexOf(currentTab.id);
                if (currentIndex === -1) return;

                // Свайп влево — следующая вкладка
                if (diffX > minSwipeDistance && currentIndex < tabOrder.length - 1) {
                    switchToTab(tabOrder[currentIndex + 1]);
                }
                // Свайп вправо — предыдущая вкладка
                else if (diffX < -minSwipeDistance && currentIndex > 0) {
                    switchToTab(tabOrder[currentIndex - 1]);
                }
            }
        }

        function switchToTab(tabId) {
            // Обновляем контент
            var tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(function(content) { content.classList.remove('active'); });

            var targetTab = document.getElementById(tabId);
            if (targetTab) {
                targetTab.classList.add('active');
            }

            // Обновляем кнопки навигации
            var navItems = document.querySelectorAll('.mobile-nav-item');
            navItems.forEach(function(item) {
                item.classList.remove('active');
                if (item.getAttribute('data-tab') === tabId) {
                    item.classList.add('active');
                }
            });

            // Вибрация
            if (navigator.vibrate) {
                navigator.vibrate(15);
            }

            // Обновляем данные
            if (typeof renderCalendar === 'function' && tabId === 'tab-calendar') renderCalendar();
            if (typeof renderRefs === 'function' && tabId === 'tab-ref') renderRefs();
            if (typeof renderPurchaseOrdersList === 'function' && tabId === 'tab-purchase') renderPurchaseOrdersList();
        }
    }

    // ========== МОБИЛЬНЫЕ МОДАЛЬНЫЕ ОКНА (BOTTOM SHEET) ==========
    function initMobileModals() {
        if (!isMobile) return;

        var modal = document.getElementById('orderModal');
        if (!modal) return;

        var modalContent = modal;
        var touchStartY = 0;
        var currentTranslateY = 0;
        var isDragging = false;

        // Добавляем handle для перетаскивания
        var handle = document.createElement('div');
        handle.className = 'modal-handle';
        modalContent.insertBefore(handle, modalContent.firstChild);

        modalContent.addEventListener('touchstart', function(e) {
            touchStartY = e.touches[0].clientY;
            isDragging = true;
            modalContent.style.transition = 'none';
        }, { passive: true });

        modalContent.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            var touchY = e.touches[0].clientY;
            var diff = touchY - touchStartY;

            // Разрешаем тянуть только вниз
            if (diff > 0) {
                currentTranslateY = diff;
                modalContent.style.transform = 'translateY(' + currentTranslateY + 'px)';
            }
        }, { passive: true });

        modalContent.addEventListener('touchend', function() {
            isDragging = false;
            modalContent.style.transition = 'transform 0.3s ease';

            // Если потянули вниз больше чем на 100px — закрываем
            if (currentTranslateY > 100) {
                closeModal();
            } else {
                modalContent.style.transform = 'translateY(0)';
            }
            currentTranslateY = 0;
        });
    }

    // ========== УПРАВЛЕНИЕ КЛАВИАТУРОЙ ==========
    function initKeyboardHandling() {
        if (!isMobile) return;

        var inputs = document.querySelectorAll('input, textarea, [contenteditable]');
        var lastFocused = null;

        inputs.forEach(function(input) {
            input.addEventListener('focus', function() {
                lastFocused = this;
                // Небольшая задержка для прокрутки
                setTimeout(function() {
                    if (lastFocused && lastFocused.offsetParent) {
                        lastFocused.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            });

            input.addEventListener('blur', function() {
                lastFocused = null;
            });
        });
    }

    // ========== ПРЕДОТВРАЩЕНИЕ НЕЖЕЛАТЕЛЬНОГО ЗУМА ==========
    function preventZoom() {
        // Запрещаем двойной тап для зума
        var lastTouchEnd = 0;
        document.addEventListener('touchend', function(e) {
            var now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    // ========== ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ ==========
    function optimizePerformance() {
        // Используем requestAnimationFrame для анимаций
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = function(callback) {
                return setTimeout(callback, 1000 / 60);
            };
        }

        // Дебаунс для resize событий
        var resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                isSmallScreen = window.innerWidth <= 768;
                // Пересчитываем safe areas
                applySafeAreas();
            }, 250);
        });
    }

    // ========== ОБРАБОТКА ОТСУТСТВИЯ ИНТЕРНЕТА ==========
    function initOfflineHandling() {
        // Показываем уведомление при потере соединения
        window.addEventListener('offline', function() {
            showMobileNotification('⚠️ Нет подключения к интернету', '#ffc107');
        });

        window.addEventListener('online', function() {
            showMobileNotification('✅ Подключение восстановлено', '#28a745');
            // Синхронизируем данные
            if (typeof window.syncToCloud === 'function') {
                window.syncToCloud();
            }
        });
    }

    function showMobileNotification(message, color) {
        var existing = document.querySelector('.mobile-notification');
        if (existing) existing.remove();

        var notification = document.createElement('div');
        notification.className = 'mobile-notification';
        notification.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:' + color + 
            ';color:#fff;padding:12px 20px;border-radius:25px;font-size:14px;font-weight:600;z-index:99999;' +
            'box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:90%;text-align:center;';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(function() {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    function init() {
        applySafeAreas();
        initMobileNav();
        initSwipeGestures();
        initMobileModals();
        initKeyboardHandling();
        preventZoom();
        optimizePerformance();
        initOfflineHandling();
    }

    // Запускаем инициализацию
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
