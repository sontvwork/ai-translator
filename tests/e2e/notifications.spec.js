import { test, expect } from '../helpers/extension-fixtures.js';
import { seedSettings, seedLocal, readLocal } from '../helpers/storage.js';
import { NOTIFICATIONS, ALL_NOTIFICATIONS } from '../../notifications.js';

// Asserts are dynamic against notifications.js so releases adding notifications don't break tests.
const ALL_IDS = NOTIFICATIONS.map((n) => n.id);
// The popover lists newest (highest id) first.
const SORTED = [...NOTIFICATIONS].sort((a, b) => b.id - a.id);
// Local date as "YYYY-MM-DD" — the same comparison notifications.js uses.
const TODAY = new Date().toLocaleDateString('sv-SE');
const EXPIRED = ALL_NOTIFICATIONS.filter((n) => n.expiresAt && n.expiresAt < TODAY);

test('TC-NOT-001 badge shows unread count and popover lists all titles @smoke', async ({ bridge, openPopup }) => {
  await seedSettings(bridge);

  const popup = await openPopup();
  await expect(popup.locator('#notifications-badge')).toHaveText(String(NOTIFICATIONS.length));

  await popup.click('#notifications-button');
  const items = popup.locator('#notifications-list .history-item');
  await expect(items).toHaveCount(NOTIFICATIONS.length);
  for (let i = 0; i < SORTED.length; i++) {
    await expect(items.nth(i).locator('.history-item-source')).toHaveText(SORTED[i].title);
    await expect(items.nth(i).locator('.history-item-translated')).toHaveText(SORTED[i].content);
  }
});

test('TC-NOT-002 opening a detail marks it read and back returns to the list @smoke', async ({ bridge, openPopup }) => {
  await seedSettings(bridge);
  const first = SORTED[0];

  const popup = await openPopup();
  await popup.click('#notifications-button');
  await popup.locator('#notifications-list .history-item').first().click();

  await expect(popup.locator('#notifications-detail-title')).toHaveText(first.title);
  // textContent keeps line breaks (toHaveText normalizes whitespace)
  expect(await popup.locator('#notifications-detail-content').textContent()).toBe(first.content);

  await expect.poll(async () => (await readLocal(bridge, 'readNotificationIds')).readNotificationIds)
    .toContain(first.id);
  const remaining = NOTIFICATIONS.length - 1;
  if (remaining === 0) {
    await expect(popup.locator('#notifications-badge')).toBeHidden();
  } else {
    await expect(popup.locator('#notifications-badge')).toHaveText(String(remaining));
  }

  await popup.click('#notifications-back-button');
  await expect(popup.locator('#notifications-list')).toBeVisible();
  await expect(popup.locator('#notifications-detail-view')).toBeHidden();
});

test('TC-NOT-003 mark-all-read hides the badge and stores every id', async ({ bridge, openPopup }) => {
  await seedSettings(bridge);

  const popup = await openPopup();
  await popup.click('#notifications-button');
  await popup.click('#notifications-mark-read-button');

  await expect(popup.locator('#notifications-badge')).toBeHidden();
  await expect.poll(async () => (await readLocal(bridge, 'readNotificationIds')).readNotificationIds)
    .toEqual(ALL_IDS);
});

test('TC-NOT-004 read state persists across popup opens', async ({ bridge, openPopup }) => {
  await seedSettings(bridge);
  await seedLocal(bridge, { readNotificationIds: ALL_IDS });

  const popup = await openPopup();
  await expect(popup.locator('#notifications-badge')).toBeHidden();
});

test('TC-NOT-005 history and notifications popovers are mutually exclusive', async ({ bridge, openPopup }) => {
  await seedSettings(bridge);
  await seedLocal(bridge, {
    translationHistory: [{ source: 'Hello', translated: 'Xin chào', timestamp: Date.now() }]
  });

  const popup = await openPopup();
  await popup.click('#history-button');
  await expect(popup.locator('#history-popover')).toBeVisible();

  await popup.click('#notifications-button');
  await expect(popup.locator('#notifications-popover')).toBeVisible();
  await expect(popup.locator('#history-popover')).toBeHidden();

  await popup.click('#history-button');
  await expect(popup.locator('#history-popover')).toBeVisible();
  await expect(popup.locator('#notifications-popover')).toBeHidden();
});

test('TC-NOT-006 disabled notifications never reach the popup', async ({ bridge, openPopup }) => {
  await seedSettings(bridge);

  // Nothing with enabled:false survives the filter, and the UI only ever sees the filtered list.
  expect(NOTIFICATIONS.filter((n) => n.enabled === false)).toEqual([]);
  expect(NOTIFICATIONS.length).toBeLessThanOrEqual(ALL_NOTIFICATIONS.length);
  expect(ALL_NOTIFICATIONS.filter((n) => n.enabled === false).length)
    .toBe(ALL_NOTIFICATIONS.length - NOTIFICATIONS.length - EXPIRED.length);

  const popup = await openPopup();
  await popup.click('#notifications-button');
  await expect(popup.locator('#notifications-list .history-item')).toHaveCount(NOTIFICATIONS.length);
  for (const hidden of ALL_NOTIFICATIONS.filter((n) => !NOTIFICATIONS.includes(n))) {
    await expect(popup.locator('#notifications-list').getByText(hidden.title)).toHaveCount(0);
  }
});

test('TC-NOT-007 notifications past expiresAt are filtered out', async () => {
  // Nothing expired survives; everything that does is unexpired or dateless.
  for (const n of NOTIFICATIONS) {
    expect(!n.expiresAt || n.expiresAt >= TODAY).toBe(true);
  }
  for (const n of EXPIRED) {
    expect(NOTIFICATIONS).not.toContain(n);
  }

  // An entry expiring today is still shown (the cut-off is end of that day).
  const unexpired = ALL_NOTIFICATIONS.filter((n) => n.expiresAt === TODAY);
  for (const n of unexpired) {
    expect(NOTIFICATIONS).toContain(n);
  }
});
