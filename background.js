// ═══════════════════════════════════════════════════════════════
// ImgPrompt AI — Background Service Worker v2.0
//
// Стратегия получения картинки (от надёжной к запасной):
// 1. chrome.tabs.captureVisibleTab → кроп по rect — ВСЕГДА работает
// 2. fetch() из service worker — для загрузки, если картинка не на экране
// ═══════════════════════════════════════════════════════════════

// Firefox MV2: prompts-fx.js loaded before this script, exports via globalThis.__IP_PROMPTS__
// Safe init: if prompts-fx.js failed for any reason, use fallback stubs
let getSystemPrompt, getUserMessage;
try {
  if (!globalThis.__IP_PROMPTS__) throw new Error('__IP_PROMPTS__ not set by prompts-fx.js');
  ({ getSystemPrompt, getUserMessage } = globalThis.__IP_PROMPTS__);
  console.log('[ImgPrompt BG] prompts loaded OK');
} catch (e) {
  console.error('[ImgPrompt BG] CRITICAL: prompt init failed:', e);
  getSystemPrompt = () => 'Describe this image in detail. Generate a prompt for Stable Diffusion / FLUX / Midjourney.';
  getUserMessage  = () => 'Analyze this image and generate a detailed prompt.';
}

// ⚠️ Единая точка дефолтов. Перед релизом сверьте ID модели,
// например: curl https://openrouter.ai/api/v1/models
const DEFAULT_MODEL = 'qwen/qwen2.5-vl-72b-instruct';

const DEFAULTS = {
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: '', // user enters their own key in popup
  model: DEFAULT_MODEL,
  language: 'ru', // фолбэк-язык анализа, единый с options
  imageMaxSize: 1024,
  imageQuality: 0.85,
  requestTimeout: 0 // 0 = provider-aware default: 120s local, 60s cloud
};

// Одноразовая миграция настроек из storage.sync → storage.local.
// Нужна пользователям, которые уже сохранили ключ со старой версией.
(async () => {
  try {
    const localData = await chrome.storage.local.get(DEFAULTS);
    const syncData = await chrome.storage.sync.get(null);
    const migrate = {};
    for (const k of Object.keys(DEFAULTS)) {
      if (!localData[k] && syncData[k] !== undefined && syncData[k] !== '') migrate[k] = syncData[k];
    }
    // Ключи профилей из popup: key_openrouter, key_groq и т.д.
    Object.keys(syncData).forEach(k => {
      if (k.startsWith('key_') && syncData[k] && !localData[k]) migrate[k] = syncData[k];
    });
    if (Object.keys(migrate).length) await chrome.storage.local.set(migrate);
  } catch (e) {
    console.warn('[ImgPrompt] sync→local migration failed:', e);
  }
})();

const MODELS_CACHE_TTL = 5 * 60 * 1000;
const LOCAL_TIMEOUT_MS = 300 * 1000; // LLaVA на CPU с картинкой 1024px может идти > 2 мин
const CLOUD_TIMEOUT_MS = 60 * 1000;
let activeRequestController = null;

// Сериализация записи истории: исключает потерю записей
// при параллельных анализах (read-modify-write без блокировки)
let historyQueue = Promise.resolve();
function appendHistory(entry) {
  historyQueue = historyQueue.then(() => new Promise(resolve => {
    chrome.storage.local.get({ history: [] }, ({ history }) => {
      history.push(entry);
      if (history.length > 50) history.splice(0, history.length - 50);
      chrome.storage.local.set({ history }, resolve);
    });
  }));
  return historyQueue;
}

function isLocalProvider(apiUrl = '') {
  try {
    const host = new URL(apiUrl).hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' ||
        host === '0.0.0.0' || host === 'host.docker.internal' || host.endsWith('.local')) return true;
    // Приватные подсети: Ollama на соседнем компьютере или NAS
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      const a = +m[1], b = +m[2];
      if (a === 127 || a === 10 || (a === 192 && b === 168) ||
          (a === 172 && b >= 16 && b <= 31)) return true;
    }
    return false;
  } catch (_) {
    return /localhost|127\.0\.0\.1|\[::1\]|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|(\.local$|^10\.)/i.test(apiUrl);
  }
}

function getRequestTimeoutMs(settings) {
  const configured = Number(settings.requestTimeout);
  if (Number.isFinite(configured) && configured > 0) return configured * 1000;
  return isLocalProvider(settings.apiUrl) ? LOCAL_TIMEOUT_MS : CLOUD_TIMEOUT_MS;
}

function getRequestTimeoutSeconds(settings) {
  return Math.round(getRequestTimeoutMs(settings) / 1000);
}

function getModelsCacheKey(apiUrl) {
  const base = apiUrl.replace(/\/chat\/completions$/i, '').replace(/\/$/, '');
  return `modelsCache:${base}`;
}

async function fetchModels(settings, forceRefresh = false) {
  const base = settings.apiUrl.replace(/\/chat\/completions$/i, '').replace(/\/$/, '');
  const cacheKey = getModelsCacheKey(settings.apiUrl);
  const cached = await new Promise(resolve => chrome.storage.local.get({ [cacheKey]: null }, resolve));
  if (!forceRefresh && cached[cacheKey] && Date.now() - cached[cacheKey].timestamp < MODELS_CACHE_TTL) {
    return { data: cached[cacheKey].data || [], cached: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getRequestTimeoutMs(settings));
  try {
    const response = await fetch(`${base}/models`, {
      headers: { 'Authorization': `Bearer ${settings.apiKey || ''}` },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = Array.isArray(data.data) ? data.data : [];
    await new Promise(resolve => chrome.storage.local.set({ [cacheKey]: { timestamp: Date.now(), data: models } }, resolve));
    return { data: models, cached: false };
  } finally {
    clearTimeout(timer);
  }
}

function formatApiError(error, settings, status) {
  const message = String(error?.message || error || 'Неизвестная ошибка');
  const local = isLocalProvider(settings?.apiUrl);
  if (error?.name === 'AbortError' || /aborted|timeout|timed out/i.test(message)) {
    return `Модель не ответила за ${getRequestTimeoutSeconds(settings)} секунд. Попробуйте уменьшить размер изображения или использовать меньшую модель.`;
  }
  if (local && (error instanceof TypeError || /failed to fetch|networkerror|fetch failed|cors/i.test(message))) {
    return /cors/i.test(message)
      ? 'Ошибка CORS. Для Ollama настройте OLLAMA_ORIGINS.'
      : 'Локальный сервер не запущен. Запустите Ollama/LM Studio/Jan.';
  }
  if (status === 404 || /model[^\n]*(not found|does not exist)|model_not_found/i.test(message)) {
    return 'Модель не найдена. Проверьте model ID через /v1/models.';
  }
  return message;
}

function createRequestController(settings) {
  if (activeRequestController) activeRequestController.abort();
  activeRequestController = new AbortController();
  const controller = activeRequestController;
  const timer = setTimeout(() => controller.abort(), getRequestTimeoutMs(settings));
  return { controller, cleanup: () => { clearTimeout(timer); if (activeRequestController === controller) activeRequestController = null; } };
}

// ── Settings ─────────────────────────────────────────────────────
async function getSettings() {
  return new Promise(resolve => chrome.storage.local.get(DEFAULTS, resolve));
}

async function getConfiguredSystemPrompt(lang) {
  const { systemPrompt } = await new Promise(resolve =>
    chrome.storage.local.get({ systemPrompt: '' }, resolve)
  );

  return typeof systemPrompt === 'string' && systemPrompt.trim()
    ? systemPrompt
    : getSystemPrompt(lang);
}

async function compressImageData(imageData, settings) {
  const maxSize = Math.max(64, Number(settings.imageMaxSize) || DEFAULTS.imageMaxSize);
  const quality = Math.min(1, Math.max(0.1, Number(settings.imageQuality) || DEFAULTS.imageQuality));
  const binary = atob(imageData.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: imageData.mimeType || 'image/jpeg' }));
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  const out = new Uint8Array(await blob.arrayBuffer());
  let outBinary = '';
  for (let i = 0; i < out.length; i += 32768) outBinary += String.fromCharCode(...out.subarray(i, i + 32768));
  return { base64: btoa(outBinary), mimeType: 'image/jpeg', width, height };
}

// Миниатюра для истории: маленький JPEG-dataURL из уже полученной картинки.
// Делает запись самодостаточной — превью не умирает офлайн и при hotlink-защите.
async function makeThumbnail(imageData, maxSize = 112, quality = 0.7) {
  try {
    const binary = atob(imageData.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const bitmap = await createImageBitmap(new Blob([bytes], { type: imageData.mimeType || 'image/jpeg' }));
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
    return `data:image/jpeg;base64,${btoa(bin)}`;
  } catch (e) {
    console.warn('[ImgPrompt] makeThumbnail failed:', e.message);
    return null;
  }
}

// ── Image cache (SHA-256 по хэшу сжатого изображения) ────────────────
const IMG_CACHE_PREFIX = 'imgCache:';
const IMG_CACHE_MAX    = 100;
const IMG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

async function hashImage(base64) {
  const buf = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getCachedResult(hash) {
  const key = IMG_CACHE_PREFIX + hash;
  const data = await new Promise(resolve => chrome.storage.local.get({ [key]: null }, resolve));
  const entry = data[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > IMG_CACHE_TTL_MS) {
    chrome.storage.local.remove(key); // протухшая запись
    return null;
  }
  return entry; // { content, thumbnail, ts }
}

async function setCachedResult(hash, content, thumbnail) {
  const key = IMG_CACHE_PREFIX + hash;
  // Прунинг: удаляем самые старые записи если превышен лимит
  const all = await new Promise(resolve => chrome.storage.local.get(null, resolve));
  const cacheKeys = Object.keys(all).filter(k => k.startsWith(IMG_CACHE_PREFIX));
  if (cacheKeys.length >= IMG_CACHE_MAX) {
    const oldest = cacheKeys.sort((a, b) => (all[a]?.ts || 0) - (all[b]?.ts || 0));
    await chrome.storage.local.remove(oldest.slice(0, cacheKeys.length - IMG_CACHE_MAX + 1));
  }
  await new Promise(resolve => chrome.storage.local.set({
    [key]: { content, thumbnail, ts: Date.now() }
  }, resolve));
}

// ── Strategy 1: Screenshot + crop (always works, no CORS) ────────
async function captureViaScreenshot(windowId, rect) {
  console.log('[ImgPrompt] Using captureVisibleTab strategy, windowId:', windowId, 'rect:', rect);

  const dataUrl = await browser.tabs.captureVisibleTab(windowId, {
    format: 'jpeg',
    quality: 90
  });

  if (!rect || rect.width < 10 || rect.height < 10) {
    // No rect — send full screenshot
    console.log('[ImgPrompt] No rect, using full screenshot');
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  }

  // Crop to image bounds using OffscreenCanvas (available in service worker)
  const screenResp = await fetch(dataUrl);
  const screenBlob = await screenResp.blob();
  const bitmap = await createImageBitmap(screenBlob);

  const dpr = rect.dpr || 1;
  const srcX = Math.round(rect.x * dpr);
  const srcY = Math.round(rect.y * dpr);
  const srcW = Math.round(rect.width * dpr);
  const srcH = Math.round(rect.height * dpr);

  // Clamp to actual screenshot size
  const clampedW = Math.min(srcW, bitmap.width - srcX);
  const clampedH = Math.min(srcH, bitmap.height - srcY);

  if (clampedW < 10 || clampedH < 10) {
    bitmap.close();
    console.log('[ImgPrompt] Rect outside viewport, using full screenshot');
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  }

  const canvas = new OffscreenCanvas(clampedW, clampedH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, srcX, srcY, clampedW, clampedH, 0, 0, clampedW, clampedH);
  bitmap.close();

  const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const buffer = await outBlob.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i += 32768) {
    binary += String.fromCharCode(...uint8.subarray(i, i + 32768));
  }
  const base64 = btoa(binary);

  console.log('[ImgPrompt] Cropped image:', clampedW, 'x', clampedH, 'size:', base64.length);
  return { base64, mimeType: 'image/jpeg' };
}

// ── Strategy 2: Direct URL fetch from service worker ─────────────
// Works for public images. Extension service workers bypass CORS
// for URLs covered by host_permissions: ["<all_urls>"]
async function captureViaUrlFetch(imageUrl) {
  console.log('[ImgPrompt] Fallback: fetching URL from service worker:', imageUrl);

  // User-Agent убран: это forbidden header, браузер его молча выбрасывал
  const resp = await fetch(imageUrl, {
    headers: {
      'Accept': 'image/*,*/*;q=0.8'
    }
  });

  if (!resp.ok) throw new Error(`Fetch failed: HTTP ${resp.status}`);

  const blob = await resp.blob();
  const mimeType = blob.type || 'image/jpeg';
  const buffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i += 32768) {
    binary += String.fromCharCode(...uint8.subarray(i, i + 32768));
  }
  const base64 = btoa(binary);

  console.log('[ImgPrompt] URL fetch OK, mime:', mimeType, 'size:', base64.length);
  return { base64, mimeType };
}

// ── Main analysis ─────────────────────────────────────────────────
async function runAnalysis(tabId, windowId, imageUrl, imageRect, lang) {
  const settings = await getSettings();

  // ★ Local providers (Ollama, LM Studio, Jan) don't require an API key
  if (!settings.apiKey?.trim() && !isLocalProvider(settings.apiUrl)) {
    throw new Error('API ключ не настроен. Откройте popup расширения.');
  }

  // Try screenshot+crop first (most reliable), fall back to URL fetch
  let imageData;
  try {
    imageData = await captureViaScreenshot(windowId, imageRect);
  } catch (screenshotErr) {
    console.warn('[ImgPrompt] Screenshot failed:', screenshotErr.message, '— trying URL fetch');
    try {
      imageData = await captureViaUrlFetch(imageUrl);
    } catch (fetchErr) {
      throw new Error(
        `Не удалось получить изображение.\n` +
        `Скриншот: ${screenshotErr.message}\n` +
        `URL fetch: ${fetchErr.message}`
      );
    }
  }

  const compressedImage = await compressImageData(imageData, settings);
  const { base64, mimeType } = compressedImage;
  console.log('[ImgPrompt] Compressed image:', compressedImage.width, 'x', compressedImage.height, 'base64:', base64.length);

  // Кэш учитывает язык + модель: одна картинка на RU ≠ та же на EN
  const { apiUrl, apiKey, model } = settings;
  const promptLang = lang || settings.language || 'en';

  const imageHash = await hashImage(base64);
  const cacheKey  = `${imageHash}:${promptLang}:${model}`;
  const cached    = await getCachedResult(cacheKey);
  if (cached) {
    console.log('[ImgPrompt] ⚡ Cache hit:', imageHash.slice(0, 8), promptLang, model.slice(-12));
    return { content: cached.content, thumbnail: cached.thumbnail };
  }

  // Call OpenRouter-compatible API
  const systemPrompt = await getConfiguredSystemPrompt(promptLang);
  console.log('[ImgPrompt] API:', apiUrl, '| model:', model, '| lang:', promptLang);

  const request = createRequestController(settings);
  let resp;
  try {
    resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://imgprompt.extension',
        'X-Title': 'ImgPrompt AI Extension'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' }
              },
              { type: 'text', text: getUserMessage(promptLang, 'image') }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.4
      })
    });
  } catch (error) {
    throw new Error(formatApiError(error, settings));
  } finally {
    request.cleanup();
  }

  const text = await resp.text();
  console.log('[ImgPrompt] API status:', resp.status, '| preview:', text.slice(0, 200));

  if (!resp.ok) {
    let errMsg = `API error ${resp.status}`;
    try {
      const errData = JSON.parse(text);
      errMsg = errData.error?.message || errData.message || errMsg;
    } catch (_) { errMsg += ': ' + text.slice(0, 200); }
    throw new Error(formatApiError(new Error(errMsg), settings, resp.status));
  }

  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Пустой ответ API. Ответ: ' + text.slice(0, 150));

  const thumbnail = await makeThumbnail(compressedImage);
  // Сохраняем в кэш — ошибка записи не критична, поэтому catch
  setCachedResult(cacheKey, content, thumbnail).catch(e =>
    console.warn('[ImgPrompt] Cache write failed:', e.message)
  );
  return { content, thumbnail };
}

// ── Context menu ─────────────────────────────────────────────────
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'imgprompt-analyze',
      title: '\uD83D\uDD2E ImgPrompt — получить промпт',
      contexts: ['image']
    });
  });
}

// Create on install AND on startup (service worker restarts lose menus)
chrome.runtime.onInstalled.addListener(setupContextMenu);
chrome.runtime.onStartup.addListener(setupContextMenu);
// Also create immediately when script loads
setupContextMenu();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'imgprompt-analyze') return;
  if (!tab?.id) return;

  // Send to content script — it will find the image rect and reply
  chrome.tabs.sendMessage(tab.id, {
    type: 'START_ANALYSIS',
    imageUrl: info.srcUrl || ''
  }).catch(() => {
    // Inject content script if not present
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).then(() => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'START_ANALYSIS',
        imageUrl: info.srcUrl || ''
      });
    });
  });
});

// ── Message handler ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // PING -- liveness check
  if (msg.type === 'PING') { sendResponse({ pong: true, ts: Date.now() }); return; }

  // GET_SETTINGS -- used by content.js
  if (msg.type === 'GET_SETTINGS') {
    getSettings().then(s => sendResponse(s)).catch(() => sendResponse({}));
    return true;
  }

  // ── ANALYZE_IMAGE ──────────────────────────────────────────────
  // Content script sends: { type, imageUrl, imageRect }
  // imageRect: { x, y, width, height, dpr } — viewport coords of the image
  if (msg.type === 'ANALYZE_IMAGE') {
    const tabId    = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (!tabId) {
      sendResponse({ success: false, error: 'Нет tabId — невозможно захватить экран' });
      return true;
    }

    console.log('[ImgPrompt] ANALYZE_IMAGE tab:', tabId,
      'url:', msg.imageUrl?.slice(0, 60),
      'rect:', msg.imageRect);

    // ★ Mark loading in side panel + open it
    chrome.storage.local.set({
      pendingAnalysis: {
        status: 'loading',
        imageUrl: msg.imageUrl || null,
        timestamp: Date.now()
      }
    });
    // Open side panel automatically
    if (chrome.sidePanel?.open) chrome.sidePanel.open({ tabId }).catch(() => {});

    runAnalysis(tabId, windowId, msg.imageUrl, msg.imageRect, msg.lang || 'en')
      .then(({ content, thumbnail }) => {
        console.log('[ImgPrompt] ✅ Analysis complete');

        // Локальная миниатюра (dataURL) приоритетнее удалённого URL:
        // она не зависит от сайта и интернета.
        getSettings().then(s => appendHistory({
          thumb: thumbnail || msg.imageUrl || null,
          prompt: content,
          model: s.model,
          ts: Date.now()
        }));

        // ★ Update side panel with result
        chrome.storage.local.set({
          pendingAnalysis: {
            status: 'done',
            result: content,
            imageUrl: msg.imageUrl || null,
            timestamp: Date.now()
          }
        });

        sendResponse({ success: true, result: content });
      })
      .catch(err => {
        console.error('[ImgPrompt] ❌ Error:', err.message);

        // ★ Write error to side panel too
        chrome.storage.local.set({
          pendingAnalysis: {
            status: 'error',
            error: err.message,
            timestamp: Date.now()
          }
        });

        sendResponse({ success: false, error: err.message });
      });

    return true; // keep channel open for async
  }

  // ── ANALYZE_IMAGE_DATA ────────────────────────────────────────
  // For video frames — dataUrl already captured in content.js via canvas
  if (msg.type === 'ANALYZE_IMAGE_DATA') {
    (async () => {
      try {
        const settings = await getSettings();
        // ★ Local providers don't require an API key
        if (!settings.apiKey?.trim() && !isLocalProvider(settings.apiUrl)) {
          throw new Error('API ключ не настроен');
        }

        const { apiUrl, apiKey, model } = settings;
        const promptLang = msg.lang || settings.language || 'en';
        const systemPrompt = await getConfiguredSystemPrompt(promptLang);

        // Extract base64 from dataUrl (data:image/jpeg;base64,XXX)
        const [header, base64] = msg.dataUrl.split(',');
        const mimeType = header.split(':')[1].split(';')[0] || 'image/jpeg';
        const compressed = await compressImageData({ base64, mimeType }, settings);

        const request = createRequestController(settings);
        let resp;
        try {
          resp = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: [
                  { type: 'text', text: getUserMessage(promptLang, 'video') },
                  { type: 'image_url', image_url: { url: `data:${compressed.mimeType};base64,${compressed.base64}` } }
                ]}
              ],
              max_tokens: 2000,
              temperature: 0.4
            })
          });
        } catch (error) {
          throw new Error(formatApiError(error, settings));
        } finally {
          request.cleanup();
        }

        const text = await resp.text();
        if (!resp.ok) {
          let errMsg = `HTTP ${resp.status}`;
          try { errMsg = JSON.parse(text).error?.message || errMsg; } catch(_) {}
          throw new Error(formatApiError(new Error(errMsg), settings, resp.status));
        }
        const data = JSON.parse(text);
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Пустой ответ API');

        // Кадр видео теперь тоже получает постоянную миниатюру
        const videoThumb = await makeThumbnail(compressed);
        appendHistory({ thumb: videoThumb || null, prompt: content, model, ts: Date.now(), source: 'video' });

        sendResponse({ success: true, result: content });
      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ── CANCEL_ANALYSIS ───────────────────────────────────────────
  if (msg.type === 'CANCEL_ANALYSIS') {
    if (activeRequestController) activeRequestController.abort();
    sendResponse({ success: true });
    return false;
  }

  // ── GET_SETTINGS ──────────────────────────────────────────────
  if (msg.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  // ── TEST_CONNECTION ─────────────────────────────────────────
  if (msg.type === 'TEST_CONNECTION') {
    (async () => {
      try {
        const s = await getSettings();
        const result = await fetchModels(s, Boolean(msg.forceRefresh));
        const allModels = result.data;
        const local = isLocalProvider(s.apiUrl);
        const visionModels = allModels
          .filter(m => {
            if (local) return true; // локальные моделей мало, показываем все (llava, moondream не попадают под vision|vl)
            const arch = m.architecture || {};
            const inputs = arch.input_modalities || arch.modality || [];
            const inputStr = Array.isArray(inputs) ? inputs.join(',') : String(inputs);
            return inputStr.includes('image') || inputStr.includes('multimodal') || /vision|vl|image|llama-4|scout|maverick|gemini|gpt-4o|pixtral/i.test(m.id || '');
          })
          .sort((a, b) => parseFloat(a.pricing?.prompt || '0') - parseFloat(b.pricing?.prompt || '0'))
          .map(m => ({ id: m.id, name: m.name || m.id, free: parseFloat(m.pricing?.prompt || '0') === 0 }));
        sendResponse({ success: true, total: allModels.length, visionModels: visionModels.slice(0, 50), cached: result.cached });
      } catch (e) {
        const s = await getSettings();
        sendResponse({ success: false, error: formatApiError(e, s) });
      }
    })();
    return true;
  }

});