// ==UserScript==
// @name         BBH DigiManager - Property Dropdown Tools (Scoped, Fast, Clean Status)
// @namespace    https://github.com/itsme6582/Greasemonkey
// @version      2.0
// @description  ONLY enhances the dropdown labeled "Property": Select All, Clear All, Filter, and clean status (Ready/Selecting/Clearing). Shows 1 name or N selected in the input. Fast + scoped.
// @match        https://*.bbhnow.com/*
// @match        https://dev.bbhnow.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  // ----------------------------
  // TUNABLE UI CONSTANTS
  // ----------------------------
  const DROPDOWN_MIN_WIDTH = 600;

  // Property input sizing (fixed — not dynamic)
  const CONTROL_MIN_WIDTH = 560;
  const CONTROL_MAX_WIDTH = 760;

  // Overlay behavior
  const OVERLAY_SINGLE_LINE = true;

  // Performance
  const YIELD_EVERY = 25;

  // ----------------------------
  // STYLES
  // ----------------------------
  GM_addStyle(`
    /* Dropdown panel width (only when tagged gm-prop-panel) */
    .gm-prop-panel {
      min-width: ${DROPDOWN_MIN_WIDTH}px !important;
      width: ${DROPDOWN_MIN_WIDTH}px !important;
      max-width: ${DROPDOWN_MIN_WIDTH}px !important;
    }

    /* Header controls inside dropdown */
    .gm-prop-controls {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #fff;
      padding: 6px;
      border-bottom: 1px solid rgba(0,0,0,.08);
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .gm-prop-btn {
      border: 0;
      padding: 5px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .gm-prop-btn-primary { background: #1976d2; color: #fff; }
    .gm-prop-btn-secondary { background: #616161; color: #fff; }
    .gm-prop-btn:disabled { opacity: .65; cursor: not-allowed; }

    .gm-prop-filter {
      flex: 1 1 auto;
      min-width: 160px;
      border: 1px solid rgba(0,0,0,.18);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      outline: none;
    }
    .gm-prop-filter:focus {
      border-color: rgba(25,118,210,.55);
      box-shadow: 0 0 0 2px rgba(25,118,210,.12);
    }

    /* Status pill: ONLY Ready / Selecting / Clearing */
    .gm-prop-status {
      margin-left: auto;
      font-size: 11px;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(107,114,128,.10);
      border: 1px solid rgba(107,114,128,.20);
      color: #111827;
      white-space: nowrap;
    }
    .gm-prop-status[data-state="busy"] {
      background: rgba(245,158,11,.12);
      border-color: rgba(245,158,11,.25);
    }

    /* Make dropdown items readable (only inside gm-prop-panel) */
    .gm-prop-panel label,
    .gm-prop-panel [role="option"],
    .gm-prop-panel .MuiMenuItem-root,
    .gm-prop-panel .MuiTypography-root {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
      align-items: center !important;
    }

    /* ----------------------------
       Property input field enhancements (ONLY on Property root)
       ---------------------------- */
    .gm-prop-control {
      min-width: ${CONTROL_MIN_WIDTH}px !important;
      max-width: ${CONTROL_MAX_WIDTH}px !important;
      position: relative !important;
    }

    /* We DO NOT force height here. We set CSS vars from the date fields in JS. */
    .gm-prop-control .MuiOutlinedInput-root,
    .gm-prop-control .MuiInputBase-root {
      height: var(--gm-match-height, auto) !important;
    }

    .gm-prop-control [role="button"],
    .gm-prop-control .MuiSelect-select {
      /* Match the date field padding via CSS vars (set in JS). */
      padding-top: var(--gm-pad-top, initial) !important;
      padding-bottom: var(--gm-pad-bottom, initial) !important;

      /* Keep normal horizontal spacing */
      padding-left: 14px !important;
      padding-right: 32px !important;

      display: flex !important;
      align-items: center !important;
    }

    /* Hide original selected text so it doesn't overlap our overlay */
    .gm-prop-control [role="button"],
    .gm-prop-control .MuiSelect-select,
    .gm-prop-control .MuiInputBase-input,
    .gm-prop-control input {
      color: transparent !important;
      text-shadow: none !important;
      caret-color: transparent !important;
      -webkit-text-fill-color: transparent !important;
    }

    /* Overlay text inside the Property box */
    .gm-prop-display-override {
      position: absolute;
      left: 14px;
      right: 34px; /* room for dropdown arrow */
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;

      font-size: 14px;
      line-height: 1.2;
      color: #111827;

      ${OVERLAY_SINGLE_LINE ? `
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      ` : `
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      white-space: normal;
      `}
    }
  `);

  // ----------------------------
  // UTILITIES
  // ----------------------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const isVisible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  function setBusyCursor(isBusy) {
    document.documentElement.style.cursor = isBusy ? 'progress' : '';
    document.body.style.cursor = isBusy ? 'progress' : '';
  }

  // ----------------------------
  // SCOPING: identify Dropdown #1 ("Property") ONLY
  // ----------------------------
  function findControlRootByLabel(labelText) {
    const labels = Array.from(document.querySelectorAll('label'));
    const lbl = labels.find(l => (l.textContent || '').trim() === labelText);
    if (!lbl) return null;

    return (
      lbl.closest('.MuiFormControl-root') ||
      lbl.closest('div')?.parentElement ||
      null
    );
  }

  function findPropertyControlRoot() {
    return findControlRootByLabel('Property');
  }

  function getPropertySelectButton(root) {
    if (!root) return null;
    return (
      root.querySelector('.MuiSelect-select') ||
      root.querySelector('[role="button"]') ||
      null
    );
  }

  function getPropertyListboxId() {
    const root = findPropertyControlRoot();
    const btn = getPropertySelectButton(root);
    if (!btn) return null;

    return btn.getAttribute('aria-controls') || btn.getAttribute('aria-owns') || null;
  }

  function findOpenPropertyListbox() {
    const targetId = getPropertyListboxId();
    if (!targetId) return null;

    const listboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
    return listboxes.find(lb => lb.id === targetId && isVisible(lb)) || null;
  }

  // ----------------------------
  // MATCH HEIGHT TO START/END DATE (the “deeper” fix)
  // We copy the computed height + padding from the Start Date control
  // and apply it to the Property control via CSS variables.
  // ----------------------------
  function applyDateFieldMetricsToProperty() {
    const propertyRoot = findPropertyControlRoot();
    if (!propertyRoot) return;

    // Prefer Start Date, fall back to End Date if needed
    const startRoot = findControlRootByLabel('Start Date') || findControlRootByLabel('End Date');
    if (!startRoot) return;

    // Grab the outlined input root for the date field
    const dateInputRoot =
      startRoot.querySelector('.MuiOutlinedInput-root') ||
      startRoot.querySelector('.MuiInputBase-root');

    const dateInputEl =
      startRoot.querySelector('input') ||
      startRoot.querySelector('.MuiOutlinedInput-input') ||
      startRoot.querySelector('.MuiInputBase-input');

    if (!dateInputRoot || !dateInputEl) return;

    const rootStyle = getComputedStyle(dateInputRoot);
    const inputStyle = getComputedStyle(dateInputEl);

    // Height of the full outlined input (matches what you visually see)
    const h = rootStyle.height;

    // Vertical padding applied to the inner input (this is what gives that “23 feel”)
    const padTop = inputStyle.paddingTop;
    const padBottom = inputStyle.paddingBottom;

    propertyRoot.style.setProperty('--gm-match-height', h);
    propertyRoot.style.setProperty('--gm-pad-top', padTop);
    propertyRoot.style.setProperty('--gm-pad-bottom', padBottom);
  }

  // ----------------------------
  // PROPERTY BOX OVERLAY: "None" / 1 name / N selected
  // ----------------------------
  function ensurePropertyOverlay() {
    const root = findPropertyControlRoot();
    if (!root) return null;

    root.classList.add('gm-prop-control');

    let overlay = root.querySelector('.gm-prop-display-override');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'gm-prop-display-override';
      root.appendChild(overlay);
    }
    return overlay;
  }

  function getSelectedTextFromControl() {
    const root = findPropertyControlRoot();
    const btn = getPropertySelectButton(root);
    return (btn?.textContent || '').trim();
  }

  function parseSelectedNames(txt) {
    if (!txt) return [];
    return txt.split(',').map(s => s.trim()).filter(Boolean);
  }

  function refreshPropertyOverlay() {
    const overlay = ensurePropertyOverlay();
    if (!overlay) return;

    // Ensure sizing matches date fields whenever we refresh
    applyDateFieldMetricsToProperty();

    const txt = getSelectedTextFromControl();
    const names = parseSelectedNames(txt);

    if (names.length === 0) {
      overlay.textContent = 'None selected';
      overlay.title = 'None selected';
    } else if (names.length === 1) {
      overlay.textContent = names[0];
      overlay.title = names[0];
    } else {
      overlay.textContent = `${names.length} selected`;
      overlay.title = names.join('\n');
    }
  }

  // ----------------------------
  // DROPDOWN UI INJECTION
  // ----------------------------
  let statusEl = null;
  let filterEl = null;

  const op = { mode: 'idle' }; // idle | selecting | clearing

  function updateStatus() {
    if (!statusEl) return;

    if (op.mode === 'selecting') {
      statusEl.textContent = 'Selecting';
      statusEl.dataset.state = 'busy';
      return;
    }
    if (op.mode === 'clearing') {
      statusEl.textContent = 'Clearing';
      statusEl.dataset.state = 'busy';
      return;
    }

    statusEl.textContent = 'Ready';
    statusEl.dataset.state = 'idle';
  }

  function getPanelContainerFromListbox(listbox) {
    return (
      listbox.closest('.MuiPaper-root') ||
      listbox.parentElement ||
      listbox
    );
  }

  function markPropertyPanel(container) {
    if (container && !container.classList.contains('gm-prop-panel')) {
      container.classList.add('gm-prop-panel');
    }
  }

  function getRows(container) {
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')).filter(isVisible);
    return checkboxes.map(cb => {
      const row = cb.closest('label') || cb.closest('[role="option"]') || cb.parentElement;
      const text = (row?.textContent || '').trim();
      return { cb, row, text };
    }).filter(r => r.row && r.text);
  }

  function applyFilter(container, query) {
    const q = (query || '').trim().toLowerCase();
    const rows = getRows(container);

    for (const r of rows) {
      const match = !q || (r.text || '').toLowerCase().includes(q);
      r.row.style.display = match ? '' : 'none';
    }
  }

  async function setAll(container, desiredChecked) {
    const queryActive = !!(filterEl && filterEl.value && filterEl.value.trim().length);
    const rows = getRows(container).filter(r => !queryActive || r.row.style.display !== 'none');

    op.mode = desiredChecked ? 'selecting' : 'clearing';
    updateStatus();
    setBusyCursor(true);

    // Prevent scroll jump
    const originalPageY = window.scrollY;
    const originalScrollTop = container.scrollTop;
    const originalOverflow = container.style.overflowY;
    container.style.overflowY = 'hidden';

    for (let i = 0; i < rows.length; i++) {
      const cb = rows[i].cb;
      if (cb.checked !== desiredChecked) cb.click();

      container.scrollTop = originalScrollTop;
      window.scrollTo({ top: originalPageY, left: 0, behavior: 'auto' });

      if ((i + 1) % YIELD_EVERY === 0) {
        await sleep(0);
      }
    }

    container.style.overflowY = originalOverflow || '';
    container.scrollTop = originalScrollTop;
    window.scrollTo({ top: originalPageY, left: 0, behavior: 'auto' });

    op.mode = 'idle';
    updateStatus();
    setBusyCursor(false);

    await sleep(0);
    refreshPropertyOverlay();
  }

  function injectControlsIfMissing(container) {
    if (!container) return;

    if (container.querySelector(':scope > .gm-prop-controls')) return;

    markPropertyPanel(container);

    const bar = document.createElement('div');
    bar.className = 'gm-prop-controls';

    const btnSelect = document.createElement('button');
    btnSelect.className = 'gm-prop-btn gm-prop-btn-primary';
    btnSelect.textContent = 'Select All';

    const btnClear = document.createElement('button');
    btnClear.className = 'gm-prop-btn gm-prop-btn-secondary';
    btnClear.textContent = 'Clear All';

    filterEl = document.createElement('input');
    filterEl.className = 'gm-prop-filter';
    filterEl.type = 'text';
    filterEl.placeholder = 'Filter properties…';

    statusEl = document.createElement('div');
    statusEl.className = 'gm-prop-status';
    statusEl.dataset.state = 'idle';
    statusEl.textContent = 'Ready';

    bar.append(btnSelect, btnClear, filterEl, statusEl);
    container.insertBefore(bar, container.firstChild);

    btnSelect.addEventListener('click', () => setAll(container, true));
    btnClear.addEventListener('click', () => setAll(container, false));
    filterEl.addEventListener('input', () => applyFilter(container, filterEl.value));

    container.addEventListener('change', () => {
      setTimeout(refreshPropertyOverlay, 0);
    }, true);

    updateStatus();
  }

  // ----------------------------
  // HOOK: open-only, scoped to Property dropdown
  // ----------------------------
  function tryHookPropertyDropdown() {
    const listbox = findOpenPropertyListbox();
    if (!listbox) return;

    const container = getPanelContainerFromListbox(listbox);
    injectControlsIfMissing(container);
    refreshPropertyOverlay();
  }

  document.addEventListener('click', () => setTimeout(tryHookPropertyDropdown, 0), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
      setTimeout(tryHookPropertyDropdown, 0);
    }
  }, true);

  // One-time initial sync after page paint
  setTimeout(() => {
    applyDateFieldMetricsToProperty();
    refreshPropertyOverlay();
  }, 300);

})();
