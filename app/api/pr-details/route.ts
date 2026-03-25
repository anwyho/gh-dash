import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getConfig } from "@/lib/config";
import { computeReviewState } from "@/lib/reviewStatus";
import { computeCiState } from "@/lib/ciStatus";

const execAsync = promisify(exec);
const MAX_BUFFER = 10 * 1024 * 1024;

async function ghApi(endpoint: string): Promise<unknown> {
  const { stdout } = await execAsync(`gh api "${endpoint}"`, {
    maxBuffer: MAX_BUFFER,
  });
  return JSON.parse(stdout);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Validate PR number — only safe integer, no other input accepted
  const rawNumber = searchParams.get("number") ?? "";
  const prNumber = parseInt(rawNumber, 10);
  if (isNaN(prNumber) || prNumber <= 0 || prNumber > 9_999_999) {
    return NextResponse.json({ error: "Invalid PR number" }, { status: 400 });
  }

  try {
    const { repo } = getConfig();

    // Fetch full PR object and reviews in parallel.
    // SHA is resolved server-side from the PR object — never from the HTTP request.
    const [prData, reviewsData] = await Promise.all([
      ghApi(`repos/${repo}/pulls/${prNumber}`),
      ghApi(`repos/${repo}/pulls/${prNumber}/reviews`),
    ]);

    const sha = (prData as { head: { sha: string } }).head.sha;

    // Validate SHA format before use (it came from GitHub's own API response)
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      return NextResponse.json(
        { error: "Unexpected SHA format from GitHub" },
        { status: 502 }
      );
    }

    const checkRunsData = await ghApi(
      `repos/${repo}/commits/${sha}/check-runs?per_page=50`
    );

    return NextResponse.json({
      reviewState: computeReviewState(
        reviewsData as Parameters<typeof computeReviewState>[0]
      ),
      ciState: computeCiState(
        checkRunsData as Parameters<typeof computeCiState>[0]
      ),
    });
  } catch (err) {
    console.error("[/api/pr-details]", err);
    return NextResponse.json(
      { error: "Failed to fetch PR details", details: String(err) },
      { status: 500 }
    );
  }
}
