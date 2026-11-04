/* ==========================================================================
   ПОДСКАЗКИ ПОД ЛАМПОЧКОЙ 💡 (05.11.2026).
   Длинные пояснения в программе спрятаны: на их месте маленькая кнопка 💡,
   нажатие — показать / спрятать текст. Работает и для того, что рисуется позже
   (окна, вкладки): за страницей следит MutationObserver.
   Что считается подсказкой — HINT_SELECTORS; новой подсказке достаточно класса ba-hint.
   ========================================================================== */

const HINT_SELECTORS = [
    '.ba-hint', '.note', '.svc-help', '.fin-funds-help',
    'p[style*="color:#6c757d"]', 'p[style*="color: #6c757d"]', 'small[style*="color:#888"]'
].join(',');

function baHintify(root) {
    (root || document).querySelectorAll(HINT_SELECTORS).forEach(el => {
        if (el.dataset.hint || el.closest('.ba-hint-open-keep')) return;
        el.dataset.hint = '1';
        el.classList.add('ba-hint-text');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ba-hint-btn';
        btn.title = 'Подсказка';
        btn.setAttribute('aria-label', 'Показать подсказку');
        btn.textContent = '💡';
        btn.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            const open = el.classList.toggle('ba-hint-shown');
            btn.classList.toggle('on', open);
        });
        el.parentNode.insertBefore(btn, el);
    });
}

let baHintTimer = null;
if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', () => {
        baHintify(document);
        new MutationObserver(() => {
            clearTimeout(baHintTimer);
            baHintTimer = setTimeout(() => baHintify(document), 60);
        }).observe(document.body, { childList: true, subtree: true });
    });
}
window.baHintify = baHintify;
