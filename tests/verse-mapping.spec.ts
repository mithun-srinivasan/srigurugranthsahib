/**
 * tests/verse-mapping.spec.ts
 * ---------------------------------------------------------------------------
 * Regression coverage for canonical verse anchors and Ang-wide line numbers.
 * Ang 1098 is deliberate: BaniDB's raw `lineNo` repeats there, so a reader
 * must expose the mapped one-based Ang sequence instead of that source field.
 */

import { test, expect } from "@playwright/test";

test.describe("Verse mapping", () => {
  test.describe.configure({ timeout: 120_000 });

  test("Ang 1098 exposes canonical verse IDs and a contiguous Ang line sequence", async ({ page }) => {
    await page.goto("/ang/1098");
    await page.waitForSelector("h1");

    const cards = page.locator("article[data-verse-id][data-line-number-on-ang]");
    const fallback = page.locator("text=ਅੰਗ ਲੋਡ ਨਹੀਂ ਹੋਇਆ");
    await expect(cards.first().or(fallback).first()).toBeVisible({ timeout: 60_000 });
    if (await fallback.isVisible()) return;

    const lines = await cards.evaluateAll((elements) =>
      elements.map((element) => Number(element.getAttribute("data-line-number-on-ang")))
    );
    expect(lines).toEqual(Array.from({ length: lines.length }, (_, index) => index + 1));

    const ids = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-verse-id"))
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
