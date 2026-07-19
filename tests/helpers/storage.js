// chrome.storage seed/read helpers, executed on the extension-origin bridge page.
export const TEST_GROQ_KEY = 'gsk_test_key_1';

// Seeds chrome.storage.sync with a working default config: groq provider,
// one API key, fast 300ms debounce. Override any field via `overrides`.
export async function seedSettings(bridge, overrides = {}) {
  const settings = {
    provider: 'groq',
    groqApiKeys: [TEST_GROQ_KEY],
    translationDelay: 300,
    ...overrides
  };
  await bridge.evaluate((s) => chrome.storage.sync.set(s), settings);
  return settings;
}

export function seedLocal(bridge, values) {
  return bridge.evaluate((v) => chrome.storage.local.set(v), values);
}

export function readLocal(bridge, keys = null) {
  return bridge.evaluate((k) => chrome.storage.local.get(k), keys);
}

export function readSync(bridge, keys = null) {
  return bridge.evaluate((k) => chrome.storage.sync.get(k), keys);
}
