(() => {
  if (document.getElementById('pn-host')) return;

  const pathname = location.pathname.replace(/\/$/, '') || '/';
  const STORAGE_KEY = `pn:${location.hostname}${pathname}`;
  const URL_DISPLAY = location.hostname + (pathname === '/' ? '' : pathname);
  let isOpen = false;
  let isListView = false;
  let debounceTimer = null;

  // 기본은 로컬. 프리미엄이면 sync로 전환.
  let noteStore = chrome.storage.local;

  chrome.storage.local.get('pn_premium', (r) => {
    if (r.pn_premium) noteStore = chrome.storage.sync;
    updateSyncBadge(!!r.pn_premium);
    noteStore.get(STORAGE_KEY, (result) => {
      sendBadge(!!(result[STORAGE_KEY]?.trim()));
    });
  });

  // 옵션 페이지에서 프리미엄 상태가 바뀌면 실시간 반영
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'pn_premium' in changes) {
      const isPremium = !!changes.pn_premium.newValue;
      noteStore = isPremium ? chrome.storage.sync : chrome.storage.local;
      updateSyncBadge(isPremium);
      if (isOpen && !isListView) loadNote();
    }
  });

  // Auto-open after navigating from notes list
  const shouldAutoOpen = !!sessionStorage.getItem('pn-auto-open');
  if (shouldAutoOpen) sessionStorage.removeItem('pn-auto-open');

  // ─── Shadow DOM ────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'pn-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      height: 100vh !important;
      width: 320px;
      z-index: 2147483647 !important;
      display: block !important;
      transform: translateX(100%);
      transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }
    :host(.open) {
      transform: translateX(0) !important;
      pointer-events: auto;
    }

    #sidebar {
      height: 100%;
      position: relative;
      overflow: hidden;
      background: #fafaf8;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 32px rgba(0,0,0,0.07);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
    }

    #handle {
      position: absolute;
      left: 0; top: 0;
      width: 5px; height: 100%;
      cursor: ew-resize;
      z-index: 10;
      transition: background 150ms;
    }
    #handle:hover { background: rgba(99,102,241,0.2); }

    .view {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      background: inherit;
      transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
      will-change: transform;
    }
    #view-note { transform: translateX(0); }
    #view-list { transform: translateX(100%); }
    #sidebar.show-list #view-note { transform: translateX(-30%); }
    #sidebar.show-list #view-list { transform: translateX(0); }

    .view-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 13px 16px 11px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
      gap: 8px;
    }
    .header-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .header-info-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .view-title {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .url-label {
      font-size: 12px;
      color: #6b7280;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #sync-badge {
      font-size: 10px;
      font-weight: 600;
      color: #6366f1;
      background: rgba(99,102,241,0.1);
      padding: 2px 7px;
      border-radius: 10px;
      display: none;
      align-items: center;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #sync-badge.visible { display: inline-flex; }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1px;
      flex-shrink: 0;
    }
    #saved {
      font-size: 11px;
      color: #6366f1;
      opacity: 0;
      transition: opacity 200ms;
      padding-right: 4px;
      white-space: nowrap;
    }
    #saved.on { opacity: 1; }

    button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 7px;
      border-radius: 6px;
      color: #9ca3af;
      font-size: 12px;
      font-family: inherit;
      line-height: 1;
      transition: background 120ms, color 120ms;
      outline: none;
      white-space: nowrap;
    }
    #close-btn, #close-btn-list { font-size: 18px; padding: 2px 6px; }
    #list-btn { font-size: 15px; }
    #settings-btn { font-size: 14px; }
    #back-btn { font-size: 20px; padding: 2px 4px; color: #6b7280; }
    button:hover { background: #f3f4f6; color: #374151; }

    textarea {
      flex: 1;
      width: 100%;
      padding: 16px;
      border: none;
      outline: none;
      resize: none;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13.5px;
      line-height: 1.7;
      color: #1f2937;
      overflow-y: auto;
    }
    textarea::placeholder { color: #d1d5db; }

    #notes-container { flex: 1; overflow-y: auto; }

    .note-item {
      display: flex;
      align-items: center;
      padding: 11px 16px;
      border-bottom: 1px solid #f3f4f6;
      cursor: pointer;
      transition: background 120ms;
      gap: 8px;
    }
    .note-item:hover { background: #f9fafb; }
    .note-item.current-page {
      background: rgba(99,102,241,0.04);
      border-left: 2px solid #6366f1;
      padding-left: 14px;
    }
    .note-item-body { flex: 1; min-width: 0; }
    .note-item-url {
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .current-badge {
      font-size: 9px;
      color: #6366f1;
      background: rgba(99,102,241,0.1);
      padding: 1px 5px;
      border-radius: 10px;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .note-item-preview {
      font-size: 11.5px;
      color: #9ca3af;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .note-item-delete {
      opacity: 0;
      flex-shrink: 0;
      transition: opacity 120ms;
      font-size: 14px;
      padding: 2px 5px;
    }
    .note-item:hover .note-item-delete { opacity: 1; }

    .empty-state {
      padding: 48px 24px;
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
    }

    @media (prefers-color-scheme: dark) {
      #sidebar {
        background: #1c1c1e;
        border-left-color: #2c2c2e;
        box-shadow: -4px 0 32px rgba(0,0,0,0.45);
        color: #e5e7eb;
      }
      .view-header { border-bottom-color: #2c2c2e; }
      .view-title  { color: #f9fafb; }
      .url-label   { color: #9ca3af; }
      button { color: #6b7280; }
      button:hover { background: #2c2c2e; color: #d1d5db; }
      textarea { color: #e5e7eb; }
      textarea::placeholder { color: #4b5563; }
      #handle:hover { background: rgba(129,140,248,0.3); }
      .note-item { border-bottom-color: #2c2c2e; }
      .note-item:hover { background: #242426; }
      .note-item.current-page { background: rgba(99,102,241,0.1); }
      .note-item-url { color: #d1d5db; }
      .note-item-preview { color: #6b7280; }
      .empty-state { color: #4b5563; }
    }
  `;
  shadow.appendChild(style);

  // ─── HTML ──────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'sidebar';
  container.innerHTML = `
    <div id="handle"></div>

    <div class="view" id="view-note">
      <div class="view-header">
        <div class="header-info">
          <div class="header-info-row">
            <span class="view-title">Site Notes</span>
            <span id="sync-badge">↕ Sync</span>
          </div>
          <span class="url-label" id="url-label"></span>
        </div>
        <div class="header-actions">
          <span id="saved">Saved ✓</span>
          <button id="clear-btn">Clear</button>
          <button id="list-btn" title="All notes">≡</button>
          <button id="settings-btn" title="Settings">⚙</button>
          <button id="close-btn">×</button>
        </div>
      </div>
      <textarea id="note" placeholder="Write a note for this page…"></textarea>
    </div>

    <div class="view" id="view-list">
      <div class="view-header">
        <div class="header-info">
          <div class="header-info-row">
            <button id="back-btn">‹</button>
            <span class="view-title" id="list-title">Saved notes</span>
          </div>
        </div>
        <button id="close-btn-list">×</button>
      </div>
      <div id="notes-container"></div>
    </div>
  `;
  shadow.appendChild(container);

  const $s = (sel) => shadow.querySelector(sel);
  $s('#url-label').textContent = URL_DISPLAY;

  const textarea = $s('#note');
  const savedEl  = $s('#saved');
  const sidebar  = $s('#sidebar');

  // ─── Sync badge ────────────────────────────────────────────────────
  function updateSyncBadge(isPremium) {
    const badge = $s('#sync-badge');
    if (badge) badge.classList.toggle('visible', isPremium);
  }

  // ─── Storage ───────────────────────────────────────────────────────
  function loadNote() {
    noteStore.get(STORAGE_KEY, (result) => {
      textarea.value = result[STORAGE_KEY] ?? '';
      sendBadge(!!(result[STORAGE_KEY]?.trim()));
    });
  }

  function saveNote() {
    const val = textarea.value;
    noteStore.set({ [STORAGE_KEY]: val }, () => {
      sendBadge(!!val.trim());
      flashSaved();
    });
  }

  function flashSaved() {
    savedEl.classList.add('on');
    setTimeout(() => savedEl.classList.remove('on'), 1500);
  }

  function sendBadge(has) {
    chrome.runtime.sendMessage({ type: 'badge', has }, () => {
      void chrome.runtime.lastError;
    });
  }

  textarea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveNote, 500);
  });

  // ─── Open / Close ──────────────────────────────────────────────────
  function openSidebar() {
    isOpen = true;
    host.classList.add('open');
    if (!isListView) {
      loadNote();
      setTimeout(() => textarea.focus(), 220);
    }
  }

  function closeSidebar() {
    isOpen = false;
    host.classList.remove('open');
  }

  // ─── View switch ───────────────────────────────────────────────────
  function showListView() {
    isListView = true;
    sidebar.classList.add('show-list');
    loadAllNotes();
  }

  function showNoteView() {
    isListView = false;
    sidebar.classList.remove('show-list');
  }

  // ─── Notes list ────────────────────────────────────────────────────
  function createNoteItem(key, noteText) {
    const urlPath = key.slice(3);
    const preview = noteText.trim().split('\n')[0].slice(0, 100);
    const isCurrent = key === STORAGE_KEY;

    const item = document.createElement('div');
    item.className = 'note-item' + (isCurrent ? ' current-page' : '');

    const body = document.createElement('div');
    body.className = 'note-item-body';

    const urlEl = document.createElement('div');
    urlEl.className = 'note-item-url';
    const urlText = document.createElement('span');
    urlText.textContent = urlPath;
    urlEl.appendChild(urlText);
    if (isCurrent) {
      const badge = document.createElement('span');
      badge.className = 'current-badge';
      badge.textContent = 'current';
      urlEl.appendChild(badge);
    }

    const previewEl = document.createElement('div');
    previewEl.className = 'note-item-preview';
    previewEl.textContent = preview || '(empty)';

    body.appendChild(urlEl);
    body.appendChild(previewEl);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-item-delete';
    deleteBtn.title = 'Delete';
    deleteBtn.textContent = '×';

    item.appendChild(body);
    item.appendChild(deleteBtn);

    item.addEventListener('click', (e) => {
      if (e.target === deleteBtn) return;
      sessionStorage.setItem('pn-auto-open', '1');
      location.href = 'https://' + urlPath;
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!window.confirm(`Delete note for "${urlPath}"?`)) return;
      noteStore.remove(key, () => {
        item.remove();
        const remaining = $s('#notes-container').querySelectorAll('.note-item').length;
        $s('#list-title').textContent = remaining ? `Saved notes (${remaining})` : 'Saved notes';
        if (!remaining) showEmptyState();
        if (isCurrent) sendBadge(false);
      });
    });

    return item;
  }

  function showEmptyState() {
    const c = $s('#notes-container');
    c.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No saved notes yet';
    c.appendChild(empty);
  }

  function loadAllNotes() {
    const c = $s('#notes-container');
    c.innerHTML = '';

    noteStore.get(null, (allData) => {
      const keys = Object.keys(allData).filter(k => k.startsWith('pn:') && allData[k]?.trim());

      if (!keys.length) {
        showEmptyState();
        $s('#list-title').textContent = 'Saved notes';
        return;
      }

      keys.sort((a, b) => {
        if (a === STORAGE_KEY) return -1;
        if (b === STORAGE_KEY) return 1;
        return a.localeCompare(b);
      });

      keys.forEach(key => c.appendChild(createNoteItem(key, allData[key])));
      $s('#list-title').textContent = `Saved notes (${keys.length})`;
    });
  }

  // ─── Event bindings ────────────────────────────────────────────────
  $s('#close-btn').addEventListener('click', closeSidebar);
  $s('#close-btn-list').addEventListener('click', closeSidebar);
  $s('#list-btn').addEventListener('click', showListView);
  $s('#back-btn').addEventListener('click', showNoteView);
  $s('#settings-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open-options' });
  });

  $s('#clear-btn').addEventListener('click', () => {
    if (!window.confirm('Delete note for this page?')) return;
    textarea.value = '';
    noteStore.remove(STORAGE_KEY, () => sendBadge(false));
  });

  // ─── Resize ────────────────────────────────────────────────────────
  $s('#handle').addEventListener('mousedown', (e) => {
    const startX = e.clientX;
    const startW = host.offsetWidth;

    const shield = document.createElement('div');
    shield.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:ew-resize;';
    document.body.appendChild(shield);

    function onMove(ev) {
      const w = Math.max(260, Math.min(480, startW + (startX - ev.clientX)));
      host.style.width = w + 'px';
    }
    function onUp() {
      shield.remove();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  // ─── Keyboard event isolation (prevent page from stealing focus) ───
  ['keydown', 'keypress', 'keyup'].forEach(type => {
    host.addEventListener(type, (e) => e.stopPropagation());
  });

  // ─── Message listener ──────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle') isOpen ? closeSidebar() : openSidebar();
  });

  if (shouldAutoOpen) setTimeout(openSidebar, 100);
})();
