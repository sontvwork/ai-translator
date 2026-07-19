import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Tests share one persistent browser context per worker (chrome.storage is
  // global to the extension), so they must not run in parallel.
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: 'list'
});
