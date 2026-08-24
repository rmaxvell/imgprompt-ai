// в”Ђв”Ђ Profiles в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// РџСЂРµСЃРµС‚С‹ РЅРёР¶Рµ вЂ” С‚РѕР»СЊРєРѕ С„РѕР»Р±СЌРє РґРѕ РїРµСЂРІРѕРіРѕ РЅР°Р¶Р°С‚РёСЏ В«РџСЂРѕРІРµСЂРёС‚СЊ СЃРѕРµРґРёРЅРµРЅРёРµВ»,
// РєРѕС‚РѕСЂРѕРµ Р·Р°РјРµРЅСЏРµС‚ РёС… Р¶РёРІС‹Рј СЃРїРёСЃРєРѕРј РѕС‚ РїСЂРѕРІР°Р№РґРµСЂР°.
const PROFILES = {
 openrouter: {
 name: 'OpenRouter',
 icon: 'рџЊђ',
 baseUrl: 'https://openrouter.ai/api/v1',
 defaultModel: 'qwen/qwen2.5-vl-72b-instruct',
 models: [
 { id: 'qwen/qwen2.5-vl-72b-instruct', name: 'Qwen2.5 VL 72B', free: false, tag: 'TOP', cls: 'qwen' },
 { id: 'qwen/qwen2.5-vl-72b-instruct:free', name: 'Qwen2.5 VL 72B', free: true, tag: 'FREE', cls: 'qwen' },
 { id: 'qwen/qwen2.5-vl-7b-instruct', name: 'Qwen2.5 VL 7B', free: false, tag: '', cls: 'qwen' },
 { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', free: false, tag: '', cls: 'llama' },
 { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', free: false, tag: '', cls: 'gemini' },
 { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', free: false, tag: '', cls: 'openai' },
 ]
 },
 groq: {
 name: 'Groq',
 icon: 'вљЎ',
 baseUrl: 'https://api.groq.com/openai/v1',
 defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
 models: [
 // вљ пёЏ РЈ Groq ID СЃС‚СЂРѕРіРѕ СЃ РїСЂРµС„РёРєСЃРѕРј meta-llama/. llama-3.2-*-vision-preview РІС‹РІРµРґРµРЅС‹ РёР· СЌРєСЃРїР»СѓР°С‚Р°С†РёРё.
 { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', free: true, tag: 'BEST', cls: 'llama' },
 { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', free: true, tag: '', cls: 'llama' },
 ]
 },
 ollama: {
 name: 'Ollama',
 icon: 'рџ¦™',
 baseUrl: 'http://localhost:11434/v1',
 defaultModel: 'llava',
 requiresKey: false,
 models: [
 { id: 'llava', name: 'LLaVA', free: true, tag: 'LOCAL', cls: 'llama' },
 { id: 'moondream', name: 'Moondream', free: true, tag: 'LOCAL', cls: 'llama' },
 { id: 'llava-llama3', name: 'LLaVA Llama3', free: true, tag: 'LOCAL', cls: 'llama' },
 { id: 'bakllava', name: 'BakLLaVA', free: true, tag: 'LOCAL', cls: 'llama' },
 ]
 },
 lmstudio: {
 name: 'LM Studio',
 icon: 'рџ–Ґ',
 baseUrl: 'http://localhost:1234/v1',
 defaultModel: 'llava',
 requiresKey: false,
 models: [
 { id: 'llava', name: 'LLaVA', free: true, tag: 'LOCAL', cls: 'llama' },
 { id: 'moondream2', name: 'Moondream2', free: true, tag: 'LOCAL', cls: 'llama' },
 ]
 },
 jan: {
 name: 'Jan',
 icon: 'рџ¤–',
 baseUrl: 'http://localhost:1337/v1',
 defaultModel: 'llava',
 requiresKey: false,
 models: [
 { id: 'llava', name: 'LLaVA', free: true, tag: 'LOCAL', cls: 'llama' },
 ]
 }
};

const FACTORY_DEFAULTS = {
 apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
 apiKey: '',
 model: 'qwen/qwen2.5-vl-72b-instruct'
};

// active profile key ('openrouter' | 'groq' | ...)
let activeProfileId = 'openrouter';

// в”Ђв”Ђ Helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function getBaseUrl(chatUrl = '') {
 return chatUrl.replace(/\\/chat\\/completions$/i, '').replace(/\\/$/, '');
}
function toChatUrl(base = '') {
 const b = base.replace(/\\/$/, '');
 return /\\/chat\\/completions$/i.test(b) ? b : `${b}/chat/completions`;
}
function providerName(base = '') {
 // вљ пёЏ groq Р”РћР›Р–Р•Рќ РїСЂРѕРІРµСЂСЏС‚СЊСЃСЏ СЂР°РЅСЊС€Рµ openai: URL Groq СЃРѕРґРµСЂР¶РёС‚ '/openai/v1'
 if (base.includes('openrouter')) return 'OpenRouter';
 if (base.includes('groq')) return 'Groq';
 if (base.includes('openai')) return 'OpenAI';
 if (base.includes('anthropic')) return 'Anthropic';
 if (base.includes('together')) return 'Together';
 if (base.includes('11434')) return 'Ollama';
 if (base.includes('1234')) return 'LM Studio';
 if (base.includes('1337')) return 'Jan';
 if (base.includes('localhost') || base.includes('127.0.0.1')) return 'Local';
 return base.replace(/^https?:\\/\\//, '').split('/')[0].split('.')[0] || 'API';
}

// в”Ђв”Ђ Load settings в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// РҐСЂР°РЅРёР»РёС‰Рµ вЂ” chrome.storage.LOCAL: РєР»СЋС‡Рё РЅРµ РґРѕР»Р¶РЅС‹ СѓРµР·Р¶Р°С‚СЊ РІ Р°РєРєР°СѓРЅС‚ Google
function loadSettings() {
 return new Promise(resolve => {
 chrome.storage.local.get(null, data => {
 activeProfileId = data.activeProfile || 'openrouter';
 const prof = PROFILES[activeProfileId] || PROFILES.openrouter;
 resolve({
 apiUrl: data.apiUrl || prof.baseUrl + '/chat/completions',
 apiKey: data['key_' + activeProfileId] || data.apiKey || '',
 model: data.model || prof.defaultModel,
 profileId: activeProfileId
 });
 });
 });
}

// в”Ђв”Ђ Save settings в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function saveSettingsNow() {
 const base = document.getElementById('baseUrl')?.value.trim() || '';
 const key = document.getElementById('apiKey')?.value.trim() || '';
 const model = document.getElementById('modelInput')?.value.trim() || '';
 const save = {
 apiUrl: toChatUrl(base),
 apiKey: key,
 model,
 activeProfile: activeProfileId
 };
 save['key_' + activeProfileId] = key; // per-profile key
 return new Promise(resolve => chrome.storage.local.set(save, resolve));
}

// в”Ђв”Ђ Switch profile в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
window.switchProfile = function(profileId) {
 if (!PROFILES[profileId]) return;
 activeProfileId = profileId;

 document.querySelectorAll('.profile-btn').forEach(b => {
 b.classList.toggle('active', b.dataset.profile === profileId);
 });

 const prof = PROFILES[profileId];

 chrome.storage.local.get(null, data => {
 const key = data['key_' + profileId] || '';
 const model = (profileId === data.activeProfile ? data.model : null)
 || prof.defaultModel;

 document.getElementById('baseUrl').value = prof.baseUrl;
 document.getElementById('apiKey').value = key;
 document.getElementById('modelInput').value = model;

 populateChips(prof.models);
 syncChips(model);
 updateHeader();

 const save = { activeProfile: profileId, apiUrl: toChatUrl(prof.baseUrl), model };
 save['key_' + profileId] = key;
 chrome.storage.local.set(save);
 });
};

window.saveSettings = async function() {
 if (!validateFields()) return;
 await saveSettingsNow();
 flashBtn('saveBtn', 'вњ… РЎРѕС…СЂР°РЅРµРЅРѕ!', 'рџ’ѕ РЎРѕС…СЂР°РЅРёС‚СЊ', 'saved');
 updateHeader();
};

// в”Ђв”Ђ Reset в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
window.resetToDefaults = function() {
 // Keep the API key вЂ” only reset URL and model
 const key = document.getElementById('apiKey')?.value.trim() || '';
 chrome.storage.local.set({
 apiUrl: FACTORY_DEFAULTS.apiUrl,
 apiKey: key,
 model: FACTORY_DEFAULTS.model
 }, () => {
 document.getElementById('baseUrl').value = getBaseUrl(FACTORY_DEFAULTS.apiUrl);
 document.getElementById('modelInput').value = FACTORY_DEFAULTS.model;
 syncChips(FACTORY_DEFAULTS.model);
 flashBtn('resetBtn', 'вњ… РЎР±СЂРѕС€РµРЅРѕ', 'в†є РЎР±СЂРѕСЃ', 'saved');
 updateHeader();
 });
};

// в”Ђв”Ђ Open Side Panel в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
window.openSidePanel = function() {
  if (!chrome.sidePanel?.open) {
    showResult('вљ пёЏ Р‘РѕРєРѕРІР°СЏ РїР°РЅРµР»СЊ РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ РІ Chrome/Edge', false);
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (!tabs[0]?.id) return;
  chrome.sidePanel.open({ tabId: tabs[0].id })
  .then(() => window.close())
  .catch(e => console.warn('[ImgPrompt] sidePanel.open failed:', e));
  });
};

// в”Ђв”Ђ Validation в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function validateFields() {
 const key = document.getElementById('apiKey')?.value.trim();
 const base = document.getElementById('baseUrl')?.value.trim();
 const model = document.getElementById('modelInput')?.value.trim();
 const prof = PROFILES[activeProfileId];
 // Local providers (Ollama, LM Studio, Jan) don't require an API key
 if (!key && prof?.requiresKey !== false) { showResult('вљ пёЏ Р’РІРµРґРёС‚Рµ API Key', false); return false; }
 if (!base) { showResult('вљ пёЏ Р’РІРµРґРёС‚Рµ Base URL', false); return false; }
 if (!model) { showResult('вљ пёЏ Р’С‹Р±РµСЂРёС‚Рµ РјРѕРґРµР»СЊ', false); return false; }
 return true;
}

// в”Ђв”Ђ Model chips в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function populateChips(models) {
 const row = document.getElementById('modelChips');
 if (!row || !models.length) return;
 row.innerHTML = '';

 let inHighCensorship = false;

 models.forEach(m => {
 if (!inHighCensorship && (m.id.startsWith('openai') || m.id.startsWith('google') || m.id.startsWith('anthropic'))) {
 inHighCensorship = true;
 const sep = document.createElement('div');
 sep.style.cssText = 'width:100%; font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:.06em; padding:4px 2px 2px; flex-basis:100%;';
 sep.textContent = 'вЂ” РІС‹СЃРѕРєР°СЏ С†РµРЅР·СѓСЂР° вЂ”';
 row.appendChild(sep);
 }

 const chip = document.createElement('div');
 const cls = m.cls || (
 m.id.startsWith('qwen') ? 'qwen'
 : m.id.startsWith('google') ? 'gemini'
 : m.id.startsWith('openai') ? 'openai'
 : m.id.startsWith('mistralai') ? 'mistral'
 : m.id.startsWith('meta-llama') ? 'llama'
 : '');
 chip.className = `chip ${cls}`.trim();
 chip.dataset.model = m.id;
 chip.dataset.paid = m.free ? 'false' : 'true';

 const label = m.name || m.id.replace(/^[^/]+\\//, '');
 const tagHtml = m.tag === 'LOCAL'
 ? '<span class="chip-tag">LOCAL</span>'
 : m.tag
 ? `<span class="chip-tag">${escHtml(m.tag)}</span>`
 : `<span class="chip-tag">${m.free ? 'FREE' : '$'}</span>`;

 chip.innerHTML = `<span class="chip-label">${escHtml(label)}</span> ${tagHtml}`;
 chip.addEventListener('click', () => selectChip(chip));
 row.appendChild(chip);
 });

 const cur = document.getElementById('modelInput')?.value.trim();
 if (cur) syncChips(cur);
}

function initChips() {
 const prof = PROFILES[activeProfileId] || PROFILES.openrouter;
 populateChips(prof.models);
}

function selectChip(el) {
 document.querySelectorAll('#modelChips .chip').forEach(c => c.classList.remove('active'));
 el.classList.add('active');
 const modelId = el.dataset.model;
 document.getElementById('modelInput').value = modelId;

 if (el.dataset.paid === 'true') {
 showResult(`вљ пёЏ ${el.querySelector('.chip-label')?.textContent || modelId} вЂ” РїР»Р°С‚РЅР°СЏ РјРѕРґРµР»СЊ, РЅСѓР¶РµРЅ Р±Р°Р»Р°РЅСЃ Сѓ РїСЂРѕРІР°Р№РґРµСЂР°.`, false);
 } else {
 const el2 = document.getElementById('testResult');
 if (el2 && el2.textContent.startsWith('вљ ')) el2.style.display = 'none';
 }

 saveSettingsNow(); // auto-save on chip click
}

function syncChips(modelId) {
 document.querySelectorAll('#modelChips .chip').forEach(c => {
 c.classList.toggle('active', c.dataset.model === modelId);
 });
}

// в”Ђв”Ђ Reveal key в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
window.toggleReveal = function() {
 const inp = document.getElementById('apiKey');
 const btn = document.getElementById('revealBtn');
 if (!inp) return;
 if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'рџ™€'; }
 else { inp.type = 'password'; btn.textContent = 'рџ‘Ѓ'; }
};

// в”Ђв”Ђ Test API в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
window.testApi = async function() {
 if (!validateFields()) return;
 await saveSettingsNow();

 const btn = document.getElementById('testBtn');
 btn.innerHTML = ' Р—Р°РїСЂРѕСЃ Рє API...';
 btn.classList.add('loading');
 btn.disabled = true;

 chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, response => {
 btn.disabled = false;
 btn.classList.remove('loading');

 if (chrome.runtime.lastError) {
 showResult('вќЊ РћС€РёР±РєР° СЂР°СЃС€РёСЂРµРЅРёСЏ: ' + chrome.runtime.lastError.message, false);
 btn.innerHTML = 'рџ§Є РџСЂРѕРІРµСЂРёС‚СЊ СЃРѕРµРґРёРЅРµРЅРёРµ';
 return;
 }

 if (response?.success) {
 const total = response.total || 0;
 const vision = response.visionModels || [];
 showResult(
 `вњ… РџРѕРґРєР»СЋС‡РµРЅРѕ! Р’СЃРµРіРѕ РјРѕРґРµР»РµР№: ${total}. РЎ РїРѕРґРґРµСЂР¶РєРѕР№ РєР°СЂС‚РёРЅРѕРє: ${vision.length}.` +
 (vision.length ? `\\nР§РёРїСЃС‹ РѕР±РЅРѕРІР»РµРЅС‹ в†“` : ''),
 true
 );
 btn.innerHTML = 'вњ… РџРѕРґРєР»СЋС‡РµРЅРѕ!';
 btn.classList.add('success');
 setTimeout(() => {
 btn.innerHTML = 'рџ§Є РџСЂРѕРІРµСЂРёС‚СЊ СЃРѕРµРґРёРЅРµРЅРёРµ';
 btn.classList.remove('success');
 }, 4000);

 document.getElementById('statusDot')?.classList.add('connected');

 // в… Р–РёРІРѕР№ СЃРїРёСЃРѕРє vision-РјРѕРґРµР»РµР№ РІРјРµСЃС‚Рѕ РїСЂРµСЃРµС‚РѕРІ
 if (vision.length) {
 populateChips(vision);
 chrome.storage.local.set({ cachedVisionModels: vision });
 }

 } else {
 showResult('вќЊ ' + (response?.error || 'РќРµС‚ СЃРѕРµРґРёРЅРµРЅРёСЏ. РџСЂРѕРІРµСЂСЊС‚Рµ РєР»СЋС‡ Рё URL.'), false);
 btn.innerHTML = 'рџ§Є РџСЂРѕРІРµСЂРёС‚СЊ СЃРѕРµРґРёРЅРµРЅРёРµ';
 }
 });
};

function showResult(msg, isOk) {
 const el = document.getElementById('testResult');
 if (!el) return;
 el.className = 'test-result ' + (isOk ? 'ok' : 'err');
 el.style.display = 'block';
 el.textContent = msg;
}

// в”Ђв”Ђ Header в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function updateHeader() {
 const base = document.getElementById('baseUrl')?.value.trim() || '';
 const prov = providerName(base);
 const avatar = document.getElementById('userAvatar');
 const name = document.getElementById('userName');
 if (avatar) avatar.textContent = prov.slice(0, 2).toUpperCase();
 if (name) name.textContent = prov;
}

// в”Ђв”Ђ Mode toggle в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
window.selectMode = function(mode) {
 document.getElementById('pillBuiltin')?.classList.toggle('active', mode === 'builtin');
 document.getElementById('pillCustom')?.classList.toggle('active', mode === 'custom');
 const form = document.getElementById('apiForm');
 const hint = document.getElementById('builtinHint');
 if (mode === 'builtin') {
 if (form) form.style.display = 'none';
 if (hint) hint.style.display = 'block';
 } else {
 if (form) form.style.display = 'block';
 if (hint) hint.style.display = 'none';
 }
};

// в”Ђв”Ђ History в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// РџРµСЂРµСЃРѕР±СЂР°РЅРѕ С‡РµСЂРµР· DOM-API (Р±РµР· innerHTML-С€Р°Р±Р»РѕРЅР°): Р±РµР·РѕРїР°СЃРЅРѕ Рё Р±РµР· Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ РєР»Р°СЃСЃРѕРІ
window.showHistory = function() {
 const section = document.getElementById('historySection');
 const main = document.getElementById('mainSection');
 if (!section || !main) return;

 const isVisible = section.style.display === 'block';
 if (isVisible) {
 section.style.display = 'none';
 main.style.display = 'block';
 return;
 }

 main.style.display = 'none';
 section.style.display = 'block';

 const list = document.getElementById('historyList');
 if (!list) return;
 list.innerHTML = ' вЏі Р—Р°РіСЂСѓР·РєР°... ';

 chrome.storage.local.get({ history: [] }, ({ history }) => {
 if (!list) return;

 if (!history.length) {
 list.innerHTML = '';
 const empty = document.createElement('div');
 empty.style.cssText = 'text-align:center;padding:30px 10px;color:#64748b;font-size:12px;line-height:1.7;';
 empty.innerHTML = '<div style="font-size:28px;margin-bottom:8px;">рџ’­</div>РСЃС‚РѕСЂРёСЏ РїСѓСЃС‚Р°.<br>РќР°РІРµРґРё РЅР° РєР°СЂС‚РёРЅРєСѓ Рё РЅР°Р¶РјРё В«РџСЂРѕРјРїС‚В» вЂ” РѕРЅР° РїРѕСЏРІРёС‚СЃСЏ Р·РґРµСЃСЊ.<br><span style="font-size:10px;color:#475569;">Р”Р°РЅРЅС‹Рµ: chrome.storage.local</span>';
 list.appendChild(empty);
 return;
 }

 list.innerHTML = '';
 history.slice().reverse().slice(0, 30).forEach(item => {
 const row = document.createElement('div');
 row.style.cssText = 'display:flex;gap:10px;padding:10px;border-bottom:1px solid rgba(148,163,184,.12);align-items:flex-start;';

 const thumb = document.createElement('div');
 thumb.style.cssText = 'width:44px;height:44px;border-radius:8px;background:#1e2230;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;overflow:hidden;';
 if (item.thumb) {
 const im = document.createElement('img');
 im.src = item.thumb;
 im.style.cssText = 'width:100%;height:100%;object-fit:cover;';
 im.onerror = () => { thumb.textContent = 'рџ–ј'; };
 thumb.appendChild(im);
 } else {
 thumb.textContent = 'рџ–ј';
 }

 const col = document.createElement('div');
 col.style.cssText = 'min-width:0;flex:1;';

 const p = document.createElement('div');
 p.style.cssText = 'font-size:11px;color:#cbd5e1;line-height:1.5;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;';
 p.textContent = (item.prompt || '').slice(0, 130);

 const meta = document.createElement('div');
 meta.style.cssText = 'font-size:9.5px;color:#64748b;margin-top:4px;';
 meta.textContent = `${item.model || ''} В· ${formatDate(item.ts)}`;

 col.append(p, meta);
 row.append(thumb, col);
 list.appendChild(row);
 });
 });
};

window.backToSettings = function() {
 document.getElementById('historySection').style.display = 'none';
 document.getElementById('mainSection').style.display = 'block';
};

window.clearHistory = function() {
 if (!confirm('РћС‡РёСЃС‚РёС‚СЊ РІСЃСЋ РёСЃС‚РѕСЂРёСЋ?')) return;
 chrome.storage.local.set({ history: [] }, () => {
 document.getElementById('historyList').innerHTML =
 ' РСЃС‚РѕСЂРёСЏ РѕС‡РёС‰РµРЅР°. ';
 });
};

function escHtml(s) {
 return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function formatDate(ts) {
 if (!ts) return '';
 const d = new Date(ts);
 return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}

// в”Ђв”Ђ Utils в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
function flashBtn(id, newText, oldText, cls) {
 const btn = document.getElementById(id);
 if (!btn) return;
 btn.textContent = newText;
 btn.classList.add(cls);
 setTimeout(() => { btn.textContent = oldText; btn.classList.remove(cls); }, 2000);
}

// в”Ђв”Ђ Init в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
document.addEventListener('DOMContentLoaded', async () => {
 initChips(); // РјРіРЅРѕРІРµРЅРЅС‹Р№ С„РѕР»Р±СЌРє, РЅРёР¶Рµ Р·Р°РјРµРЅРёС‚СЃСЏ С‡РёРїР°РјРё Р°РєС‚РёРІРЅРѕРіРѕ РїСЂРѕС„РёР»СЏ

 document.getElementById('profileBtnOpenrouter')?.addEventListener('click', () => switchProfile('openrouter'));
 document.getElementById('profileBtnGroq')?.addEventListener('click', () => switchProfile('groq'));
 document.getElementById('profileBtnOllama')?.addEventListener('click', () => switchProfile('ollama'));
 document.getElementById('profileBtnLmstudio')?.addEventListener('click', () => switchProfile('lmstudio'));
 document.getElementById('profileBtnJan')?.addEventListener('click', () => switchProfile('jan'));
 document.getElementById('saveBtn')?.addEventListener('click', () => window.saveSettings());
 document.getElementById('resetBtn')?.addEventListener('click', () => window.resetToDefaults());
 document.getElementById('testBtn')?.addEventListener('click', () => window.testApi());
 document.getElementById('testIconBtn')?.addEventListener('click', () => window.testApi());
 document.getElementById('revealBtn')?.addEventListener('click', () => window.toggleReveal());
 document.getElementById('clearHistBtn')?.addEventListener('click',() => window.clearHistory());
 document.getElementById('backBtn')?.addEventListener('click', () => window.backToSettings());
 document.getElementById('sidePanelBtn')?.addEventListener('click',() => window.openSidePanel());
 document.getElementById('histBtn')?.addEventListener('click', () => window.showHistory());
 document.getElementById('donateBtn')?.addEventListener('click', () => {
 chrome.tabs.create({ url: 'https://yoomoney.ru/to/410013803949909' });
 });

 const settings = await loadSettings();
 const base = getBaseUrl(settings.apiUrl);

 document.getElementById('baseUrl').value = base;
 document.getElementById('apiKey').value = settings.apiKey;
 document.getElementById('modelInput').value = settings.model;

 document.querySelectorAll('.profile-btn').forEach(b => {
 b.classList.toggle('active', b.dataset.profile === activeProfileId);
 });

 // в… Р§РёРїС‹ Р°РєС‚РёРІРЅРѕРіРѕ РїСЂРѕС„РёР»СЏ (СЂР°РЅСЊС€Рµ РІСЃРµРіРґР° РѕСЃС‚Р°РІР°Р»РёСЃСЊ РїСЂРµСЃРµС‚С‹ OpenRouter)
 const activeProf = PROFILES[settings.profileId] || PROFILES.openrouter;
 populateChips(activeProf.models);
 syncChips(settings.model);
 updateHeader();

 if (settings.apiKey || activeProf.requiresKey === false) {
 document.getElementById('statusDot')?.classList.add('connected');
 }

 // РљСЌС€ Р¶РёРІС‹С… РјРѕРґРµР»РµР№ вЂ” С‚РѕР»СЊРєРѕ РґР»СЏ OpenRouter
 if (activeProfileId === 'openrouter') {
 chrome.storage.local.get({ cachedVisionModels: [] }, ({ cachedVisionModels }) => {
 if (cachedVisionModels.length) {
 populateChips(cachedVisionModels);
 }
 });
 }

 let saveTimer;
 ['baseUrl', 'apiKey'].forEach(id => {
 document.getElementById(id)?.addEventListener('input', () => {
 clearTimeout(saveTimer);
 saveTimer = setTimeout(() => {
 saveSettingsNow();
 updateHeader();
 }, 600);
 });
 });

 document.getElementById('modelInput')?.addEventListener('input', e => {
 syncChips(e.target.value.trim());
 clearTimeout(saveTimer);
 saveTimer = setTimeout(saveSettingsNow, 600);
 });
});