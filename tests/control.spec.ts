/**
 * Control Panel feature tests — uses mocked API responses for determinism.
 */
import { test, expect } from "@playwright/test";
import { gotoControl, mockDashboardApis, blurInputs } from "./mock";
import { ACTIVE_PR, DRAFT_PR, STALE_PR, REVIEW_PR_OLD } from "./fixtures";

// ── Tabs ──────────────────────────────────────────────────────────────────────

test.describe("Tabs", () => {
  test("My PRs tab is active by default", async ({ page }) => {
    await gotoControl(page);
    await expect(page.getByRole("tab", { name: /my prs/i })).toHaveAttribute("aria-selected", "true");
  });

  test("My PRs tab shows user's PRs", async ({ page }) => {
    await gotoControl(page);
    await expect(page.getByText(ACTIVE_PR.title)).toBeVisible();
    await expect(page.getByText(DRAFT_PR.title)).toBeVisible();
  });

  test("Review Queue tab is not active by default", async ({ page }) => {
    await gotoControl(page);
    await expect(page.getByRole("tab", { name: /review queue/i })).toHaveAttribute("aria-selected", "false");
  });

  test("clicking Review Queue tab switches content", async ({ page }) => {
    await gotoControl(page);
    await page.getByRole("tab", { name: /review queue/i }).click();
    await expect(page.getByText(/needs your review/i)).toBeVisible();
    await expect(page.getByText(REVIEW_PR_OLD.title)).toBeVisible();
  });

  test("Review Queue tab badge shows count", async ({ page }) => {
    await gotoControl(page);
    await expect(page.locator(".tab-badge--urgent")).toHaveText("2");
  });

  test("switching back to My PRs preserves data", async ({ page }) => {
    await gotoControl(page);
    await page.getByRole("tab", { name: /review queue/i }).click();
    await page.getByRole("tab", { name: /my prs/i }).click();
    await expect(page.getByText(ACTIVE_PR.title)).toBeVisible();
  });
});

// ── Search ────────────────────────────────────────────────────────────────────

test.describe("Search", () => {
  test("search input is present and focusable", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").focus();
    await expect(page.locator(".search-input")).toBeFocused();
  });

  test("typing filters cards by title", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").fill("OAuth");
    await expect(page.getByText(ACTIVE_PR.title)).toBeVisible();
    await expect(page.getByText(DRAFT_PR.title)).not.toBeVisible();
  });

  test("filters by PR number", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").fill("1002");
    await expect(page.getByText(DRAFT_PR.title)).toBeVisible();
    await expect(page.getByText(ACTIVE_PR.title)).not.toBeVisible();
  });

  test("filters by author name", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").fill("anwyho");
    await expect(page.getByText(ACTIVE_PR.title)).toBeVisible();
  });

  test("empty search shows all cards", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").fill("oauth");
    await page.locator(".search-input").fill("");
    await expect(page.getByText(ACTIVE_PR.title)).toBeVisible();
    await expect(page.getByText(DRAFT_PR.title)).toBeVisible();
  });

  test("no-match query hides all cards", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").fill("xyzzy-no-match-12345");
    await expect(page.locator(".pr-card")).toHaveCount(0);
  });

  test("clear button appears when query typed", async ({ page }) => {
    await gotoControl(page);
    await expect(page.locator(".search-clear")).not.toBeVisible();
    await page.locator(".search-input").fill("test");
    await expect(page.locator(".search-clear")).toBeVisible();
  });

  test("clear button resets search", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".search-input").fill("OAuth");
    await page.locator(".search-clear").click();
    await expect(page.locator(".search-input")).toHaveValue("");
    await expect(page.getByText(DRAFT_PR.title)).toBeVisible();
  });
});

// ── Star / Unstar ─────────────────────────────────────────────────────────────

test.describe("Star", () => {
  test("star button is present on cards", async ({ page }) => {
    await gotoControl(page);
    await expect(page.locator(".pr-card-star").first()).toBeVisible();
  });

  test("star button shows ☆ by default", async ({ page }) => {
    // Use addInitScript to clear localStorage BEFORE page loads
    await page.addInitScript(() => localStorage.removeItem("gh-dash:starred-prs"));
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    await expect(page.locator(".pr-card-star").first()).toHaveText("☆");
  });

  test("clicking star toggles to ★", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("gh-dash:starred-prs"));
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    const star = page.locator(".pr-card-star").first();
    await star.click();
    await expect(star).toHaveText("★");
    await expect(star).toHaveClass(/pr-card-star--on/);
  });

  test("starred PR persisted in localStorage", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("gh-dash:starred-prs"));
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    await page.locator(".pr-card-star").first().click();
    const stored = await page.evaluate(() => localStorage.getItem("gh-dash:starred-prs"));
    expect(JSON.parse(stored!).length).toBeGreaterThan(0);
  });

  test("starred PR appears in Starred section", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("gh-dash:starred-prs", JSON.stringify([1001]))
    );
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    await expect(page.locator(".grid-section-title").filter({ hasText: "Starred" })).toBeVisible();
  });

  test("unstarring removes Starred section", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("gh-dash:starred-prs", JSON.stringify([1001]))
    );
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card-star--on");
    await page.locator(".pr-card-star--on").first().click();
    await expect(page.locator(".grid-section-title").filter({ hasText: "Starred" })).not.toBeVisible();
  });
});

// ── Hide / Restore ─────────────────────────────────────────────────────────────

test.describe("Hide / Restore", () => {
  test("hide button visible on card hover", async ({ page }) => {
    await gotoControl(page);
    const wrap = page.locator(".pr-card-wrap").first();
    await wrap.hover();
    await expect(wrap.locator(".pr-card-hide")).toBeVisible();
  });

  test("clicking hide removes card from grid", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("gh-dash:hidden-prs"));
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    const before = await page.locator(".pr-card-wrap").count();
    const wrap = page.locator(".pr-card-wrap").first();
    await wrap.hover();
    await wrap.locator(".pr-card-hide").click();
    await expect(page.locator(".pr-card-wrap")).toHaveCount(before - 1);
  });

  test("hidden PR stored in localStorage", async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem("gh-dash:hidden-prs"));
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".pr-card");
    const wrap = page.locator(".pr-card-wrap").first();
    await wrap.hover();
    await wrap.locator(".pr-card-hide").click();
    const stored = await page.evaluate(() => localStorage.getItem("gh-dash:hidden-prs"));
    expect(JSON.parse(stored!).length).toBeGreaterThan(0);
  });

  test("hidden drawer appears after hiding a PR", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("gh-dash:hidden-prs", JSON.stringify([1001]))
    );
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".hidden-toggle");
    await expect(page.locator(".hidden-toggle")).toContainText("Hidden (1)");
  });

  test("hidden drawer expands to show hidden PRs", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("gh-dash:hidden-prs", JSON.stringify([1001]))
    );
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".hidden-toggle");
    await page.locator(".hidden-toggle").click();
    await expect(page.locator(".hidden-list")).toBeVisible();
    // hidden-title clips text with ellipsis — match by PR number instead
    await expect(page.locator(".hidden-num").filter({ hasText: "#1001" })).toBeVisible();
  });

  test("restore button brings PR back", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("gh-dash:hidden-prs", JSON.stringify([1001]))
    );
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".hidden-toggle");
    await page.locator(".hidden-toggle").click();
    await page.locator(".hidden-restore").first().click();
    await expect(page.locator(".hidden-toggle")).not.toBeVisible();
  });

  test("restore all clears all hidden PRs", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("gh-dash:hidden-prs", JSON.stringify([1001, 1002]))
    );
    await mockDashboardApis(page);
    await page.goto("/control");
    await page.waitForSelector(".hidden-toggle");
    await page.locator(".hidden-clear").click();
    await expect(page.locator(".hidden-toggle")).not.toBeVisible();
  });
});

// ── Stale indicator ───────────────────────────────────────────────────────────

test.describe("Stale indicator", () => {
  test("stale badge on PRs with no activity ≥3 days", async ({ page }) => {
    await gotoControl(page);
    const staleCard = page.locator(".pr-card-wrap").filter({ hasText: STALE_PR.title });
    await expect(staleCard.locator(".pr-card-stale")).toBeVisible();
  });

  test("non-stale active PRs have no stale badge", async ({ page }) => {
    await gotoControl(page);
    const activeCard = page.locator(".pr-card-wrap").filter({ hasText: ACTIVE_PR.title });
    await expect(activeCard.locator(".pr-card-stale")).not.toBeVisible();
  });

  test("stale text says 'stale'", async ({ page }) => {
    await gotoControl(page);
    const staleCard = page.locator(".pr-card-wrap").filter({ hasText: STALE_PR.title });
    await expect(staleCard.locator(".pr-card-stale")).toHaveText("stale");
  });
});

// ── Dependency pills ──────────────────────────────────────────────────────────

test.describe("Dependency detection", () => {
  test("shows dependency pills when body has recognized dep patterns", async ({ page }) => {
    await gotoControl(page);
    // DRAFT_PR (1002) body: "...depends on #1002...blocked by #1003...Also see #9999"
    // Only "depends on" and "blocked by" match the regex (not bare references)
    const draftCard = page.locator(".pr-card-wrap").filter({ hasText: DRAFT_PR.title });
    await expect(draftCard.locator(".pr-card-dep")).toHaveCount(2); // #1002 and #1003
  });

  test("dependency pills link to the referenced PR", async ({ page }) => {
    await gotoControl(page);
    const draftCard = page.locator(".pr-card-wrap").filter({ hasText: DRAFT_PR.title });
    const firstDep = draftCard.locator(".pr-card-dep").first();
    const href = await firstDep.getAttribute("href");
    expect(href).toMatch(/\/pull\/\d+$/);
  });

  test("no dep pills when body has no recognized patterns", async ({ page }) => {
    await gotoControl(page);
    const activeCard = page.locator(".pr-card-wrap").filter({ hasText: ACTIVE_PR.title });
    await expect(activeCard.locator(".pr-card-dep")).toHaveCount(0);
  });
});

// ── Comment counts ─────────────────────────────────────────────────────────────

test.describe("Comment counts", () => {
  test("shows 💬 N when PR has comments", async ({ page }) => {
    await gotoControl(page);
    // DRAFT_PR (1002): reviewComments=3, commentCount=1 → total 4
    const draftCard = page.locator(".pr-card-wrap").filter({ hasText: DRAFT_PR.title });
    await expect(draftCard.locator(".pr-card-comments")).toBeVisible();
    await expect(draftCard.locator(".pr-card-comments")).toContainText("4");
  });

  test("no comment badge when zero comments", async ({ page }) => {
    await gotoControl(page);
    const staleCard = page.locator(".pr-card-wrap").filter({ hasText: STALE_PR.title });
    await expect(staleCard.locator(".pr-card-comments")).not.toBeVisible();
  });
});

// ── Popover ───────────────────────────────────────────────────────────────────

test.describe("Popover", () => {
  test("appears on card hover", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".pr-card").first().hover();
    await expect(page.locator(".popover")).toBeVisible({ timeout: 2000 });
  });

  test("contains PR title", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".pr-card").first().hover();
    await expect(page.locator(".popover-title")).toBeVisible();
  });

  test("disappears after mouse leave with grace period", async ({ page }) => {
    await gotoControl(page);
    await page.locator(".pr-card").first().hover();
    await expect(page.locator(".popover")).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.locator(".popover")).not.toBeVisible({ timeout: 1500 });
  });

  test("shows dep pills in popover when PR has deps", async ({ page }) => {
    await gotoControl(page);
    const draftCard = page.locator(".pr-card").filter({ hasText: DRAFT_PR.title });
    await draftCard.hover();
    await expect(page.locator(".popover-deps")).toBeVisible();
    await expect(page.locator(".popover-dep-pill").first()).toBeVisible();
  });
});

// ── Card layout ────────────────────────────────────────────────────────────────

test.describe("Card layout", () => {
  test("title is not truncated with ellipsis", async ({ page }) => {
    await gotoControl(page);
    const overflow = await page.locator(".pr-card-title").first().evaluate(
      el => window.getComputedStyle(el).textOverflow
    );
    expect(overflow).not.toBe("ellipsis");
  });

  test("star is inside footer (not top-right of card)", async ({ page }) => {
    await gotoControl(page);
    const star = page.locator(".pr-card-star").first();
    const footer = page.locator(".pr-card-footer").first();
    const starY = (await star.boundingBox())!.y;
    const footerY = (await footer.boundingBox())!.y;
    expect(starY).toBeGreaterThan(footerY - 5);
  });

  test("hide button is at top of card, not footer", async ({ page }) => {
    await gotoControl(page);
    const wrap = page.locator(".pr-card-wrap").first();
    await wrap.hover();
    const hideY = (await wrap.locator(".pr-card-hide").boundingBox())!.y;
    const starY = (await wrap.locator(".pr-card-star").boundingBox())!.y;
    // Hide button should be ABOVE the star button
    expect(hideY).toBeLessThan(starY);
  });

  test("diff stats show + and − values", async ({ page }) => {
    await gotoControl(page);
    await expect(page.locator(".pr-card-diff").first()).toBeVisible();
  });
});
