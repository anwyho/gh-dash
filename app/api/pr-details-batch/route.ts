import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { ghFetch } from "@/lib/ghFetch";
import { computeReviewState } from "@/lib/reviewStatus";
import { computeCiState } from "@/lib/ciStatus";
import { cached } from "@/lib/cache";
import type { PrDetails } from "@/types/pr";

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const CONCURRENCY = 8; // parallel GitHub API calls

async function fetchOnePr(repo: string, prNumber: number): Promise<PrDetails> {
  return cached(`pr-details:${repo}:${prNumber}`, CACHE_TTL, async () => {
    // Fetch PR (for head SHA) and reviews in parallel
    const [prData, reviewsData] = await Promise.all([
      ghFetch(`repos/${repo}/pulls/${prNumber}`),
      ghFetch(`repos/${repo}/pulls/${prNumber}/reviews`),
    ]);

    const pr = prData as {
      head: { sha: string };
      body: string | null;
      additions: number;
      deletions: number;
      changed_files: number;
      comments: number;
      review_comments: number;
    };
    if (!/^[0-9a-f]{40}$/i.test(pr.head.sha)) throw new Error("Invalid SHA");

    const checkRunsData = await ghFetch(
      `repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=50`
    );

    return {
      reviewState: computeReviewState(reviewsData as Parameters<typeof computeReviewState>[0]),
      ciState: computeCiState(checkRunsData as Parameters<typeof computeCiState>[0]),
      body: pr.body ?? null,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      commentCount: pr.comments,
      reviewComments: pr.review_comments,
    };
  });
}

async function runWithConcurrency<T>(
  items: number[],
  fn: (n: number) => Promise<T>,
  concurrency: number
): Promise<Record<number, T>> {
  const results: Record<number, T> = {};
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      chunk.map(async (n) => ({ n, result: await fn(n) }))
    );
    for (const r of settled) {
      if (r.status === "fulfilled") results[r.value.n] = r.value.result;
      // Silently skip failed PRs — partial results are better than none
    }
  }
  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Parse and validate PR numbers
  const raw = searchParams.get("numbers") ?? "";
  const numbers = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0 && n < 9_999_999);

  if (numbers.length === 0) {
    return NextResponse.json({});
  }
  if (numbers.length > 100) {
    return NextResponse.json({ error: "Too many PR numbers (max 100)" }, { status: 400 });
  }

  try {
    const { repo } = getConfig();
    const details = await runWithConcurrency(
      numbers,
      (n) => fetchOnePr(repo, n),
      CONCURRENCY
    );
    return NextResponse.json(details);
  } catch (err) {
    console.error("[/api/pr-details-batch]", err);
    return NextResponse.json(
      { error: "Failed to fetch PR details", details: String(err) },
      { status: 500 }
    );
  }
}
