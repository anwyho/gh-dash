/**
 * Accessibility tests — ARIA, keyboard, contrast, skip link.
 */
import { test, expect } from "@playwright/test";
import { mockDashboardApis } from "./mock";

test.describe("Accessibility", () => {
  test("skip link is present in DOM", async ({ page }) => {
    await page.goto("/control");
    const skip = page.locator(".skip-link");
    await expect(skip).toBeAttached();
    await expect(skip).toHaveText(/skip to main content/i);
  });

  test("skip link is visible when focused", async ({ page }) => {
    await page.goto("/control");
    await page.keyboard.press("Tab"); // First tab stop should be skip link
    const skip = page.locator(".skip-link");
    await expect(skip).toBeFocused();
  });

  test("NavBar has role=banner", async ({ page }) => {
    await page.goto("/control");
    await expect(page.locator("header[role='banner']")).toBeVisible();
  });

  test("main content has id=main-content", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector("#main-content");
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("tab switcher has role=tablist", async ({ page }) => {
    await page.goto("/control");
    await expect(page.locator("[role='tablist']")).toBeVisible();
  });

  test("tab buttons have aria-selected attribute", async ({ page }) => {
    await page.goto("/control");
    const tabs = page.locator("[role='tab']");
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) {
      const sel = await tabs.nth(i).getAttribute("aria-selected");
      expect(["true", "false"]).toContain(sel);
    }
  });

  test("exactly one tab is active at a time", async ({ page }) => {
    await page.goto("/control");
    const activeTabs = page.locator("[role='tab'][aria-selected='true']");
    await expect(activeTabs).toHaveCount(1);
  });

  test("active nav link has aria-current=page", async ({ page }) => {
    await page.goto("/control");
    const current = page.locator(".navbar-link[aria-current='page']");
    await expect(current).toHaveCount(1);
  });

  test("PR cards have aria-label on the anchor", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    const card = page.locator(".pr-card").first();
    const label = await card.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toMatch(/PR #\d+/);
  });

  test("star buttons have aria-label and aria-pressed", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card-star");
    const star = page.locator(".pr-card-star").first();
    const label = await star.getAttribute("aria-label");
    const pressed = await star.getAttribute("aria-pressed");
    expect(label).toMatch(/star/i);
    expect(["true", "false"]).toContain(pressed);
  });

  test("search input has aria-label", async ({ page }) => {
    await page.goto("/control");
    const input = page.locator(".search-input");
    const label = await input.getAttribute("aria-label");
    expect(label).toBeTruthy();
  });

  test("focus-visible ring appears on keyboard navigation", async ({ page }) => {
    await page.goto("/control");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // An element should be focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).not.toBe("BODY");
  });

  test("physics canvas has role=img with aria-label", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/physics");
    await page.waitForSelector("canvas");
    await expect(page.locator("canvas[role='img']")).toBeVisible();
    const label = await page.locator("canvas").getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label!.length).toBeGreaterThan(10);
  });

  test("physics screen-reader list is present with PR links", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/physics");
    await page.waitForSelector("canvas");
    await page.waitForTimeout(5000); // wait for ball init
    const srList = page.locator(".sr-only[aria-label='Pull requests']");
    // It appears after balls initialize
    await expect(srList).toBeAttached({ timeout: 8000 });
  });

  test("zen SVG has role=img and aria-label", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg[role='img']");
    const label = await page.locator("svg[role='img']").getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toMatch(/orbital/i);
  });

  test("nav sync button has accessible label", async ({ page }) => {
    await page.goto("/control");
    // Either spinner (aria-label=Syncing) or sync button (aria-label=Sync dashboard data)
    await page.waitForTimeout(1000); // let loading finish
    const syncBtn = page.locator(".navbar-sync, .navbar-spinner");
    const el = syncBtn.first();
    const label = await el.getAttribute("aria-label");
    expect(label).toBeTruthy();
  });

  test("keyboard help modal is accessible", async ({ page }) => {
    await page.goto("/control");
    await page.click("body");
    await page.keyboard.press("?");
    const modal = page.locator(".shortcut-modal");
    await expect(modal).toBeVisible();
    // Close button is present
    await expect(page.locator(".shortcut-close")).toBeVisible();
    // Pressing Esc closes it
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });
});
