// ==UserScript==
// @name         Booking.com - Show Hotel ID on Search Results
// @namespace    booking-tools
// @version      1.0
// @description  Append Booking.com numeric property ID to each result card (robust slug->id mapping, supports infinite scroll)
// @match        https://www.booking.com/searchresults*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const INJECT_FLAG = 'bkHotelIdInjected';
  const ID_SPAN_CLASS = 'bk-hotel-id-span';

  // slug -> numeric id
  let slugToId = new Map();
  let lastMapBuild = 0;

  function buildSlugToIdMap(force = false) {
    const now = Date.now();
    // Rebuild at most every 5s unless forced
    if (!force && slugToId.size && (now - lastMapBuild) < 5000) return;

    const newMap = new Map();

    for (const script of document.querySelectorAll('script')) {
      const t = script.textContent;
      if (!t || t.indexOf('basicPropertyData') === -1) continue;

      // Walk occurrences; take a bounded slice to avoid expensive full parsing
      let idx = 0;
      while ((idx = t.indexOf('"basicPropertyData"', idx)) !== -1) {
        const chunk = t.slice(idx, idx + 8000);

        const idMatch = /"id"\s*:\s*(\d+)/.exec(chunk);
        const pageMatch = /"pageName"\s*:\s*"([^"]+)"/.exec(chunk);

        if (idMatch && pageMatch) {
          newMap.set(pageMatch[1], idMatch[1]);
        }

        idx += 16;
      }
    }

    // Only replace if we found something (prevents wiping map during transient states)
    if (newMap.size) {
      slugToId = newMap;
      lastMapBuild = now;
    }
  }

  function extractSlugFromHotelUrl(urlString) {
    try {
      const url = new URL(urlString, location.origin);
      // /hotel/{cc}/{slug}.html
      const m = url.pathname.match(/\/hotel\/[^/]+\/([^/?#]+)\.html/i);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  function findCardSlug(card) {
    const link =
      card.querySelector('a[data-testid="title-link"]') ||
      card.querySelector('a[href*="/hotel/"]');

    if (!link) return null;

    const href = link.getAttribute('href') || link.href;
    return extractSlugFromHotelUrl(href);
  }

  function injectIdIntoCard(card) {
    if (card.dataset[INJECT_FLAG]) return;

    // Build/refresh mapping as needed
    buildSlugToIdMap(false);

    const title = card.querySelector('[data-testid="title"]');
    if (!title) return;

    // Avoid duplicates even if Booking re-renders inside same card node
    if (title.querySelector(`.${ID_SPAN_CLASS}`)) {
      card.dataset[INJECT_FLAG] = '1';
      return;
    }

    const slug = findCardSlug(card);
    if (!slug) return;

    const id = slugToId.get(slug);
    if (!id) {
      // Sometimes scripts load after cards; mark NOT injected so we can retry later
      return;
    }

    const span = document.createElement('span');
    span.className = ID_SPAN_CLASS;
    span.textContent = ` (ID: ${id})`;
    span.style.fontSize = '0.85em';
    span.style.color = '#6b6b6b';
    span.style.marginLeft = '6px';

    title.appendChild(span);
    card.dataset[INJECT_FLAG] = '1';
  }

  function scanAndInject() {
    document
      .querySelectorAll('[data-testid="property-card"]')
      .forEach(injectIdIntoCard);
  }

  // Debounce mutation bursts (infinite scroll, filter changes)
  let queued = false;
  function scheduleScan() {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      // Force rebuild occasionally in case new script blobs arrive
      buildSlugToIdMap(false);
      scanAndInject();
    }, 250);
  }

  // Initial pass
  scheduleScan();

  // Observe DOM changes for lazy loaded results
  const mo = new MutationObserver(scheduleScan);
  mo.observe(document.body, { childList: true, subtree: true });

  // Fallback periodic retry (helps when scripts arrive after initial cards)
  setInterval(() => {
    buildSlugToIdMap(false);
    scanAndInject();
  }, 1500);
})();
``
