import { test, expect } from '../helpers/extension-fixtures.js';
import { mockProvider } from '../helpers/provider-mock.js';
import { seedSettings, seedLocal, readLocal } from '../helpers/storage.js';

test('TC-POP-001 typing translates via mocked SSE with a single request @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  const requests = await mockProvider(extContext, [{ text: 'Xin chào' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hello');

  await expect(popup.locator('#output-text')).toHaveValue('Xin chào');
  expect(requests).toHaveLength(1);
});

test('TC-POP-003 changing target language retranslates with the new language in the prompt @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  const requests = await mockProvider(extContext, [{ text: 'Bản dịch 1' }, { text: 'Translation 2' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hello');
  await expect(popup.locator('#output-text')).toHaveValue('Bản dịch 1');

  await popup.selectOption('#target-lang', 'en');

  await expect(popup.locator('#output-text')).toHaveValue('Translation 2');
  expect(requests).toHaveLength(2);
  expect(requests[1].body.messages[0].content).toContain('tiếng Anh');
});

test('TC-POP-002 respects the configured translation delay', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge, { translationDelay: 800 });
  const requests = await mockProvider(extContext, [{ text: 'Chậm mà chắc' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hello');

  await popup.waitForTimeout(400); // halfway through the 800ms debounce
  expect(requests).toHaveLength(0);

  await expect(popup.locator('#output-text')).toHaveValue('Chậm mà chắc');
  expect(requests).toHaveLength(1);
});

test('TC-POP-004 changing tone retranslates with the tone instruction in the prompt', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  const requests = await mockProvider(extContext, [{ text: 'Bản dịch 1' }, { text: 'Bản dịch 2' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hello');
  await expect(popup.locator('#output-text')).toHaveValue('Bản dịch 1');

  await popup.selectOption('#tone-select', 'formal');

  await expect(popup.locator('#output-text')).toHaveValue('Bản dịch 2');
  expect(requests).toHaveLength(2);
  expect(requests[1].body.messages[0].content).toContain('formal, polite tone');
});

test('TC-POP-005 clearing the input empties the output without a new request', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  const requests = await mockProvider(extContext, [{ text: 'Xin chào' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hello');
  await expect(popup.locator('#output-text')).toHaveValue('Xin chào');

  await popup.fill('#input-text', '');

  await expect(popup.locator('#output-text')).toHaveValue('');
  await popup.waitForTimeout(500); // past the debounce window
  expect(requests).toHaveLength(1);
});

test('TC-POP-006 text over 8000 characters is rejected without a request', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  const requests = await mockProvider(extContext, [{ text: 'never used' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'a'.repeat(8001));

  await expect(popup.locator('#output-text')).toHaveValue(/Văn bản quá dài/);
  expect(requests).toHaveLength(0);
});

test('TC-POP-007 copy button copies the output and shows the copied label', async ({ bridge, extContext, openPopup }) => {
  await extContext.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seedSettings(bridge);
  await mockProvider(extContext, [{ text: 'Xin chào' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hello');
  await expect(popup.locator('#output-text')).toHaveValue('Xin chào');

  await popup.bringToFront(); // navigator.clipboard requires a focused document
  await popup.click('#copy-button');

  await expect(popup.locator('#copied-label')).toHaveClass(/show/);
  expect(await popup.evaluate(() => navigator.clipboard.readText())).toBe('Xin chào');
});

test('TC-POP-008 reopening the popup restores input and output @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ text: 'Xin chào' }]);

  let popup = await openPopup();
  await popup.fill('#input-text', 'Hello');
  await expect(popup.locator('#output-text')).toHaveValue('Xin chào');
  await popup.waitForTimeout(600); // output persists to storage asynchronously
  await popup.close();

  popup = await openPopup();
  await expect(popup.locator('#input-text')).toHaveValue('Hello');
  await expect(popup.locator('#output-text')).toHaveValue('Xin chào');
});

test('TC-POP-009 language and tone survive reopening the popup', async ({ openPopup }) => {
  let popup = await openPopup();
  await popup.selectOption('#target-lang', 'en');
  await popup.selectOption('#tone-select', 'formal');
  await popup.close();

  popup = await openPopup();
  await expect(popup.locator('#target-lang')).toHaveValue('en');
  await expect(popup.locator('#tone-select')).toHaveValue('formal');
});

test('TC-POP-010 settings button opens the settings page', async ({ extContext, openPopup }) => {
  const popup = await openPopup();

  const [settingsPage] = await Promise.all([
    extContext.waitForEvent('page'),
    popup.click('#settings-button')
  ]);

  await settingsPage.waitForLoadState();
  expect(settingsPage.url()).toContain('settings.html');
});

test('TC-POP-012 openrouter provider hits its endpoint with the seeded model and key', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge, {
    provider: 'openrouter',
    openRouterApiKeys: ['sk_or_test_key'],
    openRouterModel: 'custom/model-x'
  });
  const requests = await mockProvider(extContext, [{ text: 'Qua OpenRouter' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hello');

  await expect(popup.locator('#output-text')).toHaveValue('Qua OpenRouter');
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
  expect(requests[0].body.model).toBe('custom/model-x');
  expect(requests[0].authorization).toBe('Bearer sk_or_test_key');
});

test('TC-POP-011 in-page selection auto-fills, auto-translates and clears the flags @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  const requests = await mockProvider(extContext, [{ text: 'Văn bản đã dịch' }]);
  await seedLocal(bridge, { selectedText: 'Selected from page', fromInPageTranslation: true });

  const popup = await openPopup();

  await expect(popup.locator('#input-text')).toHaveValue('Selected from page');
  await expect(popup.locator('#output-text')).toHaveValue('Văn bản đã dịch');
  expect(requests).toHaveLength(1);

  const local = await readLocal(bridge, ['selectedText', 'fromInPageTranslation']);
  expect(local.selectedText).toBeUndefined();
  expect(local.fromInPageTranslation).toBeUndefined();
});
