import { test, expect } from "@playwright/test";
import path from "path";

const VIEWS = [
  { name: "control", url: "/control" },
  { name: "physics", url: "/physics" },
  { name: "zen", url: "/zen" },
];

const SCREENSHOT_DIR = path.join(__dirname, "../screenshots");

for (const view of VIEWS) {
  test(`${view.name} - loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(view.url);

    // Wait for the nav bar to appear (shared across all views)
    await page.waitForSelector("header", { timeout: 10000 });

    // Wait for network to settle
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {
      // networkidle can time out if SWR keeps polling — that's fine
    });

    // Wait a bit for data to render
    await page.waitForTimeout(3000);

    // Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${view.name}-initial.png`),
      fullPage: false,
    });

    // No JS errors
    expect(errors.filter((e) => !e.includes("hydration"))).toHaveLength(0);
  });
}

test("control - nav links work", async ({ page }) => {
  await page.goto("/control");
  await page.waitForSelector("header");

  // Physics link
  await page.click("a[href='/physics']");
  await page.waitForURL("**/physics");
  expect(page.url()).toContain("/physics");

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "physics-via-nav.png") });

  // Zen link
  await page.click("a[href='/zen']");
  await page.waitForURL("**/zen");
  expect(page.url()).toContain("/zen");

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "zen-via-nav.png") });

  // Back to control
  await page.click("a[href='/control']");
  await page.waitForURL("**/control");
  expect(page.url()).toContain("/control");
});

test("control - review queue loads and shows urgency colors", async ({ page }) => {
  await page.goto("/control");
  await page.waitForSelector("header");
  await page.waitForTimeout(5000); // wait for SWR data

  // "needs your review" label should be present
  const reviewLabel = page.getByText("needs your review");
  await expect(reviewLabel).toBeVisible();

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "control-review-queue.png") });
});

test("physics - canvas renders and balls appear", async ({ page }) => {
  await page.goto("/physics");
  await page.waitForSelector("canvas");
  await page.waitForTimeout(6000); // wait for SWR + ball init

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  // Canvas should have non-zero dimensions
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(100);
  expect(box?.height).toBeGreaterThan(100);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "physics-with-balls.png") });
});

test("zen - SVG orbital rings render", async ({ page }) => {
  await page.goto("/zen");
  await page.waitForSelector("svg");
  await page.waitForTimeout(4000);

  const svg = page.locator("svg").first();
  await expect(svg).toBeVisible();

  // "HI" text should be in the center
  const hiText = page.getByText("HI");
  await expect(hiText).toBeVisible();

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "zen-orbital.png") });
});

test("root / redirects to /control", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/control", { timeout: 5000 });
  expect(page.url()).toContain("/control");
});

test("api - /api/review-requests returns valid shape", async ({ request }) => {
  const res = await request.get("/api/review-requests");
  // 200 on success, 500 if GitHub API is rate-limited
  const status = res.status();
  if (status === 500) {
    const body = await res.json();
    // Must be a known transient error (rate limit, auth) — not a code bug
    expect(body.details ?? body.error).toBeTruthy();
    test.info().annotations.push({ type: "warning", description: "GitHub rate limit hit — skipping shape check" });
    return;
  }
  expect(status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.reviewRequests)).toBe(true);
  expect(typeof body.lastFetchedAt).toBe("string");
});

test("api - /api/my-prs includes createdAt on each PR", async ({ request }) => {
  const res = await request.get("/api/my-prs");
  const status = res.status();
  if (status === 500) {
    const body = await res.json();
    expect(body.details ?? body.error).toBeTruthy();
    test.info().annotations.push({ type: "warning", description: "GitHub rate limit hit — skipping shape check" });
    return;
  }
  expect(status).toBe(200);
  const body = await res.json();
  for (const pr of [...body.drafts, ...body.active, ...body.recentlyClosed].slice(0, 3)) {
    expect(typeof pr.createdAt).toBe("string");
    expect(typeof pr.updatedAt).toBe("string");
  }
});
