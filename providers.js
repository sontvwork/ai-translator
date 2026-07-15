export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash-lite";
export const MAX_API_KEYS = 5;

const PROVIDERS = {
  groq: { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions' },
  openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1/chat/completions' }
};

// Unified error codes so the popup shows the same messages for both providers:
// API_KEY_MISSING, API_KEY_INVALID, RATE_LIMIT, MODEL_INVALID, NO_CREDITS, SERVER_ERROR
export class TranslateError extends Error {
  constructor(code, { keyIndex, retryAfterMs, scope, message } = {}) {
    super(message || code);
    this.code = code;
    this.keyIndex = keyIndex;
    this.retryAfterMs = retryAfterMs;
    this.scope = scope; // 'minute' | 'day' for RATE_LIMIT
  }
}

export async function loadProviderSettings() {
  const result = await chrome.storage.sync.get({
    provider: 'groq',
    groqApiKeys: [],
    groqModel: DEFAULT_GROQ_MODEL,
    openRouterApiKeys: [],
    openRouterModel: DEFAULT_OPENROUTER_MODEL,
    // legacy keys (pre-3.2), migrated below
    apiKey: '',
    geminiApiKey: '',
    openRouterApiKey: ''
  });

  if (result.provider === 'gemini') {
    result.provider = 'groq';
    await chrome.storage.sync.set({ provider: 'groq' });
  }
  if (result.openRouterApiKey && result.openRouterApiKeys.length === 0) {
    result.openRouterApiKeys = [result.openRouterApiKey.trim()];
    await chrome.storage.sync.set({ openRouterApiKeys: result.openRouterApiKeys });
  }
  await chrome.storage.sync.remove(['apiKey', 'geminiApiKey', 'openRouterApiKey']);

  return {
    provider: result.provider,
    groqApiKeys: result.groqApiKeys.map(key => key.trim()).filter(Boolean),
    groqModel: result.groqModel.trim() || DEFAULT_GROQ_MODEL,
    openRouterApiKeys: result.openRouterApiKeys.map(key => key.trim()).filter(Boolean),
    openRouterModel: result.openRouterModel.trim() || DEFAULT_OPENROUTER_MODEL
  };
}

export function getProviderName(provider) {
  return PROVIDERS[provider] ? PROVIDERS[provider].name : provider;
}

export function getApiKeys(settings) {
  return settings.provider === 'openrouter' ? settings.openRouterApiKeys : settings.groqApiKeys;
}

export async function translate(prompt, settings, onDelta) {
  const provider = PROVIDERS[settings.provider] ? settings.provider : 'groq';
  const { baseUrl } = PROVIDERS[provider];
  const model = provider === 'openrouter' ? settings.openRouterModel : settings.groqModel;
  const keys = getApiKeys(settings);

  if (keys.length === 0) {
    throw new TranslateError('API_KEY_MISSING');
  }

  const rotation = await loadRotationState(provider);
  const streamState = { deltaReceived: false };
  let attemptsLeft = keys.length;

  while (attemptsLeft-- > 0) {
    const keyIndex = pickNextAvailableKey(keys, rotation);
    if (keyIndex === -1) break;

    try {
      const text = await streamChatCompletion({
        baseUrl,
        apiKey: keys[keyIndex],
        model,
        prompt,
        onDelta: (fullText) => {
          streamState.deltaReceived = true;
          if (onDelta) onDelta(fullText);
        }
      });

      rotation.nextIndex = (keyIndex + 1) % keys.length;
      await saveRotationState(provider, rotation);
      return text;
    } catch (error) {
      await disableKeyOrRethrow({ error, provider, keys, keyIndex, rotation, streamState });
    }
  }

  throw buildAllKeysLimitedError(keys, rotation);
}

// Rate-limited before any token was streamed: disable the key and let the
// caller rotate to the next one. Any other error (or a mid-stream rate limit,
// which would duplicate partial output on retry) is rethrown.
async function disableKeyOrRethrow({ error, provider, keys, keyIndex, rotation, streamState }) {
  if (!(error instanceof TranslateError)) {
    throw error;
  }
  if (error.code === 'API_KEY_INVALID') {
    error.keyIndex = keyIndex;
    throw error;
  }
  if (error.code !== 'RATE_LIMIT' || streamState.deltaReceived) {
    throw error;
  }

  rotation.disabledUntil[keyIndex] = Date.now() + error.retryAfterMs;
  rotation.nextIndex = (keyIndex + 1) % keys.length;
  await saveRotationState(provider, rotation);
}

async function loadRotationState(provider) {
  const { keyRotation } = await chrome.storage.local.get({ keyRotation: {} });
  const state = keyRotation[provider] || {};
  return {
    nextIndex: state.nextIndex || 0,
    disabledUntil: state.disabledUntil || {}
  };
}

async function saveRotationState(provider, rotation) {
  const { keyRotation } = await chrome.storage.local.get({ keyRotation: {} });
  keyRotation[provider] = rotation;
  await chrome.storage.local.set({ keyRotation });
}

function pickNextAvailableKey(keys, rotation) {
  const now = Date.now();
  for (let offset = 0; offset < keys.length; offset++) {
    const index = (rotation.nextIndex + offset) % keys.length;
    if (!rotation.disabledUntil[index] || rotation.disabledUntil[index] <= now) {
      delete rotation.disabledUntil[index];
      return index;
    }
  }
  return -1;
}

function buildAllKeysLimitedError(keys, rotation) {
  const now = Date.now();
  const pendingTimes = Object.values(rotation.disabledUntil).filter(until => until > now);
  const earliest = pendingTimes.length > 0 ? Math.min(...pendingTimes) : now + 60 * 1000;
  const retryAfterMs = earliest - now;
  return new TranslateError('RATE_LIMIT', {
    retryAfterMs,
    scope: retryAfterMs > 60 * 60 * 1000 ? 'day' : 'minute'
  });
}

async function streamChatCompletion({ baseUrl, apiKey, model, prompt, onDelta }) {
  let response;
  try {
    response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        stream: true
      })
    });
  } catch (error) {
    throw new TranslateError('SERVER_ERROR', { message: error.message });
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return readSseStream(response.body, onDelta);
}

async function readSseStream(body, onDelta) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const state = { fullText: '', done: false };

  while (!state.done) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line for the next chunk

    for (const line of lines) {
      consumeSseLine(line.trim(), state, onDelta);
      if (state.done) break;
    }
  }

  if (!state.fullText.trim()) {
    throw new TranslateError('SERVER_ERROR', { message: 'Empty response' });
  }
  return state.fullText.trim();
}

function consumeSseLine(line, state, onDelta) {
  // Skip empty lines and SSE comments (OpenRouter sends ": OPENROUTER PROCESSING" keep-alives)
  if (!line || line.startsWith(':') || !line.startsWith('data:')) return;

  const data = line.slice(5).trim();
  if (data === '[DONE]') {
    state.done = true;
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    return;
  }

  // Providers can report errors as an SSE event mid-stream
  if (parsed.error) {
    throw new TranslateError('SERVER_ERROR', { message: parsed.error.message || 'Stream error' });
  }

  const delta = parsed.choices?.[0]?.delta?.content;
  if (delta) {
    state.fullText += delta;
    onDelta(state.fullText);
  }
}

async function parseApiError(response) {
  const bodyText = await response.text().catch(() => '');
  let message = bodyText;
  try {
    message = JSON.parse(bodyText).error?.message || bodyText;
  } catch {
    // keep raw body
  }

  const status = response.status;

  if (status === 401 || status === 403) {
    return new TranslateError('API_KEY_INVALID', { message });
  }
  if (status === 402) {
    return new TranslateError('NO_CREDITS', { message });
  }
  if (status === 429) {
    return parseRateLimitError(response, message);
  }
  if (status === 400 || status === 404) {
    return new TranslateError('MODEL_INVALID', { message });
  }
  return new TranslateError('SERVER_ERROR', { message: `${status} ${message}` });
}

function parseRateLimitError(response, message) {
  const scope = /per day|RPD|TPD|daily|free-models-per-day/i.test(message) ? 'day' : 'minute';

  let retryAfterMs = parseRetryAfterMs(response, message);
  if (!retryAfterMs) {
    retryAfterMs = scope === 'day' ? msUntilNextUtcMidnight() : 60 * 1000;
  }

  return new TranslateError('RATE_LIMIT', { retryAfterMs, scope, message });
}

function parseRetryAfterMs(response, message) {
  const headerSeconds = Number.parseFloat(response.headers.get('retry-after'));
  if (!Number.isNaN(headerSeconds) && headerSeconds > 0) {
    return headerSeconds * 1000;
  }

  // Groq embeds "Please try again in 2m59.56s" / "in 6.4s" in the message
  const match = message.match(/try again in\s+(?:(\d+)h)?(?:(\d+)m)?([\d.]+)?s?/i);
  if (match && (match[1] || match[2] || match[3])) {
    const hours = Number.parseInt(match[1] || '0', 10);
    const minutes = Number.parseInt(match[2] || '0', 10);
    const seconds = Number.parseFloat(match[3] || '0');
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  return null;
}

function msUntilNextUtcMidnight() {
  const now = new Date();
  const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return nextMidnight - now.getTime();
}
