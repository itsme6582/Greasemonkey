// ==UserScript==
// @name         DigiManager Select All + Progress Bar
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adds Select All button with progress bar to property dropdown
// @match        https://jpa.bbhnow.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function findDropdownContainer() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');

        for (let cb of checkboxes) {
            const container = cb.closest('div[role="presentation"], .MuiPaper-root');
            if (container && container.offsetParent !== null) {
                return container;
            }
        }
        return null;
    }

    function injectUI(container) {
        if (!container || container.dataset.selectAllInjected) return;
        container.dataset.selectAllInjected = "true";

        // ===== HEADER BAR =====
        const header = document.createElement('div');
        header.style.padding = '8px';
        header.style.borderBottom = '1px solid #ddd';
        header.style.background = '#fff';
        header.style.position = 'sticky';
        header.style.top = '0';
        header.style.zIndex = '10000';

        // ===== PROGRESS TEXT =====
        const status = document.createElement('div');
        status.style.fontSize = '12px';
        status.style.marginBottom = '6px';
        status.textContent = 'Ready';

        // ===== PROGRESS BAR =====
        const progressOuter = document.createElement('div');
        progressOuter.style.height = '6px';
        progressOuter.style.background = '#e0e0e0';
        progressOuter.style.borderRadius = '3px';
        progressOuter.style.overflow = 'hidden';

        const progressInner = document.createElement('div');
        progressInner.style.height = '100%';
        progressInner.style.width = '0%';
        progressInner.style.background = '#1976d2';
        progressInner.style.transition = 'width 0.2s ease';

        progressOuter.appendChild(progressInner);

        // ===== BUTTON STYLES =====
        function styleBtn(btn, color) {
            btn.style.width = '100%';
            btn.style.padding = '6px';
            btn.style.cursor = 'pointer';
            btn.style.background = color;
            btn.style.color = '#fff';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.fontSize = '13px';
            btn.style.marginTop = '4px';
        }

        // ===== SELECT ALL BUTTON =====
        const selectBtn = document.createElement('button');
        selectBtn.textContent = 'Select All';
        styleBtn(selectBtn, '#1976d2');

        // ===== CLEAR BUTTON =====
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear All';
        styleBtn(clearBtn, '#777');

        clearBtn.onclick = () => {
            container.querySelectorAll('input[type="checkbox"]:checked')
                .forEach(cb => cb.click());
            status.textContent = 'Cleared';
            progressInner.style.width = '0%';
        };

        // ===== MAIN SELECT LOGIC =====
        selectBtn.onclick = async () => {
            selectBtn.disabled = true;
            selectBtn.textContent = 'Selecting...';

            let lastHeight = 0;
            let totalSelected = 0;
            let iteration = 0;

            while (true) {
                iteration++;

                const beforeCount = container.querySelectorAll('input[type="checkbox"]:checked').length;

                const checkboxes = container.querySelectorAll('input[type="checkbox"]:not(:checked)');
                checkboxes.forEach(cb => cb.click());

                const afterCount = container.querySelectorAll('input[type="checkbox"]:checked').length;
                const selectedThisRound = afterCount - beforeCount;
                totalSelected += selectedThisRound;

                // Progress bar (approximate, based on scroll progress)
                const currentScroll = container.scrollTop;
                const maxScroll = container.scrollHeight - container.clientHeight;
                const percent = maxScroll > 0 ? (currentScroll / maxScroll) * 100 : 100;

                progressInner.style.width = Math.min(percent, 100) + '%';

                status.textContent = `Selecting... ${totalSelected} items`;

                // Scroll to load more
                container.scrollTo(0, container.scrollHeight);

                await new Promise(r => setTimeout(r, 75));

                if (container.scrollHeight === lastHeight) break;
                lastHeight = container.scrollHeight;
            }

            progressInner.style.width = '100%';
            status.textContent = `✅ Done (${totalSelected} items)`;

            selectBtn.disabled = false;
            selectBtn.textContent = 'Select All';

            console.log("✅ All properties selected");
        };

        // ===== BUILD UI =====
        header.appendChild(status);
        header.appendChild(progressOuter);
        header.appendChild(selectBtn);
        header.appendChild(clearBtn);

        container.prepend(header);
    }

    // ===== OBSERVER =====
    const observer = new MutationObserver(() => {
        const container = findDropdownContainer();
        if (container) {
            injectUI(container);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
