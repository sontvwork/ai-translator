import { test, expect } from '../helpers/extension-fixtures.js';
import { readLocal } from '../helpers/storage.js';

const PAGE_HTML = '<!DOCTYPE html><html><body><p id="para">Hello world from the test page</p></body></html>';

test('TC-CS-001 selecting text shows the translator icon @smoke', async ({ openWebPage }) => {
  const page = await openWebPage(PAGE_HTML);

  await page.locator('#para').click({ clickCount: 3 });

  await expect(page.locator('.ai-translator-icon')).toHaveClass(/show/);
});

test('TC-CS-002 clicking the icon stores the selection for the popup @smoke', async ({ bridge, openWebPage }) => {
  const page = await openWebPage(PAGE_HTML);
  await page.locator('#para').click({ clickCount: 3 });
  const icon = page.locator('.ai-translator-icon');
  await expect(icon).toHaveClass(/show/);

  await icon.click();

  // The content script writes to storage before asking the background to open
  // the popup, so this holds even when chrome.action.openPopup() fails in
  // automation (no user gesture).
  await expect.poll(() => readLocal(bridge, ['selectedText', 'fromInPageTranslation'])).toEqual({
    selectedText: 'Hello world from the test page',
    fromInPageTranslation: true
  });
  await expect(icon).not.toHaveClass(/show/);
});

test('TC-CS-003 selections over 8000 characters do not show the icon', async ({ openWebPage }) => {
  const page = await openWebPage(
    `<!DOCTYPE html><html><body><p id="long">${'x'.repeat(8100)}</p></body></html>`
  );

  await page.locator('#long').click({ clickCount: 3 });

  await page.waitForTimeout(600); // well past the 200ms debounce
  await expect(page.locator('.ai-translator-icon.show')).toHaveCount(0);
});

test('TC-CS-004 in-page translation setting disables the icon, including live changes', async ({ bridge, openWebPage }) => {
  await bridge.evaluate(() => chrome.storage.sync.set({ inPageTranslationEnabled: false }));
  const page = await openWebPage(PAGE_HTML);

  await page.locator('#para').click({ clickCount: 3 });
  await page.waitForTimeout(600);
  await expect(page.locator('.ai-translator-icon.show')).toHaveCount(0);

  // Re-enable live (storage.onChanged), select again: icon appears…
  await bridge.evaluate(() => chrome.storage.sync.set({ inPageTranslationEnabled: true }));
  await page.mouse.click(200, 400); // collapse the old selection first
  await page.locator('#para').click({ clickCount: 3 });
  const icon = page.locator('.ai-translator-icon');
  await expect(icon).toHaveClass(/show/);

  // …and disabling live hides the visible icon immediately.
  await bridge.evaluate(() => chrome.storage.sync.set({ inPageTranslationEnabled: false }));
  await expect(icon).not.toHaveClass(/show/);
});

test('TC-CS-005 clicking elsewhere hides the icon', async ({ openWebPage }) => {
  const page = await openWebPage(PAGE_HTML);
  await page.locator('#para').click({ clickCount: 3 });
  const icon = page.locator('.ai-translator-icon');
  await expect(icon).toHaveClass(/show/);

  await page.mouse.click(200, 400); // empty area, deselects

  await expect(icon).not.toHaveClass(/show/);
});
