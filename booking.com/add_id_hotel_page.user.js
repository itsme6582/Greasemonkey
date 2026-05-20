// ==UserScript==
// @name         Booking.com – Append Hotel ID (ID: xxxxxx)
// @namespace    booking-tools
// @version      1.0
// @description  Append Booking.com numeric hotel ID right after the hotel name as (ID: xxxxxx)
// @match        https://www.booking.com/hotel/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const BADGE_CLASS = 'bk-hotel-id-inline';

  function getHotelId() {
    // 1) Best: Booking's embedded env var (often present)
    const env = window.booking && window.booking.env;
    const envId = env && (env.b_hotel_id || env.hotel_id);
    if (typeof envId === 'string' && /^\d+$/.test(envId)) return envId;

    // 2) Hidden input (sometimes present)
    const inputId = document.querySelector('input[name="hotel_id"]')?.value;
    if (inputId && /^\d+$/.test(inputId)) return inputId;

    // 3) Android deep link (present in your captured HTML)
    const alt = document.querySelector('link[rel="alternate"][href^="android-app://com.booking/booking/hotel/"]');
    if (alt && alt.getAttribute('href')) {
      const m = alt.getAttribute('href').match(/hotel\/(\d+)/);
      if (m) return m[1];
    }

    // 4) Fallback: regex scan for b_hotel_id in inline scripts
    const html = document.documentElement.innerHTML;
    const rm = html.match(/b_hotel_id:\s*'(\d+)'/);
    if (rm) return rm[1];

    return null;
  }

  function findTitleEl() {
    // Booking’s header title tends to be one of these
    return (
      document.querySelector('h2.pp-header__title') ||
      document.querySelector('h1.pp-header__title') ||
      document.querySelector('h2[data-testid="title"]') ||
      document.querySelector('h1[data-testid="title"]')
    );
  }

  function inject() {
    const titleEl = findTitleEl();
    if (!titleEl) return false;

    // Prevent duplicates
    if (titleEl.querySelector(`.${BADGE_CLASS}`)) return true;

    const hotelId = getHotelId();
    if (!hotelId) return false;

    // Append as: (ID: xxxxxx)
    const span = document.createElement('span');
    span.className = BADGE_CLASS;
    span.textContent = ` (ID: ${hotelId})`;
    span.style.fontWeight = '600';

    titleEl.appendChild(span);
    return true;
  }

  // Try immediately
  inject();

  // Observe for dynamic page loads / React updates
  const obs = new MutationObserver(() => {
    if (inject()) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Safety retry (some pages render late)
  const t = setInterval(() => {
    if (inject()) clearInterval(t);
  }, 1000);
})();
