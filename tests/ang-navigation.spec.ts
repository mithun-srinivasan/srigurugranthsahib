/**
 * tests/ang-navigation.spec.ts
 * ---------------------------------------------------------------------------
 * End-to-end tests for core reader behaviour.
 *
 * Suite coverage:
 *   1. `/ang/1` renders the expected page chrome and content (the heading
 *      shows the Raag name from BaniDB when scripture loads, else "Ang 1").
 *   2. The "Next Ang" button in the top navigation advances to `/ang/2`.
 *   3. Changing the theme via the settings panel persists to localStorage
 *      (`sgs-reader-prefs`).
 *
 * Run with `npm run test` (headless Chromium) or `npm run test:ui`.
 */

import { test, expect } from "@playwright/test";

test.describe("Ang Navigation", () => {
  test("navigating to /ang/1 displays correct content", async ({ page }) => {
    // Load the Ang 1 reader page.
    await page.goto("/ang/1");

    // The document title should include the Ang number.
    await expect(page).toHaveTitle(/Ang 1/);

    // The main heading shows the Raag name ("ਜਪ" on Ang 1) when scripture
    // loads, falling back to "Ang 1" when the upstream is unreachable.
    const header = page.locator("h1");
    await expect(header).toBeVisible();
    await expect(header).toContainText(/ਜਪ|Ang 1/);

    // The source label ("Sri Guru Granth Sahib Ji") is rendered near the top.
    const sourceText = page.locator("text=Sri Guru Granth Sahib Ji").first();
    await expect(sourceText).toBeVisible();

    // The "Ang 1 of 1430" position indicator is rendered.
    const angInfo = page.locator("text=Ang 1 of 1430");
    await expect(angInfo).toBeVisible();

    // The page actually contains Gurmukhi content (lang="pa" elements).
    const firstVerse = page.locator('[lang="pa"]').first();
    await expect(firstVerse).toBeVisible();
  });

  test("clicking next Ang navigation advances to /ang/2", async ({ page }) => {
    await page.goto("/ang/1");
    await page.waitForSelector("h1");

    // Locate the "Next Ang" button in the top navigation bar and enable it.
    const nextButton = page.locator('button[aria-label="Next Ang"]');
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeEnabled();

    // Click and wait for the URL to change to /ang/2.
    await nextButton.click();
    await page.waitForURL("**/ang/2", { timeout: 10_000 });
    expect(page.url()).toContain("/ang/2");

    // The new page title should reference Ang 2.
    await expect(page).toHaveTitle(/Ang 2/);
  });

  test("theme toggle updates sggs-reader-prefs localStorage", async ({ page }) => {
    await page.goto("/ang/1");
    await page.waitForSelector("h1");

    // Open the settings popover.
    const settingsButton = page.locator('button[aria-label="Reader Settings"]');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // Switch to Dark theme and verify the persisted value.
    const darkThemeButton = page.locator('button[aria-label="Dark theme"]');
    await expect(darkThemeButton).toBeVisible();
    await darkThemeButton.click();

    // The provider debounces writes to localStorage by 500ms — poll for the
    // final value to avoid racing the debounce timer.
    // Storage key is now versioned: sgs-reader-prefs__v1
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("sgs-reader-prefs__v1");
      if (!raw) return false;
      const prefs = JSON.parse(raw);
      return prefs.theme === "dark";
    }, undefined, { timeout: 5_000 });

    // Read the value back and assert it.
    const prefs = await page.evaluate(() => {
      const raw = localStorage.getItem("sgs-reader-prefs__v1");
      return raw ? JSON.parse(raw) : null;
    });
    expect(prefs).not.toBeNull();
    expect(prefs.theme).toBe("dark");

    // Switch to Sepia theme and verify the persisted value again.
    const sepiaThemeButton = page.locator('button[aria-label="Sepia theme"]');
    await expect(sepiaThemeButton).toBeVisible();
    await sepiaThemeButton.click();

    await page.waitForFunction(() => {
      const raw = localStorage.getItem("sgs-reader-prefs__v1");
      if (!raw) return false;
      const prefs = JSON.parse(raw);
      return prefs.theme === "sepia";
    }, undefined, { timeout: 5_000 });

    const prefsSepia = await page.evaluate(() => {
      const raw = localStorage.getItem("sgs-reader-prefs__v1");
      return raw ? JSON.parse(raw) : null;
    });
    expect(prefsSepia.theme).toBe("sepia");
  });
});