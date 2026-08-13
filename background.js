// ═══════════════════════════════════════════════════════════════
//  ImgPrompt AI — Background Service Worker  v2.0
//
//  Стратегия получения картинки (от надёжной к запасной):
//  1. chrome.tabs.captureVisibleTab → кроп по rect — ВСЕГДА работает
//  2. fetch() из service worker — для загрузки, если картинка не на экране
// ═══════════════════════════════════════════════════════════════

import { getSystemPrompt, getUserMessage } from './prompts.js';

const DEFAULTS = {
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  apiKey: '',   // user enters their own key in popup
  model:  'qwen/qwen2.5-vl-72b-instruct'
};


// ── Settings ─────────────────────────────────────────────────────
async function getSettings() {
  return new Promise(resolve => chrome.storage.sync.get(DEFAULTS, resolve));
}

// ── Strategy 1: Screenshot + crop (always works, no CORS) ────────
async function captureViaScreenshot(tabId, rect) {
  console.log('[ImgPrompt] Using captureVisibleTab strategy, rect:', rect);

  const dataUrl = await chrome.tabs.captureVisibleTab(tabId, {
    format:  'jpeg',
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
  const bitmap     = await createImageBitmap(screenBlob);

  const dpr    = rect.dpr || 1;
  const srcX   = Math.round(rect.x      * dpr);
  const srcY   = Math.round(rect.y      * dpr);
  const srcW   = Math.round(rect.width  * dpr);
  const srcH   = Math.round(rect.height * dpr);

  // Clamp to actual screenshot size
  const clampedW = Math.min(srcW, bitmap.width  - srcX);
  const clampedH = Math.min(srcH, bitmap.height - srcY);

  if (clampedW < 10 || clampedH < 10) {
    bitmap.close();
    console.log('[ImgPrompt] Rect outside viewport, using full screenshot');
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  }

  const canvas = new OffscreenCanvas(clampedW, clampedH);
  const ctx    = canvas.getContext('2d');
  ctx.drawImage(bitmap, srcX, srcY, clampedW, clampedH, 0, 0, clampedW, clampedH);
  bitmap.close();

  const outBlob  = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  const buffer   = await outBlob.arrayBuffer();
  const uint8    = new Uint8Array(buffer);
  let   binary   = '';
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

  const resp = await fetch(imageUrl, {
    headers: {
      'Accept':     'image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!resp.ok) throw new Error(`Fetch failed: HTTP ${resp.status}`);

  const blob     = await resp.blob();
  const mimeType = blob.type || 'image/jpeg';
  const buffer   = await blob.arrayBuffer();
  const uint8    = new Uint8Array(buffer);
  let   binary   = '';
  for (let i = 0; i < uint8.length; i += 32768) {
    binary += String.fromCharCode(...uint8.subarray(i, i + 32768));
  }
  const base64 = btoa(binary);

  console.log('[ImgPrompt] URL fetch OK, mime:', mimeType, 'size:', base64.length);
  return { base64, mimeType };
}

// ── Main analysis ─────────────────────────────────────────────────
async function runAnalysis(tabId, imageUrl, imageRect, lang) {
  const settings = await getSettings();

  if (!settings.apiKey?.trim()) {
    throw new Error('API ключ не настроен. Откройте popup расширения.');
  }

  // Try screenshot+crop first (most reliable), fall back to URL fetch
  let imageData;
  try {
    imageData = await captureViaScreenshot(tabId, imageRect);
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

  const { base64, mimeType } = imageData;

  // Call OpenRouter API
  const { apiUrl, apiKey, model } = settings;
  const promptLang   = lang || 'en';                          // не переписываем параметр!
  const systemPrompt = getSystemPrompt(promptLang);
  console.log('[ImgPrompt] API:', apiUrl, '| model:', model, '| lang:', promptLang);

  const resp = await fetch(apiUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  'https://imgprompt.extension',
      'X-Title':       'ImgPrompt AI Extension'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type:      'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' }
            },
            { type: 'text', text: getUserMessage(promptLang, 'image') }
          ]
        }
      ],
      max_tokens:  2000,
      temperature: 0.4
    })
  });

  const text = await resp.text();
  console.log('[ImgPrompt] API status:', resp.status, '| preview:', text.slice(0, 200));

  if (!resp.ok) {
    let errMsg = `API error ${resp.status}`;
    try {
      const errData = JSON.parse(text);
      errMsg = errData.error?.message || errData.message || errMsg;
    } catch (_) { errMsg += ': ' + text.slice(0, 200); }
    throw new Error(errMsg);
  }

  const data    = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Пустой ответ API. Ответ: ' + text.slice(0, 150));

  return content;
}

// ── Context menu ─────────────────────────────────────────────────
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id:       'imgprompt-analyze',
      title:    '\uD83D\uDD2E ImgPrompt — получить промпт',
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
    type:     'START_ANALYSIS',
    imageUrl: info.srcUrl || ''
  }).catch(() => {
    // Inject content script if not present
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files:  ['content.js']
    }).then(() => {
      chrome.tabs.sendMessage(tab.id, {
        type:     'START_ANALYSIS',
        imageUrl: info.srcUrl || ''
      });
    });
  });
});

// ── Message handler ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ── ANALYZE_IMAGE ──────────────────────────────────────────────
  // Content script sends: { type, imageUrl, imageRect }
  // imageRect: { x, y, width, height, dpr } — viewport coords of the image
  if (msg.type === 'ANALYZE_IMAGE') {
    const tabId = sender.tab?.id;
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
        status:    'loading',
        imageUrl:  msg.imageUrl || null,
        timestamp: Date.now()
      }
    });
    // Open side panel automatically
    chrome.sidePanel.open({ tabId }).catch(() => {});

    runAnalysis(tabId, msg.imageUrl, msg.imageRect, msg.lang || 'en')
      .then(result => {
        console.log('[ImgPrompt] ✅ Analysis complete');

        // Save to history
        chrome.storage.sync.get({ model: 'qwen/qwen2.5-vl-72b-instruct' }, ({ model }) => {
          chrome.storage.local.get({ history: [] }, ({ history }) => {
            history.push({
              thumb:  msg.imageUrl,
              prompt: result,
              model,
              ts: Date.now()
            });
            if (history.length > 50) history.splice(0, history.length - 50);
            chrome.storage.local.set({ history });
          });
        });

        // ★ Update side panel with result
        chrome.storage.local.set({
          pendingAnalysis: {
            status:    'done',
            result,
            imageUrl:  msg.imageUrl || null,
            timestamp: Date.now()
          }
        });

        sendResponse({ success: true, result });
      })
      .catch(err => {
        console.error('[ImgPrompt] ❌ Error:', err.message);

        // ★ Write error to side panel too
        chrome.storage.local.set({
          pendingAnalysis: {
            status:    'error',
            error:     err.message,
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
        if (!settings.apiKey?.trim()) throw new Error('API ключ не настроен');

        const { apiUrl, apiKey, model } = settings;
        const promptLang   = msg.lang || 'en';
        const systemPrompt = getSystemPrompt(promptLang);

        // Extract base64 from dataUrl (data:image/jpeg;base64,XXX)
        const [header, base64] = msg.dataUrl.split(',');
        const mimeType = header.split(':')[1].split(';')[0] || 'image/jpeg';

        const resp = await fetch(apiUrl, {
          method:  'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: [
                { type: 'text',       text: getUserMessage(promptLang, 'video') },
                { type: 'image_url',  image_url: { url: `data:${mimeType};base64,${base64}` } }
              ]}
            ],
            max_tokens: 2000,
            temperature: 0.4
          })
        });

        const text = await resp.text();
        if (!resp.ok) {
          let errMsg = `HTTP ${resp.status}`;
          try { errMsg = JSON.parse(text).error?.message || errMsg; } catch(_) {}
          throw new Error(errMsg);
        }
        const data    = JSON.parse(text);
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Пустой ответ API');

        // Save to history
        chrome.storage.local.get({ history: [] }, ({ history }) => {
          history.push({ thumb: null, prompt: content, model, ts: Date.now(), source: 'video' });
          if (history.length > 50) history.splice(0, history.length - 50);
          chrome.storage.local.set({ history });
        });

        sendResponse({ success: true, result: content });
      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
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
        const s    = await getSettings();
        const base = s.apiUrl.replace(/\/chat\/completions$/i, '');
        const r    = await fetch(`${base}/models`, {
          headers: { 'Authorization': `Bearer ${s.apiKey}` }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const d = await r.json();
        const allModels = d.data || [];

        // Filter for vision/image-capable models
        const visionModels = allModels
          .filter(m => {
            const arch = m.architecture || {};
            // OpenRouter v1 schema: architecture.input_modalities = ["text","image"]
            const inputs = arch.input_modalities || arch.modality || [];
            const inputStr = Array.isArray(inputs) ? inputs.join(',') : String(inputs);
            return inputStr.includes('image') || inputStr.includes('multimodal');
          })
          .sort((a, b) => {
            // Free models first
            const aPrice = a.pricing?.prompt || '0';
            const bPrice = b.pricing?.prompt || '0';
            return parseFloat(aPrice) - parseFloat(bPrice);
          })
          .map(m => ({
            id:   m.id,
            name: m.name || m.id,
            free: parseFloat(m.pricing?.prompt || '0') === 0
          }));

        sendResponse({
          success:      true,
          total:        allModels.length,
          visionModels: visionModels.slice(0, 30) // cap at 30
        });
      } catch(e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

});
