---
name: verify
description: Launch and drive this Chrome extension end-to-end with Playwright to verify changes at the popup/settings surface.
---

# Verify AI Translator extension

## Launch

Branded Chrome 137+ dropped `--load-extension`; use Playwright's bundled Chromium, headed (extensions don't load in headless here):

```js
const context = await chromium.launchPersistentContext(tmpProfileDir, {
  headless: false,
  args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`]
});
```

Extension ID for an unpacked extension is derived from its absolute path (no service worker event fires reliably; compute instead):

```js
const extId = crypto.createHash('sha256').update(EXT_PATH).digest('hex').slice(0, 32)
  .replace(/./g, c => String.fromCharCode(97 + parseInt(c, 16)));
```

Pages: `chrome-extension://<id>/popup.html` and `chrome-extension://<id>/settings.html`.

## Drive

- Seed/read settings via `page.evaluate` with `chrome.storage.sync` / `chrome.storage.local` on an extension page.
- Mock provider APIs with `context.route('https://api.groq.com/**')` / `('https://openrouter.ai/**')` and `route.fulfill` (SSE body: `data: {...}\n\n` lines + `data: [DONE]\n\n`). For progressive-streaming observation, run a local `http.createServer` that writes SSE chunks with delays and rewrite the fetch URL via `addInitScript` (route.fulfill is buffered).
- Typing in `#input-text` triggers translation after a debounce (default 500ms).

## Gotchas

- A freshly opened popup restores the previous `inputText`/`outputText` from `chrome.storage.local` on load — clear storage **and** the textarea DOM values before asserting fresh output.
- `setOutput` persists to storage asynchronously after the stream resolves; wait ~500ms before reading `outputText` back.
- Key rotation state lives in `chrome.storage.local` under `keyRotation`.
