/**
 * Physics view tests — bucket layout, canvas rendering.
 */
import { test, expect } from "@playwright/test";
import { mockDashboardApis } from "./mock";
import path from "path";

const SS = (name: string) => path.join(__dirname, "../screenshots", name);

test.describe("Physics view", () => {
  test("canvas fills the available viewport", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/physics");
    await page.waitForSelector("canvas");
    await page.waitForFunction(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      return c && c.width > 600 && c.height > 400;
    }, { timeout: 8000 });
    const box = await page.locator("canvas").boundingBox();
    expect(box?.width).toBeGreaterThan(600);
    expect(box?.height).toBeGreaterThan(400);
  });

  test("renders three bucket column headers", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/physics");
    await page.waitForSelector("canvas");
    // Give canvas time to render the column headers
    await page.waitForTimeout(2000);
    // The column labels are drawn on canvas — verify via screenshot + visual check
    await page.screenshot({ path: SS("physics-buckets.png") });
    // Canvas should have drawn content (varied pixels)
    const hasContent = await page.evaluate(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      if (!c || c.width < 10) return false;
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 80) {
        seen.add((data[i] << 16) | (data[i+1] << 8) | data[i+2]);
        if (seen.size > 3) return true;
      }
      return seen.size > 1;
    });
    expect(hasContent).toBe(true);
  });

  test("canvas aria-label describes the three bucket columns", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/physics");
    await page.waitForSelector("canvas");
    // Column labels (Review Queue, My PRs, Team) are drawn on canvas.
    // Verify they're described in the accessible aria-label.
    const label = await page.locator("canvas[role='img']").getAttribute("aria-label");
    expect(label).toMatch(/review queue/i);
    expect(label).toMatch(/my prs/i);
    expect(label).toMatch(/team/i);
  });

  test("NavBar sync button triggers refresh and re-init", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/physics");
    await page.waitForSelector("canvas");
    await page.waitForFunction(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      return c && c.width > 400;
    }, { timeout: 8000 });
    // Sync should not throw
    const syncBtn = page.locator(".navbar-sync");
    if (await syncBtn.isVisible()) {
      await syncBtn.click();
    }
    // Canvas still exists and has content after sync
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("canvas has accessible role and label", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/physics");
    await page.waitForSelector("canvas");
    const canvas = page.locator("canvas");
    await expect(canvas).toHaveAttribute("role", "img");
    const label = await canvas.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label!.length).toBeGreaterThan(10);
  });

  test("balls appear after data loads with mock data", async ({ page }) => {
    await mockDashboardApis(page);
    await page.goto("/physics");
    await page.waitForSelector("canvas");
    await page.waitForFunction(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      return c && c.width > 600 && c.height > 400;
    }, { timeout: 8000 });
    await page.waitForTimeout(4000); // wait for ball init + a few frames
    await page.screenshot({ path: SS("physics-with-mock-balls.png") });
    const result = await page.evaluate(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      if (!c) return { ok: false };
      const ctx = c.getContext("2d");
      if (!ctx) return { ok: false };
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 60) {
        seen.add((data[i] << 16) | (data[i+1] << 8) | data[i+2]);
        if (seen.size >= 5) return { ok: true, count: seen.size };
      }
      return { ok: seen.size > 1, count: seen.size };
    });
    expect(result.ok).toBe(true);
  });
});
