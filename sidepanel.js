// sidepanel.js — ImgPrompt AI Side Panel
'use strict';

let knownCount = -1;

// ── Extract prompt from full text ─────────────────────────────────
function extractPrompt(text) {
  if (!text) return '';
  // Ищем секцию SD-промпта по заголовку: **✨ Промпт**, **Prompt**, **PROMPT** и т.п.
  const m = text.match(
    /\*\*[\u2728\uD83C\uDFA8]?\s*(?:Промпт|Prompt|PROMPT)\*\*\s*\n([\s\S]*?)(?=\n\s*\*\*[\u274C\uD83D\uDD34\uD83C\uDFAC]|\n\s*\*\*(?:Negative|Негативн|FLUX|Midjourney|\bSD\b)|\n---|\n#{1,3}\s|$)/i
  );
  if (m && m[1] && m[1].trim().length > 5) return m[1].trim();
  return text.slice(0, 400);
}

function renderMd(text) {
  return (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#{3}\s(.+)$/gm, '<h4 style="margin:.4em 0 .2em;font-size:.82em;opacity:.85;font-weight:600">$1</h4>')
    .replace(/^#{2}\s(.+)$/gm, '<h3 style="margin:.5em 0 .25em;font-size:.92em;font-weight:700">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n---+\n?/g, '<hr style="border:none;border-top:1px solid rgba(255,255,255,.12);margin:.4em 0">')
    .replace(/\n/g, '<br>');
}

function fmtDate(ts) {
 if (!ts) return '';
 const d = new Date(ts);
 return d.toLocaleDateString('ru-RU') + ' ' +
 d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function copyText(text, btn, label) {
  // Очищаем markdown перед копированием в буфер
  const clean = (text || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/#{1,3}\s/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  navigator.clipboard.writeText(clean).then(() => {
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
 cardEl.style.transition = 'opacity 0.25s, transform 0.25s';
 cardEl.style.opacity = '0';
 cardEl.style.transform = 'translateX(20px)';
 setTimeout(() => {
 cardEl.remove();
 document.getElementById('countBadge').textContent = filtered.length;
 if (filtered.length === 0) {
 document.getElementById('histList').style.display = 'none';
 document.getElementById('emptyState').style.display = '';
 }
 }, 260);
 });
 });
}

function buildCard(item, isNew) {
 const prompt = extractPrompt(item.prompt || '');
 const fullTxt = item.prompt || '';

 const card = document.createElement('div');
 card.className = 'card' + (isNew ? ' new-anim' : '');

 // ── Thumbnail + Delete button row ──
 const thumbWrap = document.createElement('div');
 thumbWrap.className = 'card-thumb-wrap';

 if (item.thumb) {
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
 fullEl.innerHTML = renderMd(fullTxt); // безопасно: экранирование внутри renderMd

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
 // Собирается через textContent: модель приходит из настроек и не должна
 // интерпретироваться как HTML. Видео-анализы помечаются 🎬.
 const meta = document.createElement('div');
 meta.className = 'card-meta';
 const parts = [];
 if (item.model) parts.push((item.source === 'video' ? '🎬 ' : '') + item.model);
 parts.push(fmtDate(item.ts));
 meta.textContent = parts.filter(Boolean).join(' · ');
 card.appendChild(meta);

 return card;
}

function loadHistory(forceRefresh) {
 chrome.storage.local.get({ history: [], pendingAnalysis: null }, (data) => {
 const history = data.history || [];
 const pending = data.pendingAnalysis;

 const bar = document.getElementById('analysisBar');
 const isLoading = pending && pending.status === 'loading' &&
 Date.now() - (pending.timestamp || 0) < 15 * 60 * 1000;
 bar.classList.toggle('visible', !!isLoading);

 document.getElementById('countBadge').textContent = history.length;

 const listEl = document.getElementById('histList');
 const emptyEl = document.getElementById('emptyState');

 if (!history.length) {
 listEl.style.display = 'none';
 emptyEl.style.display = '';
 knownCount = 0;
 return;
 }

 emptyEl.style.display = 'none';
 listEl.style.display = 'block';

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
 document.getElementById('cancelAnalysisBtn')?.addEventListener('click', () => {
 chrome.runtime.sendMessage({ type: 'CANCEL_ANALYSIS' });
 chrome.storage.local.set({ pendingAnalysis: { status: 'error', error: 'Анализ отменён пользователем.', timestamp: Date.now() } });
 });

 loadHistory(true);

 // Основной механизм обновления — событие изменения хранилища
 chrome.storage.onChanged.addListener((changes, area) => {
 if (area === 'local' && (changes.history || changes.pendingAnalysis)) {
 loadHistory();
 }
 });

 // Редкий fallback-опрос: раньше тикал каждые 3 секунды даже в простое
 setInterval(() => loadHistory(), 15000);
});