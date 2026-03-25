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

    // All path segments are hardcoded string literals.
    // login comes from config.json and is validated by getConfig().
    const [draftsRes, activeRes, closedRes] = await Promise.all([
      ghApi(
        `search/issues?q=repo:${repo}+is:pr+is:open+is:draft+author:${login}&per_page=30&sort=updated&order=desc`
      ),
      ghApi(
        `search/issues?q=repo:${repo}+is:pr+is:open+-is:draft+author:${login}&per_page=30&sort=updated&order=desc`
      ),
      ghApi(
        `search/issues?q=repo:${repo}+is:pr+is:closed+author:${login}&per_page=20&sort=updated&order=desc`
      ),
    ]);

    const r = (res: unknown) =>
      (res as { items: unknown[] }).items.map(
        (item) => transformSearchItem(item as Parameters<typeof transformSearchItem>[0])
      );

    return NextResponse.json({
      drafts: r(draftsRes),
      active: r(activeRes),
      recentlyClosed: r(closedRes),
      lastFetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/my-prs]", err);
    return NextResponse.json(
      { error: "Failed to fetch PRs", details: String(err) },
      { status: 500 }
    );
  }
}
