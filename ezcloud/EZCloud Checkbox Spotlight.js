// ==UserScript==
// @name         EZCloud Checkbox Spotlight
// @namespace    https://global.ezcloud.uniview.com/
// @version      1.0
// @match        https://global.ezcloud.uniview.com/userWeb/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function spotlight(cb) {

        const r = cb.getBoundingClientRect();

        const pulse = document.createElement('div');

        pulse.style.cssText = `
            position: fixed;
            left: ${r.left - 10}px;
            top: ${r.top - 10}px;
            width: ${r.width + 20}px;
            height: ${r.height + 20}px;
            border: 4px solid lime;
            border-radius: 50%;
            pointer-events: none;
            z-index: 999999;
            animation: tmPulse 1.5s ease-out forwards;
        `;

        document.body.appendChild(pulse);

        setTimeout(() => pulse.remove(), 1500);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes tmPulse {
            0% {
                transform: scale(0.7);
                opacity: 1;
            }
            100% {
                transform: scale(3);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {

        const cb = document.querySelector('input[type="checkbox"]');

        if (cb) {
            if (!cb.checked) cb.click();
            spotlight(cb);
        }

    }, 2000);

})();
