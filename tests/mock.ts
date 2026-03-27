import type { Page } from "@playwright/test";
import {
  MOCK_MY_PRS, MOCK_TEAMMATE_PRS, MOCK_REVIEW_REQUESTS, MOCK_DETAILS,
} from "./fixtures";

/**
 * Intercepts all dashboard API routes with mock data.
 * Call before page.goto() so routes are registered in time.
 */
export async function mockDashboardApis(page: Page) {
  await page.route("**/api/my-prs**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_MY_PRS) })
  );
  await page.route("**/api/teammate-prs**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TEAMMATE_PRS) })
  );
  await page.route("**/api/review-requests**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_REVIEW_REQUESTS) })
  );
  await page.route("**/api/pr-details-batch**", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_DETAILS) })
  );
  await page.route("**/api/cache/clear", r =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
  );
}

/** Navigate to /control with mocked data and wait for render. */
export async function gotoControl(page: Page) {
  await mockDashboardApis(page);
  await page.goto("/control");
  await page.waitForSelector(".pr-card", { timeout: 8000 });
}

/** Blur all inputs so keyboard shortcuts are active. */
export async function blurInputs(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.waitForTimeout(50);
}
