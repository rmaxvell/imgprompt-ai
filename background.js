// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// ImgPrompt AI вЂ” Background Service Worker v2.0
//
// РЎС‚СЂР°С‚РµРіРёСЏ РїРѕР»СѓС‡РµРЅРёСЏ РєР°СЂС‚РёРЅРєРё (РѕС‚ РЅР°РґС‘Р¶РЅРѕР№ Рє Р·Р°РїР°СЃРЅРѕР№):
// 1. chrome.tabs.captureVisibleTab в†’ РєСЂРѕРї РїРѕ rect вЂ” Р’РЎР•Р“Р”Рђ СЂР°Р±РѕС‚Р°РµС‚
// 2. fetch() РёР· service worker вЂ” РґР»СЏ Р·Р°РіСЂСѓР·РєРё, РµСЃР»Рё РєР°СЂС‚РёРЅРєР° РЅРµ РЅР° СЌРєСЂР°РЅРµ
// в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ

import { getSystemPrompt, getUserMessage } from './prompts.js';

// вљ пёЏ Р•РґРёРЅР°СЏ С‚РѕС‡РєР° РґРµС„РѕР»С‚РѕРІ. РџРµСЂРµРґ СЂРµР»РёР·РѕРј СЃРІРµСЂСЊС‚Рµ ID РјРѕРґРµР»Рё,
// РЅР°РїСЂРёРјРµСЂ: curl https://openrouter.ai/api/v1/models
const DEFAULT_MODEL = 'qwen/qwen2.5-vl-72b-instruct';

const DEFAULTS = {
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: '', // user enters their own key in popup
  model: DEFAULT_MODEL,
  language: 'ru', // С„РѕР»Р±СЌРє-СЏР·С‹Рє Р°РЅР°Р»РёР·Р°, РµРґРёРЅС‹Р№ СЃ options
  imageMaxSize: 1024,
  imageQuality: 0.85,
  requestTimeout: 0 // 0 = provider-aware default: 120s local, 60s cloud
};

// РћРґРЅРѕСЂР°Р·РѕРІР°СЏ РјРёРіСЂР°С†РёСЏ РЅР°СЃС‚СЂРѕРµРє РёР· storage.sync в†’ storage.local.
// РќСѓР¶РЅР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРј, РєРѕС‚РѕСЂС‹Рµ СѓР¶Рµ СЃРѕС…СЂР°РЅРёР»Рё РєР»СЋС‡ СЃРѕ СЃС‚Р°СЂРѕР№ РІРµСЂСЃРёРµР№.
(async () => {
  try {
    const localData = await chrome.storage.local.get(DEFAULTS);
    const syncData = await chrome.storage.sync.get(null);
    const migrate = {};
    for (const k of Object.keys(DEFAULTS)) {
      if (!localData[k] && syncData[k] !== undefined && syncData[k] !== '') migrate[k] = syncData[k];
    }
    // РљР»СЋС‡Рё РїСЂРѕС„РёР»РµР№ РёР· popup: key_openrouter, key_groq Рё С‚.Рґ.
    Object.keys(syncData).forEach(k => {
      if (k.startsWith('key_') && syncData[k] && !localData[k]) migrate[k] = syncData[k];
    });
    if (Object.keys(migrate).length) await chrome.storage.local.set(migrate);
  } catch (e) {
    console.warn('[ImgPrompt] syncв†’local migration failed:', e);
  }
})();

const MODELS_CACHE_TTL = 5 * 60 * 1000;
const LOCAL_TIMEOUT_MS = 300 * 1000; // LLaVA РЅР° CPU СЃ РєР°СЂС‚РёРЅРєРѕР№ 1024px РјРѕР¶РµС‚ РёРґС‚Рё > 2 РјРёРЅ
const CLOUD_TIMEOUT_MS = 60 * 1000;
let activeRequestController = null;

// РЎРµСЂРёР°Р»РёР·Р°С†РёСЏ Р·Р°РїРёСЃРё РёСЃС‚РѕСЂРёРё: РёСЃРєР»СЋС‡Р°РµС‚ РїРѕС‚РµСЂСЋ Р·Р°РїРёСЃРµР№
// РїСЂРё РїР°СЂР°Р»Р»РµР»СЊРЅС‹С… Р°РЅР°Р»РёР·Р°С… (read-modify-write Р±РµР· Р±Р»РѕРєРёСЂРѕРІРєРё)
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
    // РџСЂРёРІР°С‚РЅС‹Рµ РїРѕРґСЃРµС‚Рё: Ollama РЅР° СЃРѕСЃРµРґРЅРµРј РєРѕРјРїСЊСЋС‚РµСЂРµ РёР»Рё NAS
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
  const message = String(error?.message || error || 'РќРµРёР·РІРµСЃС‚РЅР°СЏ РѕС€РёР±РєР°');
  const local = isLocalProvider(settings?.apiUrl);
  if (error?.name === 'AbortError' || /aborted|timeout|timed out/i.test(message)) {
    return `РњРѕРґРµР»СЊ РЅРµ РѕС‚РІРµС‚РёР»Р° Р·Р° ${getRequestTimeoutSeconds(settings)} СЃРµРєСѓРЅРґ. РџРѕРїСЂРѕР±СѓР№С‚Рµ СѓРјРµРЅСЊС€РёС‚СЊ СЂР°Р·РјРµСЂ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РёР»Рё РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РјРµРЅСЊС€СѓСЋ РјРѕРґРµР»СЊ.`;
  }
  if (local && (error instanceof TypeError || /failed to fetch|networkerror|fetch failed|cors/i.test(message))) {
    return /cors/i.test(message)
      ? 'РћС€РёР±РєР° CORS. Р”Р»СЏ Ollama РЅР°СЃС‚СЂРѕР№С‚Рµ OLLAMA_ORIGINS.'
      : 'Р›РѕРєР°Р»СЊРЅС‹Р№ СЃРµСЂРІРµСЂ РЅРµ Р·Р°РїСѓС‰РµРЅ. Р—Р°РїСѓСЃС‚РёС‚Рµ Ollama/LM Studio/Jan.';
  }
  if (status === 404 || /model[^\n]*(not found|does not exist)|model_not_found/i.test(message)) {
    return 'РњРѕРґРµР»СЊ РЅРµ РЅР°Р№РґРµРЅР°. РџСЂРѕРІРµСЂСЊС‚Рµ model ID С‡РµСЂРµР· /v1/models.';
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

// в”Ђв”Ђ Settings в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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

// РњРёРЅРёР°С‚СЋСЂР° РґР»СЏ РёСЃС‚РѕСЂРёРё: РјР°Р»РµРЅСЊРєРёР№ JPEG-dataURL РёР· СѓР¶Рµ РїРѕР»СѓС‡РµРЅРЅРѕР№ РєР°СЂС‚РёРЅРєРё.
// Р”РµР»Р°РµС‚ Р·Р°РїРёСЃСЊ СЃР°РјРѕРґРѕСЃС‚Р°С‚РѕС‡РЅРѕР№ вЂ” РїСЂРµРІСЊСЋ РЅРµ СѓРјРёСЂР°РµС‚ РѕС„Р»Р°Р№РЅ Рё РїСЂРё hotlink-Р·Р°С‰РёС‚Рµ.
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

// в”Ђв”Ђ Image cache (SHA-256 РїРѕ С…СЌС€Сѓ СЃР¶Р°С‚РѕРіРѕ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const IMG_CACHE_PREFIX = 'imgCache:';
const IMG_CACHE_MAX    = 100;
const IMG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 РґРЅРµР№

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
    chrome.storage.local.remove(key); // РїСЂРѕС‚СѓС…С€Р°СЏ Р·Р°РїРёСЃСЊ
    return null;
  }
  return entry; // { content, thumbnail, ts }
}

async function setCachedResult(hash, content, thumbnail) {
  const key = IMG_CACHE_PREFIX + hash;
  // РџСЂСѓРЅРёРЅРі: СѓРґР°Р»СЏРµРј СЃР°РјС‹Рµ СЃС‚Р°СЂС‹Рµ Р·Р°РїРёСЃРё РµСЃР»Рё РїСЂРµРІС‹С€РµРЅ Р»РёРјРёС‚
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

// в”Ђв”Ђ Strategy 1: Screenshot + crop (always works, no CORS) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
async function captureViaScreenshot(tabId, rect) {
  console.log('[ImgPrompt] Using captureVisibleTab strategy, rect:', rect);

  const dataUrl = await chrome.tabs.captureVisibleTab(tabId, {
    format: 'jpeg',
    quality: 90
  });

  if (!rect || rect.width < 10 || rect.height < 10) {
    // No rect вЂ” send full screenshot
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

// в”Ђв”Ђ Strategy 2: Direct URL fetch from service worker в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Works for public images. Extension service workers bypass CORS
// for URLs covered by host_permissions: ["<all_urls>"]
async function captureViaUrlFetch(imageUrl) {
  console.log('[ImgPrompt] Fallback: fetching URL from service worker:', imageUrl);

  // User-Agent СѓР±СЂР°РЅ: СЌС‚Рѕ forbidden header, Р±СЂР°СѓР·РµСЂ РµРіРѕ РјРѕР»С‡Р° РІС‹Р±СЂР°СЃС‹РІР°Р»
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

// в”Ђв”Ђ Main analysis в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
async function runAnalysis(tabId, imageUrl, imageRect, lang) {
  const settings = await getSettings();

  // в… Local providers (Ollama, LM Studio, Jan) don't require an API key
  if (!settings.apiKey?.trim() && !isLocalProvider(settings.apiUrl)) {
    throw new Error('API РєР»СЋС‡ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ. РћС‚РєСЂРѕР№С‚Рµ popup СЂР°СЃС€РёСЂРµРЅРёСЏ.');
  }

  // Try screenshot+crop first (most reliable), fall back to URL fetch
  let imageData;
  try {
    imageData = await captureViaScreenshot(tabId, imageRect);
  } catch (screenshotErr) {
    console.warn('[ImgPrompt] Screenshot failed:', screenshotErr.message, 'вЂ” trying URL fetch');
    try {
      imageData = await captureViaUrlFetch(imageUrl);
    } catch (fetchErr) {
      throw new Error(
        `РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ.\n` +
        `РЎРєСЂРёРЅС€РѕС‚: ${screenshotErr.message}\n` +
        `URL fetch: ${fetchErr.message}`
      );
    }
  }

  const compressedImage = await compressImageData(imageData, settings);
  const { base64, mimeType } = compressedImage;
  console.log('[ImgPrompt] Compressed image:', compressedImage.width, 'x', compressedImage.height, 'base64:', base64.length);

  // РљСЌС€ СѓС‡РёС‚С‹РІР°РµС‚ СЏР·С‹Рє + РјРѕРґРµР»СЊ: РѕРґРЅР° РєР°СЂС‚РёРЅРєР° РЅР° RU в‰  С‚Р° Р¶Рµ РЅР° EN
  const { apiUrl, apiKey, model } = settings;
  const promptLang = lang || settings.language || 'en';

  const imageHash = await hashImage(base64);
  const cacheKey  = `${imageHash}:${promptLang}:${model}`;
  const cached    = await getCachedResult(cacheKey);
  if (cached) {
    console.log('[ImgPrompt] вљЎ Cache hit:', imageHash.slice(0, 8), promptLang, model.slice(-12));
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
  if (!content) throw new Error('РџСѓСЃС‚РѕР№ РѕС‚РІРµС‚ API. РћС‚РІРµС‚: ' + text.slice(0, 150));

  const thumbnail = await makeThumbnail(compressedImage);
  // РЎРѕС…СЂР°РЅСЏРµРј РІ РєСЌС€ вЂ” РѕС€РёР±РєР° Р·Р°РїРёСЃРё РЅРµ РєСЂРёС‚РёС‡РЅР°, РїРѕСЌС‚РѕРјСѓ catch
  setCachedResult(cacheKey, content, thumbnail).catch(e =>
    console.warn('[ImgPrompt] Cache write failed:', e.message)
  );
  return { content, thumbnail };
}

// в”Ђв”Ђ Context menu в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'imgprompt-analyze',
      title: '\uD83D\uDD2E ImgPrompt вЂ” РїРѕР»СѓС‡РёС‚СЊ РїСЂРѕРјРїС‚',
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

  // Send to content script вЂ” it will find the image rect and reply
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

// в”Ђв”Ђ Message handler в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // в”Ђв”Ђ ANALYZE_IMAGE в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  // Content script sends: { type, imageUrl, imageRect }
  // imageRect: { x, y, width, height, dpr } вЂ” viewport coords of the image
  if (msg.type === 'ANALYZE_IMAGE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'РќРµС‚ tabId вЂ” РЅРµРІРѕР·РјРѕР¶РЅРѕ Р·Р°С…РІР°С‚РёС‚СЊ СЌРєСЂР°РЅ' });
      return true;
    }

    console.log('[ImgPrompt] ANALYZE_IMAGE tab:', tabId,
      'url:', msg.imageUrl?.slice(0, 60),
      'rect:', msg.imageRect);

    // в… Mark loading in side panel + open it
    chrome.storage.local.set({
      pendingAnalysis: {
        status: 'loading',
        imageUrl: msg.imageUrl || null,
        timestamp: Date.now()
      }
    });
    // Open side panel automatically
    chrome.sidePanel.open({ tabId }).catch(() => {});

    runAnalysis(tabId, msg.imageUrl, msg.imageRect, msg.lang || 'en')
      .then(({ content, thumbnail }) => {
        console.log('[ImgPrompt] вњ… Analysis complete');

        // Р›РѕРєР°Р»СЊРЅР°СЏ РјРёРЅРёР°С‚СЋСЂР° (dataURL) РїСЂРёРѕСЂРёС‚РµС‚РЅРµРµ СѓРґР°Р»С‘РЅРЅРѕРіРѕ URL:
        // РѕРЅР° РЅРµ Р·Р°РІРёСЃРёС‚ РѕС‚ СЃР°Р№С‚Р° Рё РёРЅС‚РµСЂРЅРµС‚Р°.
        getSettings().then(s => appendHistory({
          thumb: thumbnail || msg.imageUrl || null,
          prompt: content,
          model: s.model,
          ts: Date.now()
        }));

        // в… Update side panel with result
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
        console.error('[ImgPrompt] вќЊ Error:', err.message);

        // в… Write error to side panel too
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

  // в”Ђв”Ђ ANALYZE_IMAGE_DATA в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  // For video frames вЂ” dataUrl already captured in content.js via canvas
  if (msg.type === 'ANALYZE_IMAGE_DATA') {
    (async () => {
      try {
        const settings = await getSettings();
        // в… Local providers don't require an API key
        if (!settings.apiKey?.trim() && !isLocalProvider(settings.apiUrl)) {
          throw new Error('API РєР»СЋС‡ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ');
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
        if (!content) throw new Error('РџСѓСЃС‚РѕР№ РѕС‚РІРµС‚ API');

        // РљР°РґСЂ РІРёРґРµРѕ С‚РµРїРµСЂСЊ С‚РѕР¶Рµ РїРѕР»СѓС‡Р°РµС‚ РїРѕСЃС‚РѕСЏРЅРЅСѓСЋ РјРёРЅРёР°С‚СЋСЂСѓ
        const videoThumb = await makeThumbnail(compressed);
        appendHistory({ thumb: videoThumb || null, prompt: content, model, ts: Date.now(), source: 'video' });

        sendResponse({ success: true, result: content });
      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // в”Ђв”Ђ CANCEL_ANALYSIS в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  if (msg.type === 'CANCEL_ANALYSIS') {
    if (activeRequestController) activeRequestController.abort();
    sendResponse({ success: true });
    return false;
  }

  // в”Ђв”Ђ GET_SETTINGS в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  if (msg.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  // в”Ђв”Ђ TEST_CONNECTION в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  if (msg.type === 'TEST_CONNECTION') {
    (async () => {
      try {
        const s = await getSettings();
        const result = await fetchModels(s, Boolean(msg.forceRefresh));
        const allModels = result.data;
        const local = isLocalProvider(s.apiUrl);
        const visionModels = allModels
          .filter(m => {
            if (local) return true; // Р»РѕРєР°Р»СЊРЅС‹Рµ РјРѕРґРµР»РµР№ РјР°Р»Рѕ, РїРѕРєР°Р·С‹РІР°РµРј РІСЃРµ (llava, moondream РЅРµ РїРѕРїР°РґР°СЋС‚ РїРѕРґ vision|vl)
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