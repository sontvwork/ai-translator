import { test, expect } from '../helpers/extension-fixtures.js';
import { mockProvider } from '../helpers/provider-mock.js';
import { seedSettings, seedLocal, readLocal } from '../helpers/storage.js';

test('TC-HIS-001 successful translation is saved to history @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ text: 'Xin chào' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hello');
  await expect(popup.locator('#output-text')).toHaveValue('Xin chào');
  await popup.waitForTimeout(600); // history persists asynchronously

  const { translationHistory } = await readLocal(bridge, 'translationHistory');
  expect(translationHistory).toHaveLength(1);
  expect(translationHistory[0].source).toBe('Hello');
  expect(translationHistory[0].translated).toBe('Xin chào');
  expect(typeof translationHistory[0].timestamp).toBe('number');
});

test('TC-HIS-003 clicking a history item restores the pair without retranslating @smoke', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await seedLocal(bridge, {
    translationHistory: [{ source: 'Old text', translated: 'Bản dịch cũ', timestamp: Date.now() }]
  });
  const requests = await mockProvider(extContext, [{ text: 'must not be requested' }]);

  const popup = await openPopup();
  await popup.click('#history-button');
  await popup.click('.history-item');

  await expect(popup.locator('#input-text')).toHaveValue('Old text');
  await expect(popup.locator('#output-text')).toHaveValue('Bản dịch cũ');
  await popup.waitForTimeout(700); // longer than the 300ms debounce
  expect(requests).toHaveLength(0);
});

test('TC-HIS-002 popover lists newest first and shows an empty state', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ text: 'never used' }]);
  await seedLocal(bridge, {
    translationHistory: [
      { source: 'Newest', translated: 'Mới nhất', timestamp: Date.now() },
      { source: 'Oldest', translated: 'Cũ hơn', timestamp: Date.now() - 60_000 }
    ]
  });

  const popup = await openPopup();
  await popup.click('#history-button');

  await expect(popup.locator('.history-item')).toHaveCount(2);
  await expect(popup.locator('.history-item').nth(0).locator('.history-item-source')).toHaveText('Newest');
  await expect(popup.locator('.history-item').nth(1).locator('.history-item-source')).toHaveText('Oldest');

  await popup.click('#history-button'); // close
  await seedLocal(bridge, { translationHistory: [] });
  await popup.click('#history-button'); // reopen re-renders

  await expect(popup.locator('.history-empty')).toHaveText('Chưa có lịch sử dịch');
});

test('TC-HIS-004 clearing history needs a second confirming click and auto-resets', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ text: 'never used' }]);
  await seedLocal(bridge, {
    translationHistory: [{ source: 'Keep me', translated: 'Giữ lại', timestamp: Date.now() }]
  });

  const popup = await openPopup();
  await popup.click('#history-button');
  const clearButton = popup.locator('#history-clear-button');

  // First click only arms the confirmation…
  await clearButton.click();
  await expect(clearButton).toHaveText('Xác nhận?');

  // …and it disarms itself after ~3s without deleting anything.
  await expect(clearButton).toHaveText('Xóa hết', { timeout: 5000 });
  expect((await readLocal(bridge, 'translationHistory')).translationHistory).toHaveLength(1);

  // Two clicks in a row actually clear.
  await clearButton.click();
  await clearButton.click();
  await expect(popup.locator('.history-empty')).toBeVisible();
  expect((await readLocal(bridge, 'translationHistory')).translationHistory).toEqual([]);
});

test('TC-HIS-005 history keeps only the 5 most recent records', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ text: 'Bản dịch mới' }]);
  const now = Date.now();
  await seedLocal(bridge, {
    translationHistory: ['S1', 'S2', 'S3', 'S4', 'S5'].map((source, i) => (
      { source, translated: `T${i + 1}`, timestamp: now - i * 60_000 }
    ))
  });

  const popup = await openPopup();
  await popup.fill('#input-text', 'Fresh text');
  await expect(popup.locator('#output-text')).toHaveValue('Bản dịch mới');
  await popup.waitForTimeout(600);

  const { translationHistory } = await readLocal(bridge, 'translationHistory');
  expect(translationHistory).toHaveLength(5);
  expect(translationHistory[0].source).toBe('Fresh text');
  expect(translationHistory.map((r) => r.source)).not.toContain('S5'); // oldest dropped
});

test('TC-HIS-006 continued typing replaces the newest record instead of duplicating', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ text: 'Chào một' }, { text: 'Chào hai' }]);

  const popup = await openPopup();
  await popup.fill('#input-text', 'Hel');
  await expect(popup.locator('#output-text')).toHaveValue('Chào một');

  await popup.locator('#input-text').pressSequentially('lo');
  await expect(popup.locator('#output-text')).toHaveValue('Chào hai');
  await popup.waitForTimeout(600);

  const { translationHistory } = await readLocal(bridge, 'translationHistory');
  expect(translationHistory).toHaveLength(1);
  expect(translationHistory[0].source).toBe('Hello');
  expect(translationHistory[0].translated).toBe('Chào hai');
});

test('TC-HIS-007 retranslating an old source moves it to the top without duplicating', async ({ bridge, extContext, openPopup }) => {
  await seedSettings(bridge);
  await mockProvider(extContext, [{ text: 'Alpha mới' }]);
  await seedLocal(bridge, {
    translationHistory: [
      { source: 'Beta', translated: 'B', timestamp: Date.now() },
      { source: 'Alpha', translated: 'A', timestamp: Date.now() - 60_000 }
    ]
  });

  const popup = await openPopup();
  await popup.fill('#input-text', 'Alpha');
  await expect(popup.locator('#output-text')).toHaveValue('Alpha mới');
  await popup.waitForTimeout(600);

  const { translationHistory } = await readLocal(bridge, 'translationHistory');
  expect(translationHistory.map((r) => r.source)).toEqual(['Alpha', 'Beta']);
  expect(translationHistory[0].translated).toBe('Alpha mới');
});
