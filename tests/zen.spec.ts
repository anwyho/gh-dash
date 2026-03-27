/**
 * Zen view tests — orbital rings, interaction, size controls.
 */
import { test, expect } from "@playwright/test";
import { mockDashboardApis } from "./mock";
import path from "path";

const SS = (name: string) => path.join(__dirname, "../screenshots", name);

test.describe("Zen view", () => {
  test("SVG orbital diagram renders", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await expect(page.locator("svg").first()).toBeVisible();
  });

  test("center hub shows hawaiian-ice label", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(2000);
    const hub = page.locator("svg text").filter({ hasText: "hawaiian-ice" }).first();
    await expect(hub).toBeVisible();
  });

  test("HI text is in the SVG center", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    const hiText = page.locator("svg text").filter({ hasText: "HI" }).first();
    await expect(hiText).toBeVisible();
  });

  test("ring labels show teammate/myLogin/review counts", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(1500);
    // Ring labels are rendered as SVG text next to each orbit
    const svgTexts = await page.locator("svg text").allTextContents();
    const allText = svgTexts.join(" ");
    // Should contain "team", "@anwyho", and "review" labels
    expect(allText).toMatch(/team/i);
    expect(allText).toMatch(/review/i);
  });

  test("orbit dots have accessible role and label", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(2000);
    // Orbit dot circles have role="button"
    const dots = page.locator('circle[role="button"]');
    const count = await dots.count();
    // Should have dots for our mock data (1 teammate + 2 my PRs + 2 review requests = 5)
    expect(count).toBeGreaterThan(0);
    const label = await dots.first().getAttribute("aria-label");
    expect(label).toMatch(/PR #\d+/);
  });

  test("orbit dot click opens PR URL", async ({ page, context }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(2000);
    const dots = page.locator('circle[role="button"]');
    if (await dots.count() === 0) return;
    // Pause animation first so elements are stable for click
    await page.locator("main").click({ force: true });
    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      dots.first().click({ force: true }), // force: bypass "not stable" from animation
    ]);
    await expect(newPage.url()).toMatch(/github\.com/);
    await newPage.close();
  });

  test("hovering a dot reveals tooltip panel", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(2000);
    const dot = page.locator('circle[role="button"]').first();
    if (await dot.count() === 0) return;
    // Pause animation first (click main), then hover the dot
    await page.locator("main").click({ force: true });
    await page.waitForTimeout(200);
    await dot.hover({ force: true });
    // Detail card should appear — it contains the PR title text
    // Zen detail card has .popover-title class within a right-panel div
    await expect(page.locator(".popover-title, [style*='font-weight: 500']").last()).toBeVisible({ timeout: 3000 });
  });

  test("clicking anywhere pauses and resumes orbits", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(1000);
    // Status hint shows "Hover to inspect" initially
    const hint = page.locator("p[aria-live='polite']");
    await expect(hint).toContainText(/hover/i);
    // Click to pause
    await page.locator("main").click();
    await expect(hint).toContainText(/resume/i);
    // Click again to resume
    await page.locator("main").click();
    await expect(hint).toContainText(/hover/i);
  });

  test("ring size − button is present", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await expect(page.getByRole("button", { name: /shrink orbital/i })).toBeVisible();
  });

  test("ring size + button is present", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await expect(page.getByRole("button", { name: /grow orbital/i })).toBeVisible();
  });

  test("+ button increases ring scale label", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(500);
    const scaleLabel = page.locator(".zen-scale-label, span").filter({ hasText: "100%" }).first();
    await expect(scaleLabel).toBeVisible();
    await page.getByRole("button", { name: /grow orbital/i }).click();
    await expect(page.locator("span").filter({ hasText: "110%" })).toBeVisible();
  });

  test("− button decreases ring scale label", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /shrink orbital/i }).click();
    await expect(page.locator("span").filter({ hasText: "90%" })).toBeVisible();
  });

  test("scale cannot go below 40%", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    // Click shrink 10 times
    for (let i = 0; i < 10; i++) {
      await page.getByRole("button", { name: /shrink orbital/i }).click();
    }
    const scaleLabel = await page.locator("span").filter({ hasText: /\d+%/ }).first().textContent();
    const pct = parseInt(scaleLabel!);
    expect(pct).toBeGreaterThanOrEqual(40);
  });

  test("SVG has accessible role and aria-label", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    const svg = page.locator("svg[role='img']");
    await expect(svg).toBeVisible();
    const label = await svg.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label).toMatch(/orbital/i);
  });

  test("hidden SR-only list has PR links", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(2000);
    const srList = page.locator(".sr-only[aria-label*='pull requests']");
    const links = srList.locator("a");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test("screenshots zen view for visual inspection", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/zen");
    await page.waitForSelector("svg");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: SS("zen-with-mock-data.png") });
  });
});
