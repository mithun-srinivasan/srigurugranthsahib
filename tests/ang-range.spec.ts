/**
 * tests/ang-range.spec.ts
 * ---------------------------------------------------------------------------
 * End-to-end tests for Ang range handling.
 *
 * Suite coverage:
 *   1. The top-bar Ang input clamps a too-high number (9999) to `/ang/1430`
 *      instead of swallowing the submit (native min/max must not block it).
 *   2. The top-bar Ang input clamps a too-low number (0) to `/ang/1`.
 *   3. Visiting an invalid Ang URL (e.g. `/ang/9999`) renders the recovery
 *      404 with a "nearest valid Ang" link that navigates to `/ang/1430`.
 *
 * Upstream note: BaniDB-backed verse assertions are network-tolerant — each
 * test accepts either the live content or the designed fallback card, and
 * navigations are asserted on the URL (which never depends on the network).
 *
 * Run with `npm run test` (headless Chromium) or `npm run test:ui`.
 */

import { test, expect } from "@playwright/test";

test.describe("Ang Range Handling", () => {
  // Navigating to a freshly-compiled Ang pulls live BaniDB data server-side,
  // which can exceed the default 30 s budget on a cold runner — the
  // assertions (exact clamped URLs) stay strict, only the budget grows.
  test.describe.configure({ timeout: 120_000 });

  test("top bar clamps a too-high Ang number to 1430", async ({ page }) => {
    await page.goto("/ang/100");
    await page.waitForSelector("h1");

    // Type an out-of-range number into the top-bar Ang input and submit.
    const input = page.locator('input[aria-label="Go to Ang number"]');
    await expect(input).toBeVisible();
    await input.fill("9999");
    await input.press("Enter");

    // Must land on the clamped page — never a dead input, never the 404.
    await page.waitForURL("**/ang/1430", { timeout: 60_000 });
    expect(page.url()).toContain("/ang/1430");

    // Either the live Ang content or the offline fallback card is showing.
    const liveInfo = page.locator("text=Ang 1430 of 1430");
    const fallbackHeading = page.locator("text=ਅੰਗ ਲੋਡ ਨਹੀਂ ਹੋਇਆ");
    await expect(liveInfo.or(fallbackHeading).first()).toBeVisible();
  });

  test("top bar clamps a too-low Ang number to 1", async ({ page }) => {
    await page.goto("/ang/100");
    await page.waitForSelector("h1");

    const input = page.locator('input[aria-label="Go to Ang number"]');
    await expect(input).toBeVisible();
    await input.fill("0");
    await input.press("Enter");

    await page.waitForURL("**/ang/1", { timeout: 60_000 });
    expect(page.url()).toContain("/ang/1");

    const liveInfo = page.locator("text=Ang 1 of 1430");
    const fallbackHeading = page.locator("text=ਅੰਗ ਲੋਡ ਨਹੀਂ ਹੋਇਆ");
    await expect(liveInfo.or(fallbackHeading).first()).toBeVisible();
  });

  test("invalid Ang URL shows the recovery 404 with nearest-Ang link", async ({
    page,
  }) => {
    await page.goto("/ang/9999");

    // The out-of-range explanation is rendered (never a blank break).
    await expect(page.locator("text=That Ang number is out of range")).toBeVisible();

    // The recovery link points at the nearest valid Ang; following it works.
    const nearestLink = page.locator('a[href="/ang/1430"]');
    await expect(nearestLink).toBeVisible();
    await nearestLink.click();
    await page.waitForURL("**/ang/1430", { timeout: 60_000 });
    expect(page.url()).toContain("/ang/1430");
  });

  test("rejects malformed route segments instead of coercing them to a nearby Ang", async ({ page }) => {
    await page.goto("/ang/1abc");

    await expect(page.locator("text=That Ang number is out of range")).toBeVisible();
    await expect(page.locator('a[href="/ang/1"][class*="border"]').first()).toBeVisible();
  });
});
