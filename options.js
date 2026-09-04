const DEFAULT_SETTINGS = {
 apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
 apiKey: '', // Enter your own API key
 model: 'qwen/qwen2.5-vl-72b-instruct',
 imageMaxSize: 1024,
 imageQuality: 0.85,
 requestTimeout: 0,
 language: 'ru',
 showOverlayBtns: true,
 systemPrompt: `You are an expert AI image analyst and prompt engineer. \nAnalyze the given image and provide:\n\n**📝 Description:** What is shown in this image (subject, scene, context)\n\n**🎨 Visual Style:** Art style, photography type, rendering technique\n\n**🌈 Colors & Mood:** Color palette, lighting, atmosphere, emotional tone\n\n**🖼 Composition:** Layout, perspective, depth, framing\n\n**✨ AI Prompt (ready to use):** A detailed, ready-to-use prompt for image generation that would recreate this image\n\n**🏷 Tags:** Comma-separated keywords for search/categorization\n\nBe precise and thorough. The prompt should work with Midjourney, DALL-E, Stable Diffusion.`
};

const PRESETS = {
 openai: 'https://api.openai.com/v1/chat/completions',
 ollama: 'http://localhost:11434/v1/chat/completions',
 lmstudio: 'http://localhost:1234/v1/chat/completions',
 jan: 'http://localhost:1337/v1/chat/completions',
 openrouter: 'https://openrouter.ai/api/v1/chat/completions',
 custom: ''
};

const SYSTEM_PROMPTS = {
 detailed: DEFAULT_SETTINGS.systemPrompt,
 short: `Analyze this image briefly:\n1. Subject: What is shown\n2. Style: Visual style/technique \n3. Prompt: Short generative AI prompt to recreate it\n4. Tags: 5-10 keywords`,
 midjourney: `Analyze this image and create a perfect Midjourney prompt.\nFormat: [subject description] :: [style] :: [technical details] --ar [ratio] --v 6\nInclude: lighting, colors, mood, artist references if applicable, camera settings if photo.`,
 sd: `Analyze this image and create an optimized Stable Diffusion prompt.\nPositive prompt: [detailed description with quality tags like masterpiece, best quality]\nNegative prompt: [what to avoid]\nSettings suggestions: steps, CFG scale, sampler recommendation`
};

let currentLang = 'ru';

// Работает и с полным chat/completions URL, и с базовым URL без суффикса
function modelsUrlFrom(chatUrl) {
 return String(chatUrl || '')
 .replace(/\/chat\/completions\/?$/i, '')
 .replace(/\/+$/, '') + '/models';
}

function showToast(message, type = 'success') {
 const toast = document.getElementById('toast');
 toast.className = `toast toast-${type} show`;
 toast.innerHTML = (type === 'success' ? '✅ ' : '❌ ') + message;
 setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function setPreset(name) {
 if (PRESETS[name]) {
 document.getElementById('apiUrl').value = PRESETS[name];
 } else {
 document.getElementById('apiUrl').value = '';
 document.getElementById('apiUrl').focus();
 }
}

function setLang(lang) {
 currentLang = lang;
 document.querySelectorAll('.toggle-option').forEach(btn => {
 btn.classList.toggle('active', btn.dataset.lang === lang);
 });
}

function setSystemPromptPreset(name) {
 document.getElementById('systemPrompt').value = SYSTEM_PROMPTS[name] || '';
}

function toggleApiKeyVisibility() {
 const input = document.getElementById('apiKey');
 const btn = document.getElementById('toggleKeyBtn');
 if (input.type === 'password') {
 input.type = 'text';
 btn.textContent = '🙈 Скрыть';
 } else {
 input.type = 'password';
 btn.textContent = '👁 Показать';
 }
}

async function testConnection() {
 const btn = document.getElementById('testBtn');
 const result = document.getElementById('testResult');
 const apiUrl = document.getElementById('apiUrl').value.trim();
 const apiKey = document.getElementById('apiKey').value.trim();

 const isLocal = /localhost|127\\.0\\.0\\.1/i.test(apiUrl);
 if (!apiUrl || (!apiKey && !isLocal)) {
 result.className = 'test-result error';
 result.textContent = '❌ Введите URL и API ключ (или используйте локальный провайдер)';
 return;
 }

 btn.innerHTML = ' Проверяем...';
 btn.disabled = true;

 try {
 const modelsUrl = modelsUrlFrom(apiUrl);
 const response = await fetch(modelsUrl, {
 headers: { 'Authorization': `Bearer ${apiKey}` }
 });

 if (response.ok) {
 const data = await response.json();
 const models = data.data?.map(m => m.id).slice(0, 5) || [];
 result.className = 'test-result success';
 result.innerHTML = `✅ Подключение успешно! Доступные модели: ${models.join(', ')}${data.data?.length > 5 ? '...' : ''}`;
 } else {
 throw new Error(`HTTP ${response.status}: ${await response.text()}`);
 }
 } catch (e) {
 result.className = 'test-result error';
 result.innerHTML = `❌ Ошибка: ${e.message}`;
 } finally {
 btn.innerHTML = '🧪 Проверить подключение';
 btn.disabled = false;
 }
}

async function loadModels() {
 const btn = document.getElementById('loadModelsBtn');
 const apiUrl = document.getElementById('apiUrl').value.trim();
 const apiKey = document.getElementById('apiKey').value.trim();

 const isLocalLM = /localhost|127\\.0\\.0\\.1/i.test(apiUrl);
 if (!apiUrl || (!apiKey && !isLocalLM)) {
 showToast('Введите URL и API ключ', 'error');
 return;
 }

 btn.textContent = '⏳';
 btn.disabled = true;

 try {
 const modelsUrl = modelsUrlFrom(apiUrl);
 const response = await fetch(modelsUrl, {
 headers: { 'Authorization': `Bearer ${apiKey}` }
 });

 if (response.ok) {
 const data = await response.json();
 const models = data.data?.map(m => m.id) || [];

 if (models.length > 0) {
 const modelInput = document.getElementById('model');
 // Убираем прошлый селект, новый НЕ исчезает сам — живёт до следующей загрузки списка
 document.getElementById('modelSelect')?.remove();

 const select = document.createElement('select');
 select.id = 'modelSelect';
 select.style.cssText = 'width:100%;background:#22222f;border:1px solid #2e2e40;border-radius:8px;color:#e2e8f0;padding:10px 14px;font-size:13px;margin-top:8px;';
 models.forEach(m => {
 const opt = document.createElement('option');
 opt.value = m;
 opt.textContent = m;
 if (m === modelInput.value) opt.selected = true;
 select.appendChild(opt);
 });
 select.onchange = () => { modelInput.value = select.value; };
 modelInput.parentNode.insertBefore(select, modelInput.nextSibling);
 showToast(`Загружено ${models.length} моделей`);
 }
 } else {
 throw new Error(`HTTP ${response.status}`);
 }
 } catch (e) {
 showToast('Ошибка загрузки: ' + e.message, 'error');
 } finally {
 btn.textContent = '📋 Загрузить';
 btn.disabled = false;
 }
}

async function saveSettings() {
 const btn = document.getElementById('saveBtn');
 btn.innerHTML = ' Сохраняем...';
 btn.disabled = true;

 const settings = {
 apiUrl: document.getElementById('apiUrl').value.trim(),
 apiKey: document.getElementById('apiKey').value.trim(),
 model: document.getElementById('model').value.trim(),
 language: currentLang,
 systemPrompt: document.getElementById('systemPrompt').value.trim(),
 showOverlayBtns: document.getElementById('showOverlayBtns').checked,
 imageMaxSize: Math.max(64, Number(document.getElementById('imageMaxSize').value) || DEFAULT_SETTINGS.imageMaxSize),
 imageQuality: Math.min(1, Math.max(0.1, Number(document.getElementById('imageQuality').value) || DEFAULT_SETTINGS.imageQuality)),
 requestTimeout: Math.max(0, Number(document.getElementById('requestTimeout').value) || DEFAULT_SETTINGS.requestTimeout)
 };

 // LOCAL, а не sync: ключ не должен уходить в аккаунт Google
 chrome.storage.local.set(settings, () => {
 btn.innerHTML = '💾 Сохранить настройки';
 btn.disabled = false;
 showToast('Настройки сохранены!');
 });
}

function resetToDefaults() {
 if (confirm('Сбросить все настройки до значений по умолчанию?')) {
 document.getElementById('apiUrl').value = DEFAULT_SETTINGS.apiUrl;
 document.getElementById('apiKey').value = '';
 document.getElementById('model').value = DEFAULT_SETTINGS.model;
 document.getElementById('systemPrompt').value = DEFAULT_SETTINGS.systemPrompt;
 document.getElementById('imageMaxSize').value = DEFAULT_SETTINGS.imageMaxSize;
 document.getElementById('imageQuality').value = DEFAULT_SETTINGS.imageQuality;
 document.getElementById('requestTimeout').value = DEFAULT_SETTINGS.requestTimeout;
 document.getElementById('showOverlayBtns').checked = DEFAULT_SETTINGS.showOverlayBtns;
 setLang('ru');
 showToast('Настройки сброшены');
 }
}

document.addEventListener('DOMContentLoaded', () => {
 chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
 document.getElementById('apiUrl').value = settings.apiUrl || '';
 document.getElementById('apiKey').value = settings.apiKey || '';
 document.getElementById('model').value = settings.model || '';
 document.getElementById('systemPrompt').value = settings.systemPrompt || DEFAULT_SETTINGS.systemPrompt;
 document.getElementById('imageMaxSize').value = settings.imageMaxSize ?? DEFAULT_SETTINGS.imageMaxSize;
 document.getElementById('imageQuality').value = settings.imageQuality ?? DEFAULT_SETTINGS.imageQuality;
 document.getElementById('requestTimeout').value = settings.requestTimeout ?? DEFAULT_SETTINGS.requestTimeout;
 document.getElementById('showOverlayBtns').checked = settings.showOverlayBtns ?? true;
 setLang(settings.language || 'ru');
 });

 document.querySelectorAll('[data-preset]').forEach(btn => {
 btn.addEventListener('click', () => setPreset(btn.dataset.preset));
 });

 document.getElementById('toggleKeyBtn').addEventListener('click', toggleApiKeyVisibility);
 document.getElementById('loadModelsBtn').addEventListener('click', loadModels);
 document.getElementById('testBtn').addEventListener('click', testConnection);

 document.querySelectorAll('.toggle-option[data-lang]').forEach(btn => {
 btn.addEventListener('click', () => setLang(btn.dataset.lang));
 });

 document.querySelectorAll('[data-prompt]').forEach(btn => {
 btn.addEventListener('click', () => setSystemPromptPreset(btn.dataset.prompt));
 });

 document.getElementById('resetBtn').addEventListener('click', resetToDefaults);
 document.getElementById('saveBtn').addEventListener('click', saveSettings);

 // Чекбокс оверлея сохраняется мгновенно — без нажатия «Сохранить»
 document.getElementById('showOverlayBtns').addEventListener('change', function() {
   chrome.storage.local.set({ showOverlayBtns: this.checked });
 });
});