import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getConfig } from "@/lib/config";
import { transformSearchItem } from "@/lib/transform";

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

    const data = await ghApi(
      `search/issues?q=repo:${repo}+is:pr+is:open+review-requested:${login}&per_page=30&sort=updated&order=desc`
    );

    const items = (data as { items: unknown[] }).items;

    return NextResponse.json({
      reviewRequests: items.map((item) =>
        transformSearchItem(
          item as Parameters<typeof transformSearchItem>[0]
        )
      ),
      lastFetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/review-requests]", err);
    return NextResponse.json(
      { error: "Failed to fetch review requests", details: String(err) },
      { status: 500 }
    );
  }
}
