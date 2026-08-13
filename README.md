# 🔮 ImgPrompt AI

**Chrome/Firefox расширение для генерации промптов по картинке с помощью AI**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-v1.1-blue.svg)](https://github.com/rmaxvell/imgprompt-ai/releases/tag/v1.1)
[![Firefox Extension](https://img.shields.io/badge/Firefox-v1.1-orange.svg?logo=firefox)](https://github.com/rmaxvell/imgprompt-ai/releases/tag/v1.1-firefox)

---

## ✨ Что умеет

- 📸 **Анализирует любую картинку** на странице одним кликом
- ✨ **Генерирует промпт** + негатив + подробный разбор сцены
- 🌊 **Форматы:** Stable Diffusion / FLUX / Midjourney / NovelAI
- 🤖 **Vision-модели без цензуры:** Qwen2.5 VL 72B, NVIDIA Nemotron, Llama 4 и др.
- 🕒 **История промптов** в боковой панели с возможностью удаления
- 🌐 **OpenRouter** (300+ моделей) и **Groq** из коробки
- 🇷🇺 🇨🇳 🇬🇧 Три языка интерфейса

---

## 📸 Скриншоты

| Главное меню | Выбор модели |
|:---:|:---:|
| ![Главное меню](screenshots/2-models.png) | ![Настройки](screenshots/1-settings.png) |

| Контекстное меню | Результат анализа |
|:---:|:---:|
| ![Контекстное меню](screenshots/3-context-menu.png) | ![Промпт](screenshots/4-popup-result.png) |

| Панель истории |
|:---:|
| ![История](screenshots/5-history-panel.png) |

## 🚀 Установка Chrome / Edge / Brave

> Chrome Web Store пока не поддерживается — устанавливается вручную за 30 секунд.

1. Скачай ZIP → **[Releases → v1.1](https://github.com/rmaxvell/imgprompt-ai/releases/tag/v1.1)**
2. Распакуй в любую папку
3. Открой Chrome → `chrome://extensions/`
4. Включи **Режим разработчика** (правый верхний угол)
5. Нажми **Загрузить распакованное расширение** → выбери папку
6. Готово! Иконка появится в панели браузера

---

## 🦊 Установка Firefox

> **[📦 Скачать Firefox версию (v1.1)](https://github.com/rmaxvell/imgprompt-ai/releases/tag/v1.1-firefox)**

1. Скачай `imgprompt-firefox-v1.1.zip` и распакуй в любую папку
2. Открой `about:debugging` → **Этот Firefox** → **Загрузить временное дополнение**
3. Выбери файл `manifest.json`
4. Готово!

> ⚠️ Расширение нужно перезагружать при каждом запуске Firefox.
> Для постоянной работы используй **Firefox Developer Edition**.

---

## 🌐 Совместимые браузеры

| Браузер | Поддержка |
|---|---|
| Google Chrome | ✅ Полная |
| Microsoft Edge | ✅ Полная |
| Brave | ✅ Полная |
| Opera / Opera GX | ✅ Полная |
| Vivaldi | ✅ Полная |
| Cent Browser | ✅ Полная |
| Firefox | ✅ [Firefox Edition](https://github.com/rmaxvell/imgprompt-ai/releases/tag/v1.1-firefox) |

---


1. Нажми на иконку расширения
2. Получи бесплатный ключ на [openrouter.ai](https://openrouter.ai) (есть полностью бесплатные модели)
3. Вставь ключ в поле **API Key** → **Сохранить**
4. Выбери модель из списка

---

## 🎯 Как пользоваться

1. Наведи мышь на любую картинку в браузере
2. Нажми кнопку **🔮 Prompt** которая появится поверх картинки
3. Готово — промпт появится во всплывающем окне и сохранится в истории
4. Нажми **📋 Промпт** чтобы скопировать или **📄 Всё** для полного анализа

---

## 🤖 Рекомендуемые модели

| Модель | Цензура | Цена | Статус |
|---|---|---|---|
| `google/gemma-4-31b-it` | 🟡 Средняя | FREE | ⭐ **По умолчанию** |
| `qwen/qwen2.5-vl-72b-instruct:free` | 🟡 Средняя | FREE | ✅ Стабильная |
| `meta-llama/llama-4-scout` | 🟢 Низкая | $ | ✅ Стабильная |
| `qwen/qwen3-vl-32b-instruct` | 🟡 Средняя | $ | ✅ Стабильная |
| `nvidia/llama-3.1-nemotron-nano-vl-8b-v1:free` | 🟢 Низкая | FREE | ⚠️ Нестабильная |

> Модель по умолчанию можно сменить в любой момент — просто нажми на чип или введи ID вручную.

---

## 📦 Структура проекта

```
imgprompt-ai/
├── manifest.json       # Конфигурация расширения
├── popup.html/js       # Главный интерфейс
├── sidepanel.html/js   # Боковая панель с историей
├── background.js       # Service worker (API запросы)
├── content.js          # Инъекция в страницы
├── prompts.js          # Системные промпты (RU/EN/ZH)
└── icons/              # Иконки расширения
```

---

## 🔐 Безопасность API ключа

**Вопрос:** куда сохраняется API ключ? Не утечёт ли он?

**Ответ:** ключ хранится **только локально** в зашифрованном хранилище браузера (`chrome.storage.sync`). Расширение не имеет своего сервера — запросы идут **напрямую** с твоего компьютера на OpenRouter/Groq. Никто кроме тебя ключ не видит.

---

## ☕ Поддержать автора

Если расширение оказалось полезным:

**[☕ Отправить на кофе через ЮMoney](https://yoomoney.ru/to/410013803949909)**

---

## 📄 Лицензия

MIT — используй, модифицируй, распространяй свободно.
