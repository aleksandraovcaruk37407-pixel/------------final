/* ==========================================================================
   МОБИЛЬНАЯ ОПТИМИЗАЦИЯ — iOS & Android
   ========================================================================== */

(function() {
    'use strict';

    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    var isAndroid = /Android/.test(navigator.userAgent);
    var isSmallScreen = window.innerWidth <= 768;

    function applySafeAreas() {
        if (isIOS || isAndroid) {
            document.documentElement.style.setProperty('--safe-top', 'env(safe-area-inset-top, 0px)');
            document.documentElement.style.setProperty('--safe-bottom', 'env(safe-area-inset-bottom, 0px)');
            document.documentElement.style.setProperty('--safe-left', 'env(safe-area-inset-left, 0px)');
            document.documentElement.style.setProperty('--safe-right', 'env(safe-area-inset-right, 0px)');
        }
    }

    function initMobileNav() {
        if (!isMobile && !isSmallScreen) return;

        var desktopTabs = document.querySelector('.desktop-tabs');
        if (desktopTabs) desktopTabs.style.display = 'none';

        var adminNav = document.getElementById('adminBottomNav');
        if (adminNav) {
            var adminItems = adminNav.querySelectorAll('.bottom-nav-item');
            adminItems.forEach(function(item) {
                item.addEventListener('click', function() {
                    var tabId = this.getAttribute('data-tab');
                    if (!tabId) return;
                    switchToTab(tabId, adminNav);
                });
            });

            var moreBtn = adminNav.querySelector('.bottom-nav-more');
            if (moreBtn) {
                moreBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var moreMenu = document.getElementById('bottomNavMoreMenu');
                    if (moreMenu) moreMenu.classList.toggle('visible');
                });
            }
        }

        var helperNav = document.getElementById('helperBottomNav');
        if (helperNav) {
            var helperItems = helperNav.querySelectorAll('.bottom-nav-item');
            helperItems.forEach(function(item) {
                item.addEventListener('click', function() {
                    var tabId = this.getAttribute('data-tab');
                    if (!tabId) return;
                    switchToTab(tabId, helperNav);
                });
            });
        }

        var moreMenu = document.getElementById('bottomNavMoreMenu');
        if (moreMenu) {
            var moreItems = moreMenu.querySelectorAll('.bottom-nav-more-item[data-tab]');
            moreItems.forEach(function(item) {
                item.addEventListener('click', function() {
                    var tabId = this.getAttribute('data-tab');
                    if (!tabId) return;
                    switchToTab(tabId, moreMenu);
                });
            });
        }

        document.addEventListener('click', function(e) {
            if (moreMenu && adminNav) {
                var moreBtn = adminNav.querySelector('.bottom-nav-more');
                if (!moreMenu.contains(e.target) && (!moreBtn || !moreBtn.contains(e.target))) {
                    moreMenu.classList.remove('visible');
                }
            }
        });
    }

    function switchToTab(tabId, navContainer) {
        var tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(function(content) { content.classList.remove('active'); });

        var targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('active');

        if (navContainer) {
            var items = navContainer.querySelectorAll('.bottom-nav-item, .bottom-nav-more-item');
            items.forEach(function(btn) { btn.classList.remove('active'); });
            var activeBtn = navContainer.querySelector('[data-tab="' + tabId + '"]');
            if (activeBtn) activeBtn.classList.add('active');
        }

        if (tabId === 'tab-calendar' && typeof renderCalendar === 'function') renderCalendar();
        if (tabId === 'tab-ref' && typeof renderRefs === 'function') renderRefs();
        if (tabId === 'tab-purchase' && typeof renderPurchaseOrdersList === 'function') renderPurchaseOrdersList();
        if (tabId === 'tab-stock' && typeof renderStock === 'function') renderStock();
        if (tabId === 'tab-cash' && typeof renderCash === 'function') renderCash();
        if (tabId === 'helper-tasks' && typeof renderHelperTasks === 'function') renderHelperTasks();
        if (tabId === 'helper-report' && typeof renderHelperReport === 'function') renderHelperReport();
        if (tabId === 'tab-helper-admin') {
            if (typeof updateHelperFilter === 'function') updateHelperFilter();
            if (typeof renderAdminHelperTasks === 'function') renderAdminHelperTasks();
            if (typeof renderAdminNotifications === 'function') renderAdminNotifications();
            if (typeof listAllHelpersInDB === 'function') listAllHelpersInDB();
        }
        if (tabId === 'helper-report') {
            if (typeof renderHelperNotifications === 'function') renderHelperNotifications();
        }

        if (navigator.vibrate) navigator.vibrate(10);

        var moreMenu = document.getElementById('bottomNavMoreMenu');
        if (moreMenu) moreMenu.classList.remove('visible');
    }

    function observeRoleChanges() {
        var adminNav = document.getElementById('adminBottomNav');
        var helperNav = document.getElementById('helperBottomNav');
        
        if (adminNav && helperNav) {
            var observer = new MutationObserver(function() {
                var adminVisible = adminNav.style.display === 'flex' || adminNav.classList.contains('visible');
                var helperVisible = helperNav.style.display === 'flex' || helperNav.classList.contains('visible');
                
                if (!adminVisible && !helperVisible) {
                    if (window.currentUserData && window.currentUserData.role === 'admin') {
                        adminNav.style.display = 'flex';
                        adminNav.classList.add('visible');
                    } else {
                        helperNav.style.display = 'flex';
                        helperNav.classList.add('visible');
                    }
                }
            });
            
            observer.observe(adminNav, { attributes: true, attributeFilter: ['style', 'class'] });
            observer.observe(helperNav, { attributes: true, attributeFilter: ['style', 'class'] });
        }
    }

    function initSwipeGestures() {
        if (!isMobile) return;

        var touchStartX = 0;
        var touchStartY = 0;
        var touchEndX = 0;
        var touchEndY = 0;
        var minSwipeDistance = 80;

        var adminTabOrder = ['tab-orders', 'tab-calendar', 'tab-purchase', 'tab-helper-admin', 'tab-stock', 'tab-cash', 'tab-summary', 'tab-ref'];
        var helperTabOrder = ['helper-tasks', 'helper-report'];

        document.addEventListener('touchstart', function(e) {
            if (e.target.closest('.modal') || e.target.closest('.modal-overlay')) return;
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        document.addEventListener('touchend', function(e) {
            if (e.target.closest('.modal') || e.target.closest('.modal-overlay')) return;
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            var diffX = touchEndX - touchStartX;
            var diffY = touchEndY - touchStartY;

            if (Math.abs(diffX) < Math.abs(diffY) || Math.abs(diffX) < minSwipeDistance) return;

            var currentTab = document.querySelector('.tab-content.active');
            if (!currentTab) return;

            var tabOrder = currentTab.id === 'helper-tasks' || currentTab.id === 'helper-report' 
                ? helperTabOrder : adminTabOrder;

            var currentIndex = tabOrder.indexOf(currentTab.id);
            if (currentIndex === -1) return;

            if (diffX < -minSwipeDistance && currentIndex < tabOrder.length - 1) {
                switchToTab(tabOrder[currentIndex + 1]);
            } else if (diffX > minSwipeDistance && currentIndex > 0) {
                switchToTab(tabOrder[currentIndex - 1]);
            }
        }
    }

    function initMobileModals() {
        if (!isMobile) return;

        var orderModal = document.getElementById('orderModal');
        if (orderModal) {
            orderModal.addEventListener('click', function(e) {
                if (e.target === orderModal) {
                    orderModal.classList.remove('active');
                }
            });
        }
    }

    function hideMobileButtons() {
        if (!isMobile && !isSmallScreen) return;

        var exportBtn = document.querySelector('button[onclick="exportData()"]');
        if (exportBtn) exportBtn.style.display = 'none';

        var importBtn = document.querySelector('button[onclick*="fileInput"].click()');
        if (importBtn) importBtn.style.display = 'none';

        var calendarExportBtns = document.querySelectorAll('#tab-calendar button[title="Экспорт"]');
        if (calendarExportBtns.length > 1) {
            for (var i = 1; i < calendarExportBtns.length; i++) {
                calendarExportBtns[i].style.display = 'none';
            }
        }

        var summaryExportBtn = document.querySelector('button[onclick="exportSummaryReport()"]');
        if (summaryExportBtn) summaryExportBtn.style.display = 'none';
    }

    function initKeyboardHandling() {
        if (!isMobile) return;

        var inputs = document.querySelectorAll('input, textarea, [contenteditable]');
        var lastFocused = null;

        inputs.forEach(function(input) {
            input.addEventListener('focus', function() {
                lastFocused = this;
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

    function preventZoom() {
        // Отключаем двойной тап для зума - но только для элементов кроме input
        var lastTouchEnd = 0;
        document.addEventListener('touchend', function(e) {
            // Не блокируем если клик по input/select/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            var now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    function optimizePerformance() {
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = function(callback) {
                return setTimeout(callback, 1000 / 60);
            };
        }

        var resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                isSmallScreen = window.innerWidth <= 768;
                applySafeAreas();
            }, 250);
        });
    }

    function initOfflineHandling() {
        window.addEventListener('offline', function() {
            showMobileNotification('⚠️ Нет подключения к интернету', '#ffc107');
        });

        window.addEventListener('online', function() {
            showMobileNotification('✅ Подключение восстановлено', '#28a745');
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

    function init() {
        applySafeAreas();
        initMobileNav();
        initSwipeGestures();
        initMobileModals();
        hideMobileButtons();
        initKeyboardHandling();
        preventZoom();
        optimizePerformance();
        initOfflineHandling();
        observeRoleChanges();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
