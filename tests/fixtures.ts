import type { PrCardData, PrDetails, MyPrsResponse, TeammatePrsResponse, ReviewRequestsResponse } from "@/types/pr";

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

export function makePr(overrides: Partial<PrCardData> & { number: number }): PrCardData {
  return {
    number: overrides.number,
    title: overrides.title ?? `PR title for #${overrides.number}`,
    htmlUrl: `https://github.com/Gusto/hawaiian-ice/pull/${overrides.number}`,
    state: overrides.state ?? "open",
    author: overrides.author ?? { login: "anwyho", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4" },
    labels: overrides.labels ?? [],
    updatedAt: overrides.updatedAt ?? daysAgo(1),
    createdAt: overrides.createdAt ?? daysAgo(3),
  };
}

export function makeDetails(overrides: Partial<PrDetails> = {}): PrDetails {
  return {
    reviewState: "pending",
    ciState: "success",
    body: null,
    additions: 10,
    deletions: 3,
    changedFiles: 2,
    reviewComments: 0,
    commentCount: 0,
    ...overrides,
  };
}

// ── Canonical mock dataset ───────────────────────────────────────────────────

export const ACTIVE_PR = makePr({ number: 1001, title: "Add OAuth token refresh", state: "open", updatedAt: daysAgo(1), createdAt: daysAgo(4) });
export const DRAFT_PR = makePr({ number: 1002, title: "WIP: redesign settings page", state: "draft", updatedAt: daysAgo(2), createdAt: daysAgo(6) });
export const CLOSED_PR = makePr({ number: 1003, title: "Fix race condition in queue", state: "merged", updatedAt: daysAgo(0), createdAt: daysAgo(10) });
export const STALE_PR = makePr({ number: 1004, title: "Update dependencies", state: "open", updatedAt: daysAgo(5), createdAt: daysAgo(10) });
export const REVIEW_PR = makePr({ number: 1005, title: "Carrier metadata: add v2 API", state: "open", updatedAt: daysAgo(0), createdAt: daysAgo(2), author: { login: "thelowlypeon", avatarUrl: "https://avatars.githubusercontent.com/u/2?v=4" } });
export const REVIEW_PR_OLD = makePr({ number: 1006, title: "Old review waiting 5 days", state: "open", updatedAt: daysAgo(5), createdAt: daysAgo(5), author: { login: "varshabala", avatarUrl: "https://avatars.githubusercontent.com/u/3?v=4" } });
export const TEAMMATE_PR = makePr({ number: 1007, title: "Teammate feature branch", state: "open", updatedAt: daysAgo(1), createdAt: daysAgo(2), author: { login: "aergonaut", avatarUrl: "https://avatars.githubusercontent.com/u/4?v=4" } });

export const DEPS_DETAILS = makeDetails({ body: "This PR depends on #1002 and is blocked by #1003. Also see #9999.", reviewComments: 3, commentCount: 1 });
export const APPROVED_DETAILS = makeDetails({ reviewState: "approved", ciState: "success", additions: 42, deletions: 8, changedFiles: 5 });
export const CHANGES_DETAILS = makeDetails({ reviewState: "changes_requested", ciState: "failure" });
export const COMMENT_DETAILS = makeDetails({ reviewComments: 4, commentCount: 2 });

export const MOCK_MY_PRS: MyPrsResponse = {
  active: [ACTIVE_PR, STALE_PR],
  drafts: [DRAFT_PR],
  recentlyClosed: [CLOSED_PR],
  lastFetchedAt: new Date().toISOString(),
};

export const MOCK_TEAMMATE_PRS: TeammatePrsResponse = {
  byTeammate: { aergonaut: [TEAMMATE_PR] },
  lastFetchedAt: new Date().toISOString(),
};

export const MOCK_REVIEW_REQUESTS: ReviewRequestsResponse = {
  reviewRequests: [REVIEW_PR_OLD, REVIEW_PR], // old first (sorted by createdAt)
  lastFetchedAt: new Date().toISOString(),
};

export const MOCK_DETAILS: Record<number, PrDetails> = {
  1001: makeDetails({ body: "Fixes the token expiry issue.", additions: 42, deletions: 8, changedFiles: 5, reviewComments: 2 }),
  1002: DEPS_DETAILS,
  1003: APPROVED_DETAILS,
  1004: makeDetails({ ciState: "pending" }),
  1005: CHANGES_DETAILS,
  1006: COMMENT_DETAILS,
  1007: makeDetails({ reviewState: "approved" }),
};
