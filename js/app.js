(function () {
    var tabBtns = document.querySelectorAll('.tab-btn');
    var panels = document.querySelectorAll('.tab-panel');

    function activate(tabId) {
        tabBtns.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        panels.forEach(function (panel) {
            panel.classList.toggle('active', panel.id === 'tab-' + tabId);
        });
        history.replaceState(null, '', '#' + tabId);
    }

    tabBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.classList.contains('disabled')) {
                btn.classList.remove('shake');
                void btn.offsetWidth; // 리플레이를 위한 리플로우 강제
                btn.classList.add('shake');
                return;
            }
            activate(btn.dataset.tab);
        });
    });

    // 홈 탭의 탐색 분류 카드 → 해당 알고리즘 탭으로 이동
    document.querySelectorAll('[data-goto]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            var target = document.querySelector('.tab-btn[data-tab="' + link.dataset.goto + '"]');
            if (!target || target.classList.contains('disabled')) return;
            activate(link.dataset.goto);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    document.querySelectorAll('[data-accordion-trigger]').forEach(function (trigger) {
        trigger.addEventListener('click', function () {
            if (trigger.disabled) return;
            trigger.closest('[data-accordion-item]').classList.toggle('open');
        });
    });

    // 탭 통합 이전에 배포된 #dfs, #bfs 링크도 통합 탭으로 연결
    var LEGACY_TABS = { dfs: 'dfs-bfs', bfs: 'dfs-bfs' };

    var initial = (location.hash || '').replace('#', '');
    if (LEGACY_TABS[initial]) initial = LEGACY_TABS[initial];
    var initialBtn = document.querySelector('.tab-btn[data-tab="' + initial + '"]');
    if (initialBtn && !initialBtn.classList.contains('disabled')) {
        activate(initial);
    } else if (tabBtns.length) {
        activate(tabBtns[0].dataset.tab);
    }
})();
