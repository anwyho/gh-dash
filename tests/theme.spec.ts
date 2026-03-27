/**
 * Theme toggle tests — light/dark/system preference.
 */
import { test, expect } from "@playwright/test";

test.describe("Theme toggle", () => {
  test("theme toggle is present in NavBar", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    await expect(page.locator(".theme-toggle")).toBeVisible();
  });

  test("three buttons: ☀ ◑ ☾", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    const buttons = page.locator(".theme-btn");
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toContainText("☀");
    await expect(buttons.nth(1)).toContainText("◑");
    await expect(buttons.nth(2)).toContainText("☾");
  });

  test("clicking dark sets data-theme=dark on <html>", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    await page.locator(".theme-btn").nth(2).click(); // ☾ dark
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("dark");
  });

  test("clicking light sets data-theme=light on <html>", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    await page.locator(".theme-btn").nth(0).click(); // ☀ light
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("light");
  });

  test("clicking system removes data-theme attribute", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    // First set to dark
    await page.locator(".theme-btn").nth(2).click();
    // Then switch to system
    await page.locator(".theme-btn").nth(1).click(); // ◑ system
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBeUndefined();
  });

  test("theme preference is saved to localStorage", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    await page.locator(".theme-btn").nth(2).click(); // dark
    const stored = await page.evaluate(() => localStorage.getItem("gh-dash:theme"));
    expect(stored).toBe("dark");
  });

  test("active theme button has --active class", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    await page.locator(".theme-btn").nth(0).click(); // light
    await expect(page.locator(".theme-btn").nth(0)).toHaveClass(/theme-btn--active/);
    await expect(page.locator(".theme-btn").nth(2)).not.toHaveClass(/theme-btn--active/);
  });

  test("dark theme stored preference is restored on reload", async ({ page }) => {
    await page.goto("/control");
    await page.evaluate(() => localStorage.setItem("gh-dash:theme", "dark"));
    await page.reload();
    await page.waitForSelector(".theme-toggle");
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe("dark");
  });

  test("light theme has correct CSS variable for background", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    await page.locator(".theme-btn").nth(0).click(); // light
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
    );
    expect(bg).toBe("#ffffff");
  });

  test("dark theme has correct CSS variable for background", async ({ page }) => {
    await page.goto("/control");
    await page.waitForSelector(".theme-toggle");
    await page.locator(".theme-btn").nth(2).click(); // dark
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
    );
    expect(bg).toBe("#0d1117");
  });
});
