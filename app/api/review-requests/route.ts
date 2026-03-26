import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getConfig } from "@/lib/config";
import { transformSearchItem } from "@/lib/transform";
import { cached } from "@/lib/cache";

const CACHE_TTL = 55_000;

const execAsync = promisify(exec);
const MAX_BUFFER = 20 * 1024 * 1024;

async function ghApi(endpoint: string): Promise<unknown> {
  const { stdout } = await execAsync(`gh api "${endpoint}"`, {
    maxBuffer: MAX_BUFFER,
  });
  return JSON.parse(stdout);
}

export async function GET() {
  try {
    const { myGitHubLogin: login, repo } = getConfig();

    const reviewRequests = await cached(`review-requests:${login}`, CACHE_TTL, async () => {
      const data = await ghApi(
        `search/issues?q=repo:${repo}+is:pr+is:open+review-requested:${login}&per_page=30&sort=updated&order=desc`
      );
      return (data as { items: unknown[] }).items.map((item) =>
        transformSearchItem(item as Parameters<typeof transformSearchItem>[0])
      );
    });

    return NextResponse.json({ reviewRequests, lastFetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[/api/review-requests]", err);
    return NextResponse.json(
      { error: "Failed to fetch review requests", details: String(err) },
      { status: 500 }
    );
  }
}
