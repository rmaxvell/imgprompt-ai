# ImgPrompt AI — Browser Extension for Image-to-Prompt Generation

**ImgPrompt AI** is a browser extension that analyzes any image or video frame on the web and generates a detailed text prompt suitable for AI image generators like Midjourney, Stable Diffusion, DALL-E, and Flux.

> Hover over any image → click one button → get a ready-to-use prompt.

---

## Key Features

| Feature | Description |
|---|---|
| One-click analysis | Hover over any image and click the overlay button to generate a prompt instantly |
| Video frame capture | Analyze any frame from HTML5 video players (YouTube, Vimeo, etc.) |
| Context menu | Right-click any image → "Analyze with ImgPrompt AI" |
| Side panel history | All generated prompts are saved and searchable in the browser side panel |
| Multiple providers | OpenRouter, Groq, Ollama, LM Studio, Jan — cloud or fully local |
| Local AI support | Works with local vision models via OpenAI-compatible API (no internet required) |
| Image compression | Automatic resizing before sending to save bandwidth and memory |
| Request timeouts | Configurable timeouts with cancel button for slow local models |
| Multilingual prompts | Generate prompts in English, Russian, or Chinese |
| Custom system prompt | Override the default analysis instructions with your own |
| Privacy-first | No backend server; API keys stored locally in encrypted browser storage |

---

## Screenshots

| Overlay Button | Context Menu | Generated Prompt |
|:---:|:---:|:---:|
| ![Overlay](screenshots/1-overlay-button.png) | ![Context Menu](screenshots/3-context-menu.png) | ![Prompt](screenshots/4-popup-result.png) |

| History Panel |
|:---:|
| ![History](screenshots/5-history-panel.png) |

---

## Installation

### Chrome / Edge / Brave / Opera / Vivaldi

1. Download the latest ZIP from **[Releases](https://github.com/rmaxvell/imgprompt-ai/releases)**
2. Unzip to any folder
3. Open `chrome://extensions/` (or the equivalent in your browser)
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** → select the unzipped folder
6. Done! The icon will appear in your browser toolbar

### Firefox

1. Download the Firefox version from **[Releases](https://github.com/rmaxvell/imgprompt-ai/releases)**
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**
3. Select the `manifest.json` file
4. Done!

> Note: Temporary add-ons need to be reloaded on each Firefox restart. For persistent use, try Firefox Developer Edition.

---

## Supported Browsers

| Browser | Support |
|---|---|
| Google Chrome | Full |
| Microsoft Edge | Full |
| Brave | Full |
| Opera / Opera GX | Full |
| Vivaldi | Full |
| Firefox | Full (separate build) |

---

## Quick Start

1. Click the extension icon in your toolbar
2. Get a free API key at [openrouter.ai](https://openrouter.ai) (free models available)
3. Paste the key into the **API Key** field → click **Save**
4. Select a vision model from the list
5. Hover over any image on any webpage → click the **Prompt** button

---

## Supported AI Providers

### Cloud Providers

| Provider | Setup |
|---|---|
| **OpenRouter** | Free account at [openrouter.ai](https://openrouter.ai), supports 100+ models including free ones |
| **Groq** | Free account at [groq.com](https://groq.com), fast inference |

### Local Providers (fully offline, no API key needed)

| Provider | Default URL | Notes |
|---|---|---|
| **Ollama** | `http://localhost:11434/v1` | Free, open-source. Set `OLLAMA_ORIGINS=chrome-extension://*` for CORS |
| **LM Studio** | `http://localhost:1234/v1` | GUI-based, easy model management |
| **Jan** | `http://localhost:1337/v1` | Desktop app with built-in model library |

> For local providers, you need a **vision-language model** (VLM) — a regular text model cannot analyze images.

---

## Recommended Models

| Model | Censorship | Price | Notes |
|---|---|---|---|
| `google/gemma-4-31b-it` | Medium | FREE | Default model |
| `qwen/qwen2.5-vl-72b-instruct:free` | Medium | FREE | Stable, high quality |
| `meta-llama/llama-4-scout` | Low | Paid | Good for uncensored prompts |
| `qwen/qwen3-vl-32b-instruct` | Medium | Paid | Stable |
| `nvidia/llama-3.1-nemotron-nano-vl-8b-v1:free` | Low | FREE | Lightweight but unstable |

### For Local Use (small VLMs)

| Model | Size | RAM Required |
|---|---|---|
| `qwen2-vl-2b-instruct` | ~2 GB | 8 GB minimum |
| `llava-v1.6-mistral-7b` | ~5 GB | 16 GB recommended |
| `qwen2.5-vl-7b-instruct` | ~5 GB | 16 GB recommended |

---

## Configuration

Open the **Options** page (right-click extension icon → Options) to configure:

- **API Provider** — choose cloud or local
- **Model** — select from auto-detected list or enter manually
- **System Prompt** — customize the analysis instructions
- **Image Compression** — max size (default: 1024px) and JPEG quality (default: 0.85)
- **Request Timeout** — seconds to wait before aborting (0 = auto: 120s local, 60s cloud)
- **Language** — prompt output language (EN/RU/ZH)

---

## Project Structure

```
imgprompt-ai/
├── manifest.json       # Extension configuration (Manifest V3)
├── popup.html/js       # Main popup interface
├── options.html/js     # Settings page
├── sidepanel.html/js   # Side panel with history
├── background.js       # Service worker (API requests, image processing)
├── content.js          # Content script (overlay, image detection, video capture)
├── prompts.js          # System prompts (RU/EN/ZH)
└── icons/              # Extension icons
```

---

## Privacy & Security

- **No backend server** — all requests go directly from your browser to the chosen API provider
- **API keys stored locally** — in the browser's encrypted `chrome.storage.sync`
- **No telemetry** — no data is collected or sent anywhere except the API you configure
- **Open source** — MIT license, inspect the code yourself

---

## Support the Author

If you find this extension useful:

**[Buy me a coffee via YooMoney](https://yoomoney.ru/to/410013803949909)**

---

## License

MIT — use, modify, and distribute freely.
