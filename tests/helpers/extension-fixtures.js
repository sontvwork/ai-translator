// Playwright fixtures for driving the extension end-to-end.
//
// Spec-writing notes:
// - Order inside every test: seed storage -> install mocks -> open pages.
//   The popup restores state and reads translationDelay at load time.
// - Use selectOption() for #target-lang / #tone-select: the custom popover
//   blocks native mousedown, but the code listens to the `change` event,
//   which selectOption dispatches.
// - Use fill() for one-shot input, pressSequentially() to simulate typing.
// - setOutput persists to chrome.storage.local asynchronously after the
//   stream resolves; wait ~600ms before reading it back.
import { test as base, chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXT_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Unpacked extension ID = SHA-256 of the absolute path, hex mapped to a-p.
export const EXT_ID = createHash('sha256').update(EXT_PATH).digest('hex').slice(0, 32)
  .replace(/./g, c => String.fromCharCode(97 + parseInt(c, 16)));

export const extUrl = (p) => `chrome-extension://${EXT_ID}/${p}`;

export const test = base.extend({
  // One persistent browser per worker; launching per test is too slow.
  // Default is the full browser in new-headless mode (`channel: 'chromium'`),
  // which supports extensions — the headless shell does not. HEADED=1 opens
  // a visible window (needs a display server, e.g. xvfb-run on CI boxes).
  extContext: [async ({}, use) => {
    const headed = process.env.HEADED === '1';
    const profileDir = await mkdtemp(path.join(tmpdir(), 'ai-translator-e2e-'));
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: !headed,
      channel: headed ? undefined : 'chromium',
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [
        `--disable-extensions-except=${EXT_PATH}`,
        `--load-extension=${EXT_PATH}`
      ]
    });
    await use(context);
    await context.close();
    await rm(profileDir, { recursive: true, force: true });
  }, { scope: 'worker' }],

  // Extension-origin page that runs no app JS (manifest.json) — used to
  // seed/read chrome.storage without triggering popup/settings side effects.
  bridge: [async ({ extContext }, use) => {
    const page = await extContext.newPage();
    await page.goto(extUrl('manifest.json'));
    await use(page);
  }, { scope: 'worker' }],

  // Every test starts from empty storage and ends with routes/pages cleaned up.
  resetState: [async ({ extContext, bridge }, use) => {
    await bridge.evaluate(async () => {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
    });
    await use();
    await extContext.unrouteAll({ behavior: 'ignoreErrors' });
    for (const page of extContext.pages()) {
      if (page !== bridge) {
        await page.close().catch(() => {});
      }
    }
  }, { auto: true }],

  openPopup: async ({ extContext }, use) => {
    await use(async () => {
      const page = await extContext.newPage();
      await page.goto(extUrl('popup.html'));
      await page.waitForSelector('#input-text');
      return page;
    });
  },

  openSettings: async ({ extContext }, use) => {
    await use(async () => {
      const page = await extContext.newPage();
      await page.goto(extUrl('settings.html'));
      await page.waitForSelector('#save-settings');
      return page;
    });
  },

  // Serves `html` at https://e2e.test/ via route interception; the content
  // script injects because manifest matches <all_urls>.
  openWebPage: async ({ extContext }, use) => {
    await use(async (html) => {
      await extContext.route('https://e2e.test/**', (route) => route.fulfill({
        contentType: 'text/html',
        body: html
      }));
      const page = await extContext.newPage();
      await page.goto('https://e2e.test/');
      return page;
    });
  }
});

export { expect } from '@playwright/test';
