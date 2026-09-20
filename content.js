// ═══════════════════════════════════════════════════════════════
// ImgPrompt AI — Content Script
// UI: hover overlay кнопки + floating panel (как PromptCard)
// Вся логика (fetch + API) делается в background.js
// ═══════════════════════════════════════════════════════════════

(() => {
  if (window.__imgpromptV2__) return;
  window.__imgpromptV2__ = true;

  // ─── Shadow DOM ────────────────────────────────────────────────
  let shadow = null;
  let panelWrap = null;
  let menuEl = null;

  let currentHoverImg = null;
  let hoverTimer = null;
  let menuLeaveTimer = null;

  let panelPos = null; // {x, y} remembered across analyses
  let currentImgSrc = null;
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };
  let currentResult = '';
  let currentVideoFrame = null; // последний захваченный кадр видео (dataURL)

  // ─── CSS ───────────────────────────────────────────────────────
  const CSS = `
    :host {
      all: initial;
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important; height: 100vh !important;
      display: block !important;
      overflow: visible !important;
      pointer-events: none !important;
      z-index: 2147483646 !important;
      font-size: 16px !important;
      direction: ltr !important;
      transform: none !important;
    }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }

    /* ── Hover menu ── */
    .hover-menu {
      position: fixed;
      display: flex;
      flex-direction: column;
      gap: 5px;
      pointer-events: auto;
      z-index: 2147483646;
      animation: menuIn 0.16s cubic-bezier(0.22,0.82,0.2,1) both;
    }
    @keyframes menuIn {
      from { opacity:0; transform:scale(0.84) translateY(-5px); }
      to   { opacity:1; transform:scale(1) translateY(0); }
    }

    .hbtn {
      all: unset;
      min-width: 76px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 13px;
      border-radius: 999px;
      border: 1px solid rgba(239,246,255,0.36);
      background:
        linear-gradient(180deg, rgba(18,22,30,0.34), rgba(4,7,12,0.44)),
        rgba(255,255,255,0.04);
      box-shadow: 0 8px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.32);
      backdrop-filter: blur(20px) saturate(1.2);
      -webkit-backdrop-filter: blur(20px) saturate(1.2);
      color: rgba(247,250,255,0.95);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: transform 0.15s, border-color 0.15s, color 0.15s;
      pointer-events: auto;
    }
    .hbtn:hover { transform: translateY(-1px) scale(1.02); border-color: rgba(248,251,255,0.52); }
    .hbtn.prompt:hover { border-color: rgba(149,128,255,0.6); color: rgba(196,181,253,0.98); }
    .hbtn.loading { opacity:0.6; cursor:default; }

    /* ── Panel ── */
    .panel-wrap {
      position: fixed;
      pointer-events: none;
      z-index: 2147483645;
    }
    .panel {
      pointer-events: auto;
      width: 350px;
      display: flex;
      flex-direction: column;
      border-radius: 24px;
      border: 1px solid rgba(239,246,255,0.36);
      background:
        linear-gradient(180deg, rgba(16,20,28,0.44), rgba(4,7,12,0.56)),
        rgba(255,255,255,0.032);
      box-shadow:
        0 28px 64px rgba(0,0,0,0.28),
        0 10px 24px rgba(0,0,0,0.14),
        inset 0 1px 0 rgba(255,255,255,0.42),
        inset 0 -1px 0 rgba(255,255,255,0.06);
      backdrop-filter: blur(24px) saturate(1.2);
      -webkit-backdrop-filter: blur(24px) saturate(1.2);
      color: rgba(247,250,255,0.95);
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      animation: panelIn 0.26s cubic-bezier(0.22,0.82,0.2,1) both;
    }
    .panel.dragging { cursor: grabbing; }
    @keyframes panelIn {
      from { opacity:0; transform:scale(0.88) translateY(-18px); filter:blur(2px); }
      to   { opacity:1; transform:scale(1) translateY(0); filter:blur(0); }
    }

    .panel-inner {
      display: flex;
      flex-direction: column;
      padding: 18px 18px 14px;
      min-height: 0;
    }

    /* header */
    .ph {
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom: 12px; flex-shrink:0;
    }
    .ph-left { display:flex; align-items:center; gap:8px; }
    .ph-logo {
      width:26px; height:26px; border-radius:7px;
      background: linear-gradient(135deg,#7c6af7,#06b6d4);
      display:flex; align-items:center; justify-content:center;
      font-size:13px; flex-shrink:0;
    }
    .ph-title {
      font-size:11px; font-weight:700;
      letter-spacing:0.1em; text-transform:uppercase;
      color:rgba(180,170,255,0.9);
    }
    .ph-ver { font-size:9px; color:rgba(100,116,139,0.8); }
    .ph-right { display:flex; gap:6px; align-items:center; }
    .ph-btn {
      all:unset;
      width:26px; height:26px; border-radius:8px;
      display:flex; align-items:center; justify-content:center;
      border:1px solid rgba(255,255,255,0.1);
      background:rgba(255,255,255,0.05);
      color:rgba(148,163,184,0.7);
      font-size:13px; cursor:pointer;
      transition: all 0.15s;
      pointer-events:auto;
    }
    .ph-btn:hover { background:rgba(255,255,255,0.12); color:rgba(247,250,255,0.9); }
    .ph-btn.close:hover { background:rgba(239,68,68,0.15); color:#fca5a5; border-color:rgba(239,68,68,0.3); }

    /* preview */
    .preview {
      width:100%; height:130px; object-fit:cover;
      border-radius:12px; margin-bottom:12px;
      display:block; flex-shrink:0; background:#1e2230;
    }

    /* section title */
    .section-title {
      font-size:22px; font-weight:800; letter-spacing:-0.02em;
      margin-bottom:10px; flex-shrink:0;
      background: linear-gradient(135deg, #e2e8f0, #94a3b8);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    }

    /* loading */
    .loading-state {
      display:flex; flex-direction:column; align-items:center;
      padding:24px 0 20px; gap:10px; flex-shrink:0;
    }
    .loading-ring {
      width:44px; height:44px; border-radius:50%;
      background: linear-gradient(135deg,#7c6af7,#06b6d4);
      display:flex; align-items:center; justify-content:center;
      font-size:20px;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%,100% { box-shadow:0 0 0 0 rgba(124,106,247,0.5); }
      50%     { box-shadow:0 0 0 16px rgba(124,106,247,0); }
    }
    .loading-msg { font-size:12px; color:rgba(148,163,184,0.85); }
    .ldots::after { content:''; animation: dots 1.5s steps(4) infinite; }
    @keyframes dots { 0%{content:''} 25%{content:'.'} 50%{content:'..'} 75%{content:'...'} }

    /* result */
    .result-area {
      flex:1; min-height:80px; max-height:300px;
      overflow-y:auto; padding-right:4px;
      font-size:12.5px; line-height:1.75;
      color:rgba(148,163,184,0.95);
      white-space:pre-wrap; word-break:break-word;
      cursor:auto; user-select:text; -webkit-user-select:text;
    }
    .result-area::-webkit-scrollbar { width:3px; }
    .result-area::-webkit-scrollbar-thumb { background:rgba(100,116,139,0.4); border-radius:2px; }
    .result-area strong { color:#a78bfa; }
    .result-area em { color:#93c5fd; font-style:normal; }

    /* error */
    .error-box {
      padding:12px 14px; border-radius:10px;
      background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);
      color:#fca5a5; font-size:12px; line-height:1.6;
      flex-shrink:0; margin-bottom:8px;
    }

    /* footer actions */
    .footer {
      display:flex; gap:8px; margin-top:10px; flex-shrink:0;
    }
    .fbtn {
      all:unset;
      height:36px; border-radius:10px;
      display:inline-flex; align-items:center; justify-content:center; gap:5px;
      font-size:12px; font-weight:600; cursor:pointer;
      transition: all 0.16s; pointer-events:auto;
    }
    .fbtn.copy {
      flex:1;
      background:linear-gradient(135deg,#7c6af7,#6d28d9);
      color:white;
      box-shadow:0 4px 14px rgba(124,106,247,0.28);
    }
    .fbtn.copy:hover { transform:translateY(-1px); box-shadow:0 6px 18px rgba(124,106,247,0.4); }
    .fbtn.copy.done { background:linear-gradient(135deg,#10b981,#059669); box-shadow:0 4px 14px rgba(16,185,129,0.28); }
    .fbtn.retry {
      width:36px;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.1);
      color:rgba(148,163,184,0.8);
    }
    .fbtn.retry:hover { border-color:rgba(124,106,247,0.4); color:#c4b5fd; }

    /* lang tabs */
    .lang-tabs {
      display:flex; gap:4px;
      background:rgba(255,255,255,0.05);
      border-radius:10px; padding:3px;
      border:1px solid rgba(255,255,255,0.08);
    }
    .ltab {
      all:unset;
      height:26px; min-width:34px; border-radius:7px;
      display:inline-flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:700; cursor:pointer;
      color:rgba(148,163,184,0.7); transition:all 0.15s;
      padding:0 6px; pointer-events:auto;
    }
    .ltab:hover { color:rgba(247,250,255,0.9); background:rgba(255,255,255,0.06); }
    .ltab.active {
      background:linear-gradient(135deg,#7c6af7,#6d28d9);
      color:white;
      box-shadow:0 2px 8px rgba(124,106,247,0.35);
    }

    /* model label */
    .model-label {
      font-size:9.5px; color:rgba(124,106,247,0.75);
      letter-spacing:0.04em; text-align:center;
      margin-top:6px; flex-shrink:0;
    }

    /* toast */
    .toast {
      position:fixed; bottom:18px; right:18px;
      padding:10px 16px; border-radius:12px;
      border:1px solid rgba(239,246,255,0.16);
      background:rgba(14,16,22,0.96);
      box-shadow:0 14px 30px rgba(0,0,0,0.3);
      color:rgba(247,250,255,0.95); font-size:12px;
      pointer-events:none;
      animation: toastIn 0.2s cubic-bezier(0.22,0.82,0.2,1) both;
    }
    @keyframes toastIn {
      from{opacity:0;transform:translateY(10px) scale(0.96);}
      to{opacity:1;transform:translateY(0) scale(1);}
    }
  `;

  // ─── Init root ─────────────────────────────────────────────────
  function ensureRoot() {
    if (shadow) return;
    const host = document.createElement('div');
    host.id = 'imgprompt-host';
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);
  }

  // ─── Image eligibility ─────────────────────────────────────────
  function isEligible(img) {
    if (!img || img.closest?.('#imgprompt-host')) return false;
    const rect = img.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return false;
    const area = rect.width * rect.height;
    const screenArea = window.innerWidth * window.innerHeight;
    if (area > screenArea * 0.75) return false;
    const src = img.currentSrc || img.src || '';
    if (!src || src.startsWith('data:')) return false;
    return true;
  }

  // ─── Video eligibility ─────────────────────────────────────────
  function isEligibleVideo(el) {
    if (!el || el.tagName !== 'VIDEO') return false;
    if (el.closest?.('#imgprompt-host')) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return false;
    if (el.readyState < 2) return false; // not loaded enough
    return true;
  }

  // Capture current video frame as base64 PNG via canvas
  function captureVideoFrame(video) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || video.clientWidth || 640;
      canvas.height = video.videoHeight || video.clientHeight || 360;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      return dataUrl; // data:image/jpeg;base64,...
    } catch(e) {
      console.warn('[ImgPrompt] captureVideoFrame failed:', e.message);
      return null;
    }
  }

  // ─── Hover menu ────────────────────────────────────────────────
  function removeMenu() {
    shadow?.querySelector('.hover-menu')?.remove();
    menuEl = null;
  }

  function showHoverMenu(el, type = 'img') {
    const eligible = type === 'video' ? isEligibleVideo(el) : isEligible(el);
    if (!eligible) return;
    ensureRoot();
    removeMenu();

    const rect = el.getBoundingClientRect();
    const scale = Math.min(rect.width, rect.height) < 160 ? 0.88 : 1;

    const menu = document.createElement('div');
    menu.className = 'hover-menu';

    const promptBtn = document.createElement('button');
    promptBtn.className = 'hbtn prompt';
    promptBtn.innerHTML = type === 'video' ? '🎬 Кадр' : 'Prompt';
    promptBtn.style.cssText = `transform:scale(${scale});transform-origin:top right;`;

    const openBtn = document.createElement('button');
    openBtn.className = 'hbtn';
    openBtn.textContent = type === 'video' ? '▶ Видео' : 'Open';
    openBtn.style.cssText = `transform:scale(${scale});transform-origin:top right;`;

    menu.append(promptBtn, openBtn);

    // Position top-right of element
    const margin = 8;
    const menuW = 84;
    const menuH = 72;
    let left = Math.round(rect.right - menuW - margin);
    let top = Math.round(rect.top + margin);
    left = Math.max(margin, Math.min(left, window.innerWidth - menuW - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - menuH - margin));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    promptBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (type === 'video') {
        // Capture current video frame and analyse it
        const frameDataUrl = captureVideoFrame(el);
        if (!frameDataUrl) {
          showToast('Не удалось захватить кадр видео (CORS или незагружено)');
          return;
        }
        triggerAnalysisWithDataUrl(frameDataUrl, el.getBoundingClientRect());
      } else {
        triggerAnalysis(el);
      }
    });
    openBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (type === 'video') {
        el.requestFullscreen?.();
      } else {
        window.open(el.currentSrc || el.src, '_blank');
      }
    });

    menu.addEventListener('mouseenter', () => {
      clearTimeout(menuLeaveTimer);
      clearTimeout(hoverTimer);
    });
    menu.addEventListener('mouseleave', () => { menuLeaveTimer = setTimeout(removeMenu, 300); });

    shadow.appendChild(menu);
    menuEl = menu;
  }

  // ─── Mouse listeners ───────────────────────────────────────────
  document.addEventListener('mouseover', e => {
    // Check images
    const img = e.target instanceof HTMLImageElement ? e.target : e.target.closest?.('img');
    if (img && isEligible(img)) {
      clearTimeout(hoverTimer);
      clearTimeout(menuLeaveTimer);
      if (img !== currentHoverImg) { currentHoverImg = img; showHoverMenu(img, 'img'); }
      return;
    }
    // Check videos
    const vid = e.target instanceof HTMLVideoElement ? e.target : e.target.closest?.('video');
    if (vid && isEligibleVideo(vid)) {
      clearTimeout(hoverTimer);
      clearTimeout(menuLeaveTimer);
      if (vid !== currentHoverImg) { currentHoverImg = vid; showHoverMenu(vid, 'video'); }
    }
  }, true);

  document.addEventListener('mouseout', e => {
    const el = e.target;
    const isImgOrVid = (el instanceof HTMLImageElement) || (el instanceof HTMLVideoElement) ||
                       el.closest?.('img') || el.closest?.('video');
    if (!isImgOrVid) return;
    const to = e.relatedTarget;
    if (!to) { hoverTimer = setTimeout(removeMenu, 300); return; }
    const host = document.getElementById('imgprompt-host');
    if (host && (to === host || host.contains(to))) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(removeMenu, 220);
  }, true);

  // ─── Panel ─────────────────────────────────────────────────────
  function getPanelStart() {
    return panelPos || { x: Math.max(20, window.innerWidth - 375), y: 50 };
  }

  function removePanel() {
    shadow?.querySelector('.panel-wrap')?.remove();
    panelWrap = null;
  }

  // Экранирование HTML: защита от XSS через вывод LLM
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Сначала экранируем весь ввод, потом добавляем свои теги — инъекция невозможна
  function renderMd(text) {
    return escHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '\n'); // переносы сохраняются: у .result-area есть white-space:pre-wrap
  }

  // Вырезает готовый промпт: от ✨-заголовка до следующего заголовка любой секции
  function extractPrompt(text) {
    if (!text) return '';
    const startRx = /\*\*\s*\u2728[^\n*]*\*\*:?/;
    const m = startRx.exec(text);
    if (!m) return text.trim();

    const after = text.slice(m.index + m[0].length);
    const endRx = /\n\s*\*\*/; // следующий заголовок секции
    const e = endRx.exec(after);
    return (e ? after.slice(0, e.index) : after).trim();
  }

  function buildPanel(imgSrc, state, data) {
    ensureRoot();
    removePanel();

    const pos = getPanelStart();

    const wrap = document.createElement('div');
    wrap.className = 'panel-wrap';
    wrap.style.left = `${pos.x}px`;
    wrap.style.top = `${pos.y}px`;

    const panel = document.createElement('div');
    panel.className = 'panel';

    const inner = document.createElement('div');
    inner.className = 'panel-inner';

    // Header
    inner.innerHTML = `
      <div class="ph">
        <div class="ph-left">
          <div class="ph-logo">🔮</div>
          <div class="ph-title">ImgPrompt AI</div>
          <div class="ph-ver"></div>
        </div>
        <div class="ph-right">
          <button class="ph-btn" id="ip-reload" title="Анализировать заново">↺</button>
          <button class="ph-btn close" id="ip-close" title="Закрыть">✕</button>
        </div>
      </div>
    `;

    // Версия берётся из манифеста, а не захардкожена
    const verEl = inner.querySelector('.ph-ver');
    if (verEl) verEl.textContent = 'v' + chrome.runtime.getManifest().version;

    // Preview
    if (imgSrc) {
      const preview = document.createElement('img');
      preview.className = 'preview';
      preview.src = imgSrc;
      preview.onerror = () => preview.remove();
      inner.appendChild(preview);
    }

    // Section title
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = 'Prompt';
    inner.appendChild(title);

    // State content
    if (state === 'loading') {
      const loading = document.createElement('div');
      loading.className = 'loading-state';
      loading.innerHTML = `
        <div class="loading-ring">🔮</div>
        <div class="loading-msg">Анализируем<span class="ldots"></span></div>
      `;
      inner.appendChild(loading);
    }

    if (state === 'result') {
      currentResult = data;
      const resultDiv = document.createElement('div');
      resultDiv.className = 'result-area';
      resultDiv.innerHTML = renderMd(data); // безопасно: всё экранировано в renderMd
      inner.appendChild(resultDiv);

      // Footer: Copy + lang tabs + retry
      const footer = document.createElement('div');
      footer.className = 'footer';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'fbtn copy';
      copyBtn.id = 'ip-copy';
      copyBtn.innerHTML = '📋 Copy';

      // Language tabs
      const langTabs = document.createElement('div');
      langTabs.className = 'lang-tabs';

      const langs = [
        { id: 'ru', label: 'RU' },
        { id: 'en', label: 'EN' },
        { id: 'zh', label: '中' }
      ];
      langs.forEach(({ id, label }) => {
        const tab = document.createElement('button');
        tab.className = 'ltab' + (currentLang === id ? ' active' : '');
        tab.textContent = label;
        tab.dataset.lang = id;
        tab.addEventListener('click', e => {
          e.stopPropagation();
          if (currentLang === id) return;
          currentLang = id;
          chrome.storage.local.set({ language: id }); // выбор запоминается глобально
          // Re-run analysis with new language
          langTabs.querySelectorAll('.ltab').forEach(t => t.classList.toggle('active', t.dataset.lang === id));
          rerunLastAnalysis();
        });
        langTabs.appendChild(tab);
      });

      const retryBtn = document.createElement('button');
      retryBtn.className = 'fbtn retry';
      retryBtn.id = 'ip-retry';
      retryBtn.title = 'Заново';
      retryBtn.textContent = '↺';

      footer.append(copyBtn, langTabs, retryBtn);
      inner.appendChild(footer);
    }

    if (state === 'error') {
      const err = document.createElement('div');
      err.className = 'error-box';
      err.textContent = data;
      inner.appendChild(err);

      // Кнопка повтора работает и после ошибок видео-кадров
      const footer = document.createElement('div');
      footer.className = 'footer';

      const againBtn = document.createElement('button');
      againBtn.className = 'fbtn retry';
      againBtn.id = 'ip-error-retry';
      againBtn.style.width = 'auto';
      againBtn.style.padding = '0 14px';
      againBtn.textContent = '↺ Попробовать снова';
      againBtn.addEventListener('click', e => { e.stopPropagation(); rerunLastAnalysis(); });

      footer.appendChild(againBtn);
      inner.appendChild(footer);
    }

    // Model label
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, s => {
      if (!s) return;
      const label = document.createElement('div');
      label.className = 'model-label';
      label.textContent = s.model || 'model';
      inner.appendChild(label);
    });

    panel.appendChild(inner);
    wrap.appendChild(panel);
    shadow.appendChild(wrap);
    panelWrap = wrap;

    // Events (один обработчик на кнопку, без дублей)
    const closeBtn = wrap.querySelector('#ip-close');
    const reloadBtn = wrap.querySelector('#ip-reload');
    const copyBtn = wrap.querySelector('#ip-copy');
    const retryBtn = wrap.querySelector('#ip-retry');

    closeBtn?.addEventListener('click', e => { e.stopPropagation(); removePanel(); });
    reloadBtn?.addEventListener('click', e => { e.stopPropagation(); rerunLastAnalysis(); });
    retryBtn?.addEventListener('click', e => { e.stopPropagation(); rerunLastAnalysis(); });

    copyBtn?.addEventListener('click', e => {
      e.stopPropagation();
      if (!currentResult) return;
      // Copy only the generation prompt (✨ section), not the full analysis
      const toCopy = extractPrompt(currentResult);
      navigator.clipboard.writeText(toCopy).then(() => {
        copyBtn.textContent = '✅ Copied!';
        copyBtn.classList.add('done');
        setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; copyBtn.classList.remove('done'); }, 2000);
      });
    });

    // Drag
    let dragStart = null;
    panel.addEventListener('mousedown', e => {
      const skip = ['ip-copy','ip-retry','ip-reload','ip-close'];
      if (skip.some(id => e.target.closest?.(`#${id}`))) return;
      if (e.target.classList?.contains('result-area')) return;
      dragging = true;
      dragStart = { mx: e.clientX, my: e.clientY };
      const r = wrap.getBoundingClientRect();
      dragOffset = { x: e.clientX - r.left, y: e.clientY - r.top };
      panel.classList.add('dragging');
      e.preventDefault();
    });
  }

  function onDragMove(e) {
    if (!dragging || !panelWrap) return;
    const x = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 360));
    const y = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 100));
    panelPos = { x, y };
    panelWrap.style.left = `${x}px`;
    panelWrap.style.top = `${y}px`;
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;
    panelWrap?.querySelector('.panel')?.classList.remove('dragging');
  }

  // Навешиваются ОДИН раз на уровне модуля — без утечки при каждом buildPanel()
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);

  // ─── Toast ─────────────────────────────────────────────────────
  function toast(msg) {
    ensureRoot();
    shadow.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    shadow.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  // ─── Analysis trigger ──────────────────────────────────────────
  let analysisRunning = false;
  let currentImgRect = null;
  let currentLang = 'en'; // 'ru' | 'en' | 'zh'

  const VALID_LANGS = ['ru', 'en', 'zh'];

  // Стартовый язык панели — из настроек расширения (options → «Язык ответа»)
  chrome.storage.local.get({ language: '' }, ({ language }) => {
    if (VALID_LANGS.includes(language)) currentLang = language;
  });

  // Смена языка в настройках подхватывается живьём (кроме уже идущего анализа)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.language || analysisRunning) return;
    const v = changes.language.newValue;
    if (VALID_LANGS.includes(v)) currentLang = v;
  });

  function sendAnalysisRequest(url, rect) {
    analysisRunning = true;
    removeMenu();
    buildPanel(url, 'loading', null);

    // background.js does: captureVisibleTab → crop to rect → call API
    chrome.runtime.sendMessage({
      type: 'ANALYZE_IMAGE',
      imageUrl: url,
      imageRect: rect,
      lang: currentLang
    }, response => {
      analysisRunning = false;

      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || 'Extension error';
        buildPanel(url, 'error',
          '🔌 Ошибка расширения:\n' + msg +
          '\n\nПерезагрузите страницу (F5) и попробуйте снова.');
        return;
      }

      if (response?.success) {
        buildPanel(url, 'result', response.result);
      } else {
        buildPanel(url, 'error', '❌ ' + (response?.error || 'Неизвестная ошибка. Откройте popup и проверьте настройки API.'));
      }
    });
  }

  function triggerAnalysis(img) {
    if (analysisRunning) return;
    const url = img ? (img.currentSrc || img.src) : currentImgSrc;
    if (!url) return;
    currentImgSrc = url;
    currentVideoFrame = null; // предыдущий кадр видео больше не актуален
    currentHoverImg = img;

    let rect = null;
    if (img && typeof img.getBoundingClientRect === 'function') {
      const r = img.getBoundingClientRect();
      rect = { x: r.left, y: r.top, width: r.width, height: r.height, dpr: window.devicePixelRatio || 1 };
    }
    currentImgRect = rect;
    sendAnalysisRequest(url, rect);
  }

  // For video frames: we already have base64 dataUrl — skip screenshot capture
  function triggerAnalysisWithDataUrl(dataUrl, rect) {
    if (analysisRunning) return;
    currentVideoFrame = dataUrl; // запоминаем кадр для «Попробовать снова» / смены языка
    analysisRunning = true;
    removeMenu();
    buildPanel(null, 'loading', null);

    chrome.runtime.sendMessage({
      type: 'ANALYZE_IMAGE_DATA',
      dataUrl,
      lang: currentLang
    }, response => {
      analysisRunning = false;
      if (chrome.runtime.lastError) {
        buildPanel(null, 'error', '🔌 ' + chrome.runtime.lastError.message);
        return;
      }
      if (response?.success) {
        buildPanel(null, 'result', response.result);
      } else {
        buildPanel(null, 'error', '❌ ' + (response?.error || 'Ошибка анализа кадра'));
      }
    });
  }

  // Alias showToast → toast
  function showToast(msg) { toast(msg); }

  // Повтор последнего анализа: обычной картинки или кадра видео
  function rerunLastAnalysis() {
    if (analysisRunning) return;
    if (currentImgSrc) {
      sendAnalysisRequest(currentImgSrc, currentImgRect);
    } else if (currentVideoFrame) {
      triggerAnalysisWithDataUrl(currentVideoFrame, null);
    }
  }

  // ─── Context menu ──────────────────────────────────────────────
  // Background sends START_ANALYSIS when user right-clicks image
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'START_ANALYSIS') {
      const url = msg.imageUrl;
      if (!url) return;

      // Find matching on page
      const imgs = Array.from(document.querySelectorAll('img'));
      const found = imgs.find(i => i.src === url || i.currentSrc === url);

      // Build a minimal proxy object if not found
      const proxy = found || {
        currentSrc: url, src: url,
        naturalWidth: 800, naturalHeight: 600,
        width: 800, height: 600
      };

      triggerAnalysis(proxy);
      sendResponse({ ok: true });
    }
    return true;
  });

})();