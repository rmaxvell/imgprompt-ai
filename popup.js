// ── Profiles ─────────────────────────────────────────────────────
const PROFILES = {
  openrouter: {
    name:    'OpenRouter',
    icon:    '🌐',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'qwen/qwen2.5-vl-72b-instruct',
    models: [
      { id: 'qwen/qwen2.5-vl-72b-instruct',     name: 'Qwen2.5 VL 72B',  free: true,  tag: 'TOP',  cls: 'qwen'    },
      { id: 'qwen/qwen2.5-vl-7b-instruct',       name: 'Qwen2.5 VL 7B',   free: false, tag: '',     cls: 'qwen'    },
      { id: 'qwen/qwen2-vl-72b-instruct',        name: 'Qwen2 VL 72B',    free: false, tag: '',     cls: 'qwen'    },
      { id: 'mistralai/pixtral-12b',             name: 'Pixtral 12B',     free: false, tag: '',     cls: 'mistral' },
      { id: 'google/gemini-2.0-flash-exp:free',  name: 'Gemini Flash',    free: true,  tag: 'FREE', cls: 'gemini'  },
      { id: 'openai/gpt-4o-mini',                name: 'GPT-4o mini',     free: false, tag: '',     cls: 'openai'  },
      { id: 'openai/gpt-4o',                     name: 'GPT-4o',          free: false, tag: '',     cls: 'openai'  },
      { id: 'anthropic/claude-3.5-haiku',        name: 'Claude Haiku',    free: false, tag: '',     cls: 'openai'  },
    ]
  },
  groq: {
    name:    'Groq',
    icon:    '⚡',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.2-11b-vision-preview',
    models: [
      { id: 'llama-3.2-11b-vision-preview',       name: 'Llama 3.2 11B',        free: true, tag: 'BEST', cls: 'llama' },
      { id: 'llama-4-scout-17b-16e-instruct',     name: 'Llama 4 Scout 17B',    free: true, tag: 'NEW',  cls: 'llama' },
      { id: 'llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B', free: true, tag: 'NEW',  cls: 'llama' },
    ]
  },
  ollama: {
    name: 'Ollama',
    icon: '🦙',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llava',
    requiresKey: false,
    models: [
      { id: 'llava',        name: 'LLaVA',        free: true, tag: 'LOCAL', cls: 'llama' },
      { id: 'moondream',    name: 'Moondream',    free: true, tag: 'LOCAL', cls: 'llama' },
      { id: 'llava-llama3', name: 'LLaVA Llama3', free: true, tag: 'LOCAL', cls: 'llama' },
      { id: 'bakllava',     name: 'BakLLaVA',     free: true, tag: 'LOCAL', cls: 'llama' },
    ]
  },
  lmstudio: {
    name: 'LM Studio',
    icon: '🖥',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'llava',
    requiresKey: false,
    models: [
      { id: 'llava',      name: 'LLaVA',      free: true, tag: 'LOCAL', cls: 'llama' },
      { id: 'moondream2', name: 'Moondream2', free: true, tag: 'LOCAL', cls: 'llama' },
    ]
  },
  jan: {
    name: 'Jan',
    icon: '🤖',
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
  model:  'qwen/qwen2.5-vl-72b-instruct'
};

// active profile key ('openrouter' | 'groq')
let activeProfileId = 'openrouter';

// ── Helpers ──────────────────────────────────────────────────────
function getBaseUrl(chatUrl = '') {
  return chatUrl.replace(/\/chat\/completions$/i, '').replace(/\/$/, '');
}
function toChatUrl(base = '') {
  const b = base.replace(/\/$/, '');
  return /\/chat\/completions$/i.test(b) ? b : `${b}/chat/completions`;
}
function providerName(base = '') {
  if (base.includes('openrouter')) return 'OpenRouter';
  if (base.includes('openai'))     return 'OpenAI';
  if (base.includes('anthropic'))  return 'Anthropic';
  if (base.includes('groq'))       return 'Groq';
  if (base.includes('together'))   return 'Together';
  if (base.includes('11434'))      return 'Ollama';
  if (base.includes('1234'))       return 'LM Studio';
  if (base.includes('1337'))       return 'Jan';
  if (base.includes('localhost') || base.includes('127.0.0.1')) return 'Local';
  return base.replace(/^https?:\/\//, '').split('/')[0].split('.')[0] || 'API';
}

// ── Load settings ────────────────────────────────────────────────
function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(null, data => {
      activeProfileId = data.activeProfile || 'openrouter';
      const prof = PROFILES[activeProfileId] || PROFILES.openrouter;
      resolve({
        apiUrl:    data.apiUrl   || prof.baseUrl + '/chat/completions',
        apiKey:    data['key_' + activeProfileId] || data.apiKey || '',
        model:     data.model   || prof.defaultModel,
        profileId: activeProfileId
      });
    });
  });
}

// ── Save settings ────────────────────────────────────────────────
function saveSettingsNow() {
  const base  = document.getElementById('baseUrl')?.value.trim() || '';
  const key   = document.getElementById('apiKey')?.value.trim()  || '';
  const model = document.getElementById('modelInput')?.value.trim() || '';
  const save  = {
    apiUrl: toChatUrl(base),
    apiKey: key,
    model,
    activeProfile: activeProfileId
  };
  save['key_' + activeProfileId] = key; // store per-profile key
  return new Promise(resolve => chrome.storage.sync.set(save, resolve));
}

// ── Switch profile ────────────────────────────────────────────────
window.switchProfile = function(profileId) {
  if (!PROFILES[profileId]) return;
  activeProfileId = profileId;

  // Update profile buttons
  document.querySelectorAll('.profile-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.profile === profileId);
  });

  const prof = PROFILES[profileId];

  // Load stored key for this profile
  chrome.storage.sync.get(null, data => {
    const key   = data['key_' + profileId] || '';
    const model = (profileId === data.activeProfile ? data.model : null)
                  || prof.defaultModel;

    document.getElementById('baseUrl').value    = prof.baseUrl;
    document.getElementById('apiKey').value     = key;
    document.getElementById('modelInput').value = model;

    populateChips(prof.models);
    syncChips(model);
    updateHeader();

    // auto-save profile switch
    const save = { activeProfile: profileId, apiUrl: toChatUrl(prof.baseUrl), model };
    save['key_' + profileId] = key;
    chrome.storage.sync.set(save);
  });
};

window.saveSettings = async function() {
  if (!validateFields()) return;
  await saveSettingsNow();
  flashBtn('saveBtn', '✅ Сохранено!', '💾 Сохранить', 'saved');
  updateHeader();
};

// ── Reset ────────────────────────────────────────────────────────
window.resetToDefaults = function() {
  // Keep the API key — only reset URL and model
  const key = document.getElementById('apiKey')?.value.trim() || '';
  chrome.storage.sync.set({
    apiUrl: FACTORY_DEFAULTS.apiUrl,
    apiKey: key,
    model:  FACTORY_DEFAULTS.model
  }, () => {
    document.getElementById('baseUrl').value    = getBaseUrl(FACTORY_DEFAULTS.apiUrl);
    document.getElementById('modelInput').value = FACTORY_DEFAULTS.model;
    syncChips(FACTORY_DEFAULTS.model);
    flashBtn('resetBtn', '✅ Сброшено', '↺ Сброс', 'saved');
    updateHeader();
  });
};

// ── Open Side Panel ──────────────────────────────────────────────
window.openSidePanel = function() {
  // Get the active tab, then open side panel on it
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) return;
    chrome.sidePanel.open({ tabId: tabs[0].id })
      .then(() => window.close())  // close popup after opening panel
      .catch(e => console.warn('[ImgPrompt] sidePanel.open failed:', e));
  });
};

// ── Validation ───────────────────────────────────────────────────
function validateFields() {
  const key   = document.getElementById('apiKey')?.value.trim();
  const base  = document.getElementById('baseUrl')?.value.trim();
  const model = document.getElementById('modelInput')?.value.trim();
  const prof  = PROFILES[activeProfileId];
  // Local providers (Ollama, LM Studio, Jan) don't require an API key
  if (!key && prof?.requiresKey !== false) { showResult('⚠️ Введите API Key', false); return false; }
  if (!base)  { showResult('⚠️ Введите Base URL', false); return false; }
  if (!model) { showResult('⚠️ Выберите модель', false); return false; }
  return true;
}

// ── Model chips ──────────────────────────────────────────────────
function populateChips(models) {
  const row = document.getElementById('modelChips');
  if (!row || !models.length) return;
  row.innerHTML = '';

  let inHighCensorship = false;

  models.forEach(m => {
    // Insert separator before higher-censorship block
    if (!inHighCensorship && (m.id.startsWith('openai') || m.id.startsWith('google') || m.id.startsWith('anthropic'))) {
      inHighCensorship = true;
      const sep = document.createElement('div');
      sep.style.cssText = 'width:100%; font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:.06em; padding:4px 2px 2px; flex-basis:100%;';
      sep.textContent = '— высокая цензура —';
      row.appendChild(sep);
    }

    const chip = document.createElement('div');
    const cls  = m.cls || (
      m.id.startsWith('qwen')       ? 'qwen'
    : m.id.startsWith('google')     ? 'gemini'
    : m.id.startsWith('openai')     ? 'openai'
    : m.id.startsWith('mistralai')  ? 'mistral'
    : m.id.startsWith('meta-llama') ? 'llama'
    : '');
    chip.className   = `chip ${cls}`.trim();
    chip.dataset.model = m.id;
    chip.dataset.paid  = m.free ? 'false' : 'true';

    const label = m.name || m.id.replace(/^[^/]+\//, '');
    const tagHtml = m.tag === 'LOCAL'
      ? `<span class="badge" style="background:rgba(6,182,212,0.15);border-color:rgba(6,182,212,0.4);color:#67e8f9">LOCAL</span>`
      : m.tag
        ? `<span class="badge" style="background:rgba(16,185,129,0.2);border-color:rgba(16,185,129,0.4);color:#34d399">${m.tag}</span>`
        : `<span class="badge ${m.free ? '' : 'paid'}">${m.free ? 'FREE' : '$'}</span>`;

    chip.innerHTML = `<span class="chip-label">${label}</span>${tagHtml}`;
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

  // Warn about paid models
  if (el.dataset.paid === 'true') {
    showResult(`⚠️ ${el.querySelector('.chip-label')?.textContent || modelId} — платная модель, нужен баланс OpenRouter.`, false);
  } else {
    // Hide any previous warning
    const el2 = document.getElementById('testResult');
    if (el2 && el2.textContent.startsWith('⚠')) el2.style.display = 'none';
  }

  saveSettingsNow(); // auto-save on chip click
}

function syncChips(modelId) {
  document.querySelectorAll('#modelChips .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.model === modelId);
  });
}

// ── Reveal key ───────────────────────────────────────────────────
window.toggleReveal = function() {
  const inp = document.getElementById('apiKey');
  const btn = document.getElementById('revealBtn');
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = '🙈'; }
  else                         { inp.type = 'password'; btn.textContent = '👁'; }
};

// ── Test API ─────────────────────────────────────────────────────
window.testApi = async function() {
  if (!validateFields()) return;
  await saveSettingsNow();

  const btn = document.getElementById('testBtn');
  btn.innerHTML = '<span class="spinner"></span> Запрос к API...';
  btn.classList.add('loading');
  btn.disabled = true;

  chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, response => {
    btn.disabled = false;
    btn.classList.remove('loading');

    if (chrome.runtime.lastError) {
      showResult('❌ Ошибка расширения: ' + chrome.runtime.lastError.message, false);
      btn.innerHTML = '🧪 Проверить соединение';
      return;
    }

    if (response?.success) {
      const total  = response.total || 0;
      const vision = response.visionModels || [];
      showResult(
        `✅ Подключено! Всего моделей: ${total}. С поддержкой картинок: ${vision.length}.` +
        (vision.length ? `
Чипсы обновлены ↓` : ''),
        true
      );
      btn.innerHTML = '✅ Подключено!';
      btn.classList.add('success');
      setTimeout(() => {
        btn.innerHTML = '🧪 Проверить соединение';
        btn.classList.remove('success');
      }, 4000);

      // Update status dot
      document.getElementById('statusDot')?.classList.add('connected');

      // ★ Populate chips with REAL vision models from OpenRouter
      if (vision.length) {
        populateChips(vision);
        // Store for next popup open
        chrome.storage.local.set({ cachedVisionModels: vision });
      }

    } else {
      showResult('❌ ' + (response?.error || 'Нет соединения. Проверьте ключ и URL.'), false);
      btn.innerHTML = '🧪 Проверить соединение';
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

// ── Header ───────────────────────────────────────────────────────
function updateHeader() {
  const base = document.getElementById('baseUrl')?.value.trim() || '';
  const prov = providerName(base);
  const avatar = document.getElementById('userAvatar');
  const name   = document.getElementById('userName');
  if (avatar) avatar.textContent = prov.slice(0, 2).toUpperCase();
  if (name)   name.textContent   = prov;
}

// ── Mode toggle ──────────────────────────────────────────────────
window.selectMode = function(mode) {
  document.getElementById('pillBuiltin')?.classList.toggle('active', mode === 'builtin');
  document.getElementById('pillCustom')?.classList.toggle('active',  mode === 'custom');
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

// ── History ──────────────────────────────────────────────────────
window.showHistory = function() {
  const section = document.getElementById('historySection');
  const main    = document.getElementById('mainSection');
  if (!section || !main) return;

  // Toggle
  const isVisible = section.style.display === 'block';
  if (isVisible) {
    section.style.display = 'none';
    main.style.display    = 'block';
    return;
  }

  main.style.display    = 'none';
  section.style.display = 'block';

  const list = document.getElementById('historyList');
  if (list) list.innerHTML = '<div class="hist-empty">⏳ Загрузка...</div>';

  chrome.storage.local.get({ history: [] }, ({ history }) => {
    if (!list) return;
    console.log('[ImgPrompt] History entries:', history.length);

    if (!history.length) {
      list.innerHTML = `
        <div class="hist-empty">
          💭 История пуста.<br>
          Наведи на картинку и нажми «Промпт» — она появится здесь.<br>
          <span style="color:#475569;font-size:10px">Данные: chrome.storage.local</span>
        </div>`;
      return;
    }

    list.innerHTML = history.slice().reverse().slice(0, 30).map(item => `
      <div class="hist-item">
        ${item.thumb ? `<img class="hist-thumb" src="${escHtml(item.thumb)}" onerror="this.style.display='none'">` : '<div class="hist-thumb-ph">🖼</div>'}
        <div class="hist-text">
          <div class="hist-prompt">${escHtml((item.prompt || '').slice(0, 130))}</div>
          <div class="hist-meta">${escHtml(item.model || '')} · ${formatDate(item.ts)}</div>
        </div>
      </div>
    `).join('');
  });
};

window.backToSettings = function() {
  document.getElementById('historySection').style.display = 'none';
  document.getElementById('mainSection').style.display    = 'block';
};

window.clearHistory = function() {
  if (!confirm('Очистить всю историю?')) return;
  chrome.storage.local.set({ history: [] }, () => {
    document.getElementById('historyList').innerHTML =
      '<div class="hist-empty">История очищена.</div>';
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

// ── Utils ────────────────────────────────────────────────────────
function flashBtn(id, newText, oldText, cls) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.textContent = newText;
  btn.classList.add(cls);
  setTimeout(() => { btn.textContent = oldText; btn.classList.remove(cls); }, 2000);
}

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initChips(); // show fallback presets first

  // ── Button event listeners (CSP: no inline onclick allowed) ──
  document.getElementById('profileBtnOpenrouter')?.addEventListener('click', () => switchProfile('openrouter'));
  document.getElementById('profileBtnGroq')?.addEventListener('click',       () => switchProfile('groq'));
  document.getElementById('profileBtnOllama')?.addEventListener('click',     () => switchProfile('ollama'));
  document.getElementById('profileBtnLmstudio')?.addEventListener('click',   () => switchProfile('lmstudio'));
  document.getElementById('profileBtnJan')?.addEventListener('click',        () => switchProfile('jan'));
  document.getElementById('saveBtn')?.addEventListener('click',     () => window.saveSettings());
  document.getElementById('resetBtn')?.addEventListener('click',    () => window.resetToDefaults());
  document.getElementById('testBtn')?.addEventListener('click',     () => window.testApi());
  document.getElementById('testIconBtn')?.addEventListener('click', () => window.testApi());
  document.getElementById('revealBtn')?.addEventListener('click',   () => window.toggleReveal());
  document.getElementById('clearHistBtn')?.addEventListener('click',() => window.clearHistory());
  document.getElementById('backBtn')?.addEventListener('click',     () => window.backToSettings());
  document.getElementById('sidePanelBtn')?.addEventListener('click',() => window.openSidePanel());
  document.getElementById('histBtn')?.addEventListener('click',     () => window.showHistory());
  document.getElementById('donateBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://yoomoney.ru/to/410013803949909' });
  });

  const settings = await loadSettings();
  const base     = getBaseUrl(settings.apiUrl);

  document.getElementById('baseUrl').value    = base;
  document.getElementById('apiKey').value     = settings.apiKey;
  document.getElementById('modelInput').value = settings.model;

  // Sync profile buttons
  document.querySelectorAll('.profile-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.profile === activeProfileId);
  });

  syncChips(settings.model);
  updateHeader();

  // Status indicator — local providers don't need a key
  const activeProf = PROFILES[settings.profileId] || PROFILES.openrouter;
  if (settings.apiKey || activeProf.requiresKey === false) {
    document.getElementById('statusDot')?.classList.add('connected');
  }

  // Load cached vision models from last test (only for OpenRouter)
  if (activeProfileId === 'openrouter') {
    chrome.storage.local.get({ cachedVisionModels: [] }, ({ cachedVisionModels }) => {
      if (cachedVisionModels.length) {
        populateChips(cachedVisionModels);
      }
    });
  }

  // Auto-save URL/key on input (debounced)
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

  // Sync chips when user types model manually
  document.getElementById('modelInput')?.addEventListener('input', e => {
    syncChips(e.target.value.trim());
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSettingsNow, 600);
  });
});
