import { test, expect } from '../helpers/extension-fixtures.js';
import { readSync } from '../helpers/storage.js';

const groqKeyInputs = (settings) => settings.locator('#groq-key-list .api-key-row input');

test('TC-SET-001 fresh install shows groq defaults @smoke', async ({ openSettings }) => {
  const settings = await openSettings();

  await expect(settings.locator('input[name="provider"][value="groq"]')).toBeChecked();
  await expect(settings.locator('#provider-card-groq')).toHaveClass(/active/);
  await expect(settings.locator('#groq-settings')).toBeVisible();
  await expect(settings.locator('#openrouter-settings')).toBeHidden();
  await expect(settings.locator('#groq-key-list .api-key-row')).toHaveCount(1);
  await expect(settings.locator('#groq-key-list input')).toHaveValue('');
  await expect(settings.locator('#groq-key-count')).toHaveText('1/5');
  await expect(settings.locator('#translation-delay')).toHaveValue('500');
  await expect(settings.locator('#delay-value')).toHaveText('500');
  await expect(settings.locator('#in-page-translation')).toBeChecked();
});

test('TC-SET-002 switching provider toggles the settings blocks and active card @smoke', async ({ openSettings }) => {
  const settings = await openSettings();
  await expect(settings.locator('#groq-settings')).toBeVisible();

  await settings.locator('#provider-card-openrouter').click();

  await expect(settings.locator('input[name="provider"][value="openrouter"]')).toBeChecked();
  await expect(settings.locator('#groq-settings')).toBeHidden();
  await expect(settings.locator('#openrouter-settings')).toBeVisible();
  await expect(settings.locator('#provider-card-openrouter')).toHaveClass(/active/);
  await expect(settings.locator('#provider-card-groq')).not.toHaveClass(/active/);
});

test('TC-SET-003 add button disappears at the 5-key limit', async ({ openSettings }) => {
  const settings = await openSettings();
  await expect(settings.locator('#groq-key-list .api-key-row')).toHaveCount(1);

  for (let i = 0; i < 4; i++) {
    await settings.click('#add-groq-key');
  }

  await expect(settings.locator('#groq-key-list .api-key-row')).toHaveCount(5);
  await expect(settings.locator('#add-groq-key')).toBeHidden();
  await expect(settings.locator('#groq-key-count')).toHaveText('5/5');
});

test('TC-SET-004 removing rows renumbers them; removing the last leaves one empty row', async ({ openSettings }) => {
  const settings = await openSettings();
  await settings.click('#add-groq-key');
  await settings.click('#add-groq-key');
  await groqKeyInputs(settings).nth(0).fill('gsk_k1');
  await groqKeyInputs(settings).nth(1).fill('gsk_k2');
  await groqKeyInputs(settings).nth(2).fill('gsk_k3');

  await settings.locator('#groq-key-list .api-key-row').nth(1).locator('.remove-key-button').click();

  await expect(settings.locator('#groq-key-list .api-key-row')).toHaveCount(2);
  await expect(settings.locator('#groq-key-list .api-key-index').nth(0)).toHaveText('#1');
  await expect(settings.locator('#groq-key-list .api-key-index').nth(1)).toHaveText('#2');
  await expect(groqKeyInputs(settings).nth(0)).toHaveValue('gsk_k1');
  await expect(groqKeyInputs(settings).nth(1)).toHaveValue('gsk_k3');

  await settings.locator('#groq-key-list .api-key-row').nth(1).locator('.remove-key-button').click();
  await settings.locator('#groq-key-list .api-key-row').nth(0).locator('.remove-key-button').click();

  await expect(settings.locator('#groq-key-list .api-key-row')).toHaveCount(1);
  await expect(groqKeyInputs(settings).nth(0)).toHaveValue('');
});

test('TC-SET-005 eye button toggles key visibility', async ({ openSettings }) => {
  const settings = await openSettings();
  const input = groqKeyInputs(settings).first();
  const toggle = settings.locator('#groq-key-list .toggle-password').first();

  await input.fill('gsk_secret');
  await expect(input).toHaveAttribute('type', 'password');
  await expect(toggle).toHaveText('👁️');

  await toggle.click();
  await expect(input).toHaveAttribute('type', 'text');
  await expect(toggle).toHaveText('🙈');

  await toggle.click();
  await expect(input).toHaveAttribute('type', 'password');
  await expect(toggle).toHaveText('👁️');
});

test('TC-SET-006 moving the delay slider updates the displayed value', async ({ openSettings }) => {
  const settings = await openSettings();
  const slider = settings.locator('#translation-delay');
  await expect(slider).toHaveValue('500'); // wait for stored value to load

  await slider.focus();
  await slider.press('ArrowRight'); // 500 -> 600 (step 100)
  await slider.press('ArrowRight'); // 600 -> 700

  await expect(slider).toHaveValue('700');
  await expect(settings.locator('#delay-value')).toHaveText('700');
});

test('TC-SET-007 save shows success message and persists to chrome.storage.sync @smoke', async ({ bridge, openSettings }) => {
  const settings = await openSettings();
  await settings.fill('#groq-key-list input', 'gsk_saved_key');

  await settings.click('#save-settings');
  await expect(settings.locator('#success-message')).toHaveClass(/show/);

  const sync = await readSync(bridge);
  expect(sync.provider).toBe('groq');
  expect(sync.groqApiKeys).toEqual(['gsk_saved_key']);
  expect(sync.groqModel).toBe('openai/gpt-oss-120b');
  expect(sync.openRouterApiKeys).toEqual([]);
  expect(sync.translationDelay).toBe(500);
  expect(sync.inPageTranslationEnabled).toBe(true);
});

test('TC-SET-008 Ctrl+S saves like the save button', async ({ bridge, openSettings }) => {
  const settings = await openSettings();
  await settings.fill('#groq-key-list input', 'gsk_via_ctrl_s');

  await settings.keyboard.press('Control+s');

  await expect(settings.locator('#success-message')).toHaveClass(/show/);
  const sync = await readSync(bridge, ['groqApiKeys']);
  expect(sync.groqApiKeys).toEqual(['gsk_via_ctrl_s']);
});

test('TC-SET-009 saving trims keys, drops empty rows and falls back to the default model', async ({ bridge, openSettings }) => {
  const settings = await openSettings();
  await settings.click('#add-groq-key'); // second, left empty
  await groqKeyInputs(settings).nth(0).fill('  gsk_padded  ');
  await settings.fill('#groq-model', '');

  await settings.click('#save-settings');
  await expect(settings.locator('#success-message')).toHaveClass(/show/);

  const sync = await readSync(bridge, ['groqApiKeys', 'groqModel']);
  expect(sync.groqApiKeys).toEqual(['gsk_padded']);
  expect(sync.groqModel).toBe('openai/gpt-oss-120b');
});

test('TC-SET-010 legacy gemini/openRouterApiKey config is migrated on load', async ({ bridge, openSettings }) => {
  await bridge.evaluate((s) => chrome.storage.sync.set(s), {
    provider: 'gemini',
    openRouterApiKey: 'legacy_key'
  });

  await openSettings();

  await expect.poll(() => readSync(bridge, ['provider']).then((r) => r.provider)).toBe('groq');
  const sync = await readSync(bridge);
  expect(sync.openRouterApiKeys).toEqual(['legacy_key']);
  expect(sync.openRouterApiKey).toBeUndefined();
});
