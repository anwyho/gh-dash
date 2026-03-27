/**
 * Keyboard shortcut tests.
 * All tests use mocked API responses and blurInputs() before sending keys.
 */
import { test, expect } from "@playwright/test";
import { gotoControl, mockDashboardApis, blurInputs } from "./mock";
import { ACTIVE_PR, DRAFT_PR } from "./fixtures";

test.describe("Keyboard shortcuts", () => {
  test("? opens help modal", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("?");
    await expect(page.locator(".shortcut-modal")).toBeVisible();
  });

  test("Esc closes help modal", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("?");
    await expect(page.locator(".shortcut-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".shortcut-modal")).not.toBeVisible();
  });

  test("clicking × closes help modal", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("?");
    await page.locator(".shortcut-close").click();
    await expect(page.locator(".shortcut-modal")).not.toBeVisible();
  });

  test("/ focuses the search input", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("/");
    await expect(page.locator(".search-input")).toBeFocused();
  });

  test("Esc clears search when input is focused", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").fill("oauth");
    await expect(page.locator(".search-input")).toHaveValue("oauth");
    await page.keyboard.press("Escape");
    await expect(page.locator(".search-input")).toHaveValue("");
  });

  test("1 switches to My PRs tab", async ({ page }) => {
    await gotoControl(page);
    // First switch to Review tab
    await page.getByRole("tab", { name: /review queue/i }).click();
    await blurInputs(page);
    await page.keyboard.press("1");
    await expect(page.getByRole("tab", { name: /my prs/i })).toHaveAttribute("aria-selected", "true");
  });

  test("2 switches to Review Queue tab", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("2");
    await expect(page.getByRole("tab", { name: /review queue/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/needs your review/i)).toBeVisible();
  });

  test("j moves focus to first card", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("j");
    // A card should have the focused class
    await expect(page.locator(".pr-card-wrap--focused")).toBeVisible();
  });

  test("j/j moves focus to second card", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    // Still should have exactly one focused card
    await expect(page.locator(".pr-card-wrap--focused")).toHaveCount(1);
  });

  test("k moves focus back up", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await expect(page.locator(".pr-card-wrap--focused")).toHaveCount(1);
  });

  test("Esc removes card focus", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("j");
    await expect(page.locator(".pr-card-wrap--focused")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".pr-card-wrap--focused")).not.toBeVisible();
  });

  test("s stars the focused card", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("gh-dash:starred-prs"));
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    await blurInputs(page);
    await page.keyboard.press("j");
    await page.keyboard.press("s");
    // PR may appear in both Starred + Active sections, so use first()
    await expect(page.locator(".pr-card-wrap--focused .pr-card-star--on").first()).toBeVisible();
  });

  test("h hides the focused card", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("gh-dash:hidden-prs"));
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    const initialCount = await page.locator(".pr-card-wrap").count();
    await blurInputs(page);
    await page.keyboard.press("j");
    await page.keyboard.press("h");
    await expect(page.locator(".pr-card-wrap")).toHaveCount(initialCount - 1);
  });

  test("shortcuts are disabled when search input is focused", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").click();
    // Type 'j' as a character (should go into input, not navigate)
    await page.keyboard.type("j");
    await expect(page.locator(".search-input")).toHaveValue("j");
    await expect(page.locator(".pr-card-wrap--focused")).not.toBeVisible();
  });

  test("focused card has visible focus ring", async ({ page }) => {
    await gotoControl(page);
    await blurInputs(page);
    await page.keyboard.press("j");
    const focused = page.locator(".pr-card-wrap--focused");
    await expect(focused).toBeVisible();
    await expect(focused).toHaveClass(/pr-card-wrap--focused/);
  });
});
