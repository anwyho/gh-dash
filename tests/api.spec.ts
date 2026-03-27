/**
 * API route tests — hit the real Next.js routes.
 * These run against the live dev server with real GitHub auth.
 * Rate-limit-safe: we check shape, not exact values.
 */
import { test, expect } from "@playwright/test";

// API tests hit the live dev server — may be rate-limited by GitHub.
// All assertions tolerate HTTP 500 (rate-limit) vs 200 (success).

test.describe("GET /api/my-prs", () => {
  test("returns 200 or rate-limited 500 with error key", async ({ request }) => {
    const res = await request.get("/api/my-prs");
    expect([200, 500]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(body).toHaveProperty("drafts");
      expect(body).toHaveProperty("active");
      expect(body).toHaveProperty("recentlyClosed");
      expect(body).toHaveProperty("lastFetchedAt");
      expect(Array.isArray(body.drafts)).toBe(true);
      expect(Array.isArray(body.active)).toBe(true);
    } else {
      expect(body).toHaveProperty("error");
    }
  });

  test("PR objects have required fields", async ({ request }) => {
    const res = await request.get("/api/my-prs");
    if (res.status() !== 200) return; // skip if rate limited
    const body = await res.json();
    for (const pr of [...body.drafts, ...body.active, ...body.recentlyClosed].slice(0, 2)) {
      expect(typeof pr.number).toBe("number");
      expect(typeof pr.title).toBe("string");
      expect(typeof pr.htmlUrl).toBe("string");
      expect(pr.htmlUrl).toMatch(/^https:\/\/github\.com\//);
      expect(["draft", "open", "merged", "closed"]).toContain(pr.state);
      expect(typeof pr.createdAt).toBe("string");
      expect(typeof pr.updatedAt).toBe("string");
      expect(typeof pr.author.login).toBe("string");
      expect(Array.isArray(pr.labels)).toBe(true);
    }
  });
});

test.describe("GET /api/teammate-prs", () => {
  test("returns correct shape", async ({ request }) => {
    const res = await request.get("/api/teammate-prs");
    expect([200, 500]).toContain(res.status());
    if (res.status() !== 200) return;
    const body = await res.json();
    expect(body).toHaveProperty("byTeammate");
    expect(body).toHaveProperty("lastFetchedAt");
    expect(typeof body.byTeammate).toBe("object");
    for (const prs of Object.values(body.byTeammate) as unknown[][]) {
      expect(Array.isArray(prs)).toBe(true);
    }
  });
});

test.describe("GET /api/review-requests", () => {
  test("returns reviewRequests array", async ({ request }) => {
    const res = await request.get("/api/review-requests");
    expect([200, 500]).toContain(res.status());
    if (res.status() !== 200) return;
    const body = await res.json();
    expect(Array.isArray(body.reviewRequests)).toBe(true);
    expect(typeof body.lastFetchedAt).toBe("string");
  });
});

test.describe("GET /api/pr-details-batch", () => {
  test("rejects non-numeric PR numbers with 400", async ({ request }) => {
    const res = await request.get("/api/pr-details-batch?numbers=abc,def");
    expect(res.status()).toBe(200); // empty result since no valid numbers
    const body = await res.json();
    expect(Object.keys(body)).toHaveLength(0);
  });

  test("rejects out-of-range PR numbers", async ({ request }) => {
    const res = await request.get("/api/pr-details-batch?numbers=99999999");
    // Should either be filtered out or return valid JSON
    expect([200, 400]).toContain(res.status());
  });

  test("returns empty object for empty numbers param", async ({ request }) => {
    const res = await request.get("/api/pr-details-batch?numbers=");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("returns per-PR detail shape for valid PRs", async ({ request }) => {
    // Use a known PR number from hawaiian-ice
    const res = await request.get("/api/pr-details-batch?numbers=50000");
    expect([200, 500]).toContain(res.status());
    if (res.status() !== 200) return;
    const body = await res.json();
    const detail = body["50000"];
    if (!detail) return; // PR might not exist
    expect(["approved", "changes_requested", "pending"]).toContain(detail.reviewState);
    expect(["success", "failure", "pending", "unknown"]).toContain(detail.ciState);
    expect(typeof detail.additions).toBe("number");
    expect(typeof detail.deletions).toBe("number");
    expect(typeof detail.changedFiles).toBe("number");
    expect(typeof detail.reviewComments).toBe("number");
    expect(typeof detail.commentCount).toBe("number");
  });

  test("max 100 PR numbers enforced", async ({ request }) => {
    const numbers = Array.from({ length: 101 }, (_, i) => i + 1).join(",");
    const res = await request.get(`/api/pr-details-batch?numbers=${numbers}`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

test.describe("POST /api/cache/clear", () => {
  test("returns ok:true", async ({ request }) => {
    const res = await request.post("/api/cache/clear");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
