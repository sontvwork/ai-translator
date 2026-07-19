import { test, expect } from '../helpers/extension-fixtures.js';
import { mockProvider } from '../helpers/provider-mock.js';
import { seedSettings, readLocal } from '../helpers/storage.js';

async function typeInPopup(openPopup, text = 'Hello') {
  const popup = await openPopup();
  await popup.fill('#input-text', text);
  return popup;
}

test('TC-ERR-001 missing API key shows setup message and sends no request @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge, { groqApiKeys: [] });
  const requests = await mockProvider(extContext, [{ text: 'never used' }]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue(/Chưa cài đặt API Key/);
  expect(requests).toHaveLength(0);
});

test('TC-ERR-002 invalid key (401) reports the key number @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ status: 401, message: 'Invalid API Key' }]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue(/API Key không hợp lệ/);
  await expect(popup.locator('#output-text')).toHaveValue(/Key số 1/);
});

test('TC-ERR-003 per-minute rate limit (429) shows wait time and quota link @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [
    { status: 429, message: 'Rate limit reached', headers: { 'retry-after': '30' } }
  ]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue(/Quá giới hạn theo phút/);
  await expect(popup.locator('#output-text')).toHaveValue(/30 giây/);
  await expect(popup.locator('#check-quota-link')).toBeVisible();
  await expect(popup.locator('#check-quota-link')).toHaveAttribute('href', 'https://console.groq.com/settings/limits');
});

test('TC-ERR-009 rate-limited key rotates to the next key within one translation @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge, { groqApiKeys: ['gsk_key_1', 'gsk_key_2'] });
  const requests = await mockProvider(extContext, [
    { status: 429, message: 'Rate limit reached', headers: { 'retry-after': '60' } },
    { text: 'Dịch bằng key 2' }
  ]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue('Dịch bằng key 2');
  expect(requests).toHaveLength(2);
  expect(requests[0].authorization).toBe('Bearer gsk_key_1');
  expect(requests[1].authorization).toBe('Bearer gsk_key_2');

  const { keyRotation } = await readLocal(bridge, 'keyRotation');
  expect(keyRotation.groq.disabledUntil['0']).toBeGreaterThan(Date.now());
});

test('TC-ERR-004 rate limit with a long wait reports daily quota exhaustion', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  // Scope 'day' is derived from the wait time (> 1h), not from the message text.
  await mockProvider(extContext, [
    { status: 429, message: 'Rate limit reached', headers: { 'retry-after': '86400' } }
  ]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue(/Đã hết hạn mức trong ngày/);
});

test('TC-ERR-005 openrouter 402 reports missing credits', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge, { provider: 'openrouter', openRouterApiKeys: ['sk_or_key'] });
  await mockProvider(extContext, [{ status: 402, message: 'Insufficient credits' }]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue(/hết credits/);
});

test('TC-ERR-006 404 reports an invalid model', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ status: 404, message: 'model not found' }]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue(/Model không hợp lệ/);
});

test('TC-ERR-007 server errors are retried until success', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  const requests = await mockProvider(extContext, [
    { status: 500, message: 'Internal error' },
    { status: 500, message: 'Internal error' },
    { text: 'Cuối cùng cũng xong' }
  ]);

  const popup = await typeInPopup(openPopup);

  // Retries fire 1s apart (retryCount 0 -> 1 -> 2).
  await expect(popup.locator('#output-text')).toHaveValue('Cuối cùng cũng xong');
  expect(requests).toHaveLength(3);
});

test('TC-ERR-008 giving up after two retries reports a busy server', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  const requests = await mockProvider(extContext, [{ status: 500, message: 'Internal error' }]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue(/Máy chủ Groq hiện đang bận! Vui lòng thử lại sau/);
  expect(requests).toHaveLength(3);
});

test('TC-ERR-010 all keys rate-limited reports the wait time', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge, { groqApiKeys: ['gsk_key_1', 'gsk_key_2'] });
  const requests = await mockProvider(extContext, [
    { status: 429, message: 'Rate limit reached', headers: { 'retry-after': '60' } }
  ]);

  const popup = await typeInPopup(openPopup);

  await expect(popup.locator('#output-text')).toHaveValue(/Tất cả API Key/);
  await expect(popup.locator('#output-text')).toHaveValue(/giây/);
  expect(requests).toHaveLength(2);
});

test('TC-ERR-011 successful translations round-robin between keys', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge, { groqApiKeys: ['gsk_key_1', 'gsk_key_2'] });
  const requests = await mockProvider(extContext, [{ text: 'Một' }, { text: 'Hai' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'First text');
  await expect(popup.locator('#output-text')).toHaveValue('Một');

  await popup.fill('#input-text', 'Second text');
  await expect(popup.locator('#output-text')).toHaveValue('Hai');

  expect(requests).toHaveLength(2);
  expect(requests[0].authorization).toBe('Bearer gsk_key_1');
  expect(requests[1].authorization).toBe('Bearer gsk_key_2');
});
