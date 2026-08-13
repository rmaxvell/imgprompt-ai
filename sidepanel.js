// sidepanel.js — ImgPrompt AI Side Panel
'use strict';

let knownCount = -1;

// ── Extract prompt from full text ─────────────────────────────────
function extractPrompt(text) {
  if (!text) return '';
  const m = /\*\*\s*✨[^\n*]*\*\*:?/.exec(text);
  if (!m) return text.slice(0, 400);
  const after = text.slice(m.index + m[0].length);
  const e = /\n\s*\*\*/.exec(after);
  return (e ? after.slice(0, e.index) : after).trim();
}

function renderMd(text) {
  return (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU') + ' ' +
         d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function copyText(text, btn, label) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ Скопировано!';
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 2000);
  });
}

// ── Delete a single history item by timestamp ──────────────────────
function deleteItem(ts, cardEl) {
  chrome.storage.local.get({ history: [] }, (data) => {
    const filtered = (data.history || []).filter(h => h.ts !== ts);
    chrome.storage.local.set({ history: filtered }, () => {
      knownCount = filtered.length;
      // Animate removal
      cardEl.style.transition = 'opacity 0.25s, transform 0.25s';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'translateX(20px)';
      setTimeout(() => {
        cardEl.remove();
        // Update badge
        document.getElementById('countBadge').textContent = filtered.length;
        // Show empty state if no items left
        if (filtered.length === 0) {
          document.getElementById('histList').style.display = 'none';
          document.getElementById('emptyState').style.display = '';
        }
      }, 260);
    });
  });
}

function buildCard(item, isNew) {
  const prompt  = extractPrompt(item.prompt || '');
  const fullTxt = item.prompt || '';

  const card = document.createElement('div');
  card.className = 'card' + (isNew ? ' new-anim' : '');

  // ── Thumbnail + Delete button row ──
  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'card-thumb-wrap';

  if (item.thumb && !item.thumb.startsWith('data:')) {
    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.src = item.thumb;
    img.onerror = () => img.remove();
    thumbWrap.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'card-nothumb';
    ph.textContent = '🖼️';
    thumbWrap.appendChild(ph);
  }

  // Delete button overlaid on thumbnail
  const btnDel = document.createElement('button');
  btnDel.className = 'btn-del';
  btnDel.title = 'Удалить';
  btnDel.textContent = '✕';
  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteItem(item.ts, card);
  });
  thumbWrap.appendChild(btnDel);
  card.appendChild(thumbWrap);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'card-body';

  const promptEl = document.createElement('div');
  promptEl.className = 'card-prompt' + (prompt.length > 200 ? ' collapsed' : '');
  promptEl.textContent = prompt || fullTxt.slice(0, 300);
  body.appendChild(promptEl);

  let fullOpen = false;
  const fullEl = document.createElement('div');
  fullEl.className = 'card-full';
  fullEl.innerHTML = renderMd(fullTxt);

  if (fullTxt.length > 100) {
    const toggle = document.createElement('span');
    toggle.className = 'card-toggle';
    toggle.textContent = '▼ Показать полный анализ';
    toggle.addEventListener('click', () => {
      fullOpen = !fullOpen;
      fullEl.classList.toggle('open', fullOpen);
      promptEl.classList.toggle('collapsed', !fullOpen && prompt.length > 200);
      toggle.textContent = fullOpen ? '▲ Свернуть' : '▼ Показать полный анализ';
    });
    body.appendChild(toggle);
    body.appendChild(fullEl);
  }

  // ── Copy buttons ──
  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const btnPrompt = document.createElement('button');
  btnPrompt.className = 'btn-copy';
  btnPrompt.textContent = '📋 Промпт';
  btnPrompt.addEventListener('click', () => copyText(prompt || fullTxt, btnPrompt, '📋 Промпт'));

  const btnAll = document.createElement('button');
  btnAll.className = 'btn-copy-all';
  btnAll.textContent = '📄 Всё';
  btnAll.addEventListener('click', () => copyText(fullTxt, btnAll, '📄 Всё'));

  footer.append(btnPrompt, btnAll);
  body.appendChild(footer);
  card.appendChild(body);

  // ── Meta ──
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.innerHTML =
    '<span class="card-meta-model">' + (item.model || '') + '</span>' +
    '<span style="flex:1"></span>' +
    '<span>' + fmtDate(item.ts) + '</span>';
  card.appendChild(meta);

  return card;
}

function loadHistory(forceRefresh) {
  chrome.storage.local.get({ history: [], pendingAnalysis: null }, (data) => {
    const history = data.history || [];
    const pending = data.pendingAnalysis;

    const bar = document.getElementById('analysisBar');
    const isLoading = pending && pending.status === 'loading' &&
                      Date.now() - (pending.timestamp || 0) < 120000;
    bar.classList.toggle('visible', !!isLoading);

    document.getElementById('countBadge').textContent = history.length;

    const listEl  = document.getElementById('histList');
    const emptyEl = document.getElementById('emptyState');

    if (!history.length) {
      listEl.style.display  = 'none';
      emptyEl.style.display = '';   // block, not flex
      knownCount = 0;
      return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display  = 'block';  // ← BLOCK not flex

    if (history.length !== knownCount || forceRefresh) {
      const isNew = history.length > knownCount && knownCount >= 0;
      knownCount = history.length;

      const reversed = history.slice().reverse();
      listEl.innerHTML = '';
      reversed.forEach((item, i) => {
        listEl.appendChild(buildCard(item, isNew && i === 0));
      });
    }
  });
}

function clearHistory() {
  if (!confirm('Очистить всю историю?')) return;
  chrome.storage.local.set({ history: [], pendingAnalysis: null }, () => {
    knownCount = 0;
    loadHistory(true);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn').addEventListener('click', () => loadHistory(true));
  document.getElementById('clearBtn').addEventListener('click', clearHistory);

  loadHistory(true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.history || changes.pendingAnalysis)) {
      loadHistory();
    }
  });

  // Polling fallback every 3s
  setInterval(() => loadHistory(), 3000);
});
