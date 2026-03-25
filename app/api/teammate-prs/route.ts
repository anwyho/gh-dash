import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { getConfig } from "@/lib/config";
import { transformSearchItem } from "@/lib/transform";
import type { PrCardData } from "@/types/pr";

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
    const { teammates, repo } = getConfig();

    if (teammates.length === 0) {
      return NextResponse.json({
        byTeammate: {},
        lastFetchedAt: new Date().toISOString(),
      });
    }

    // All teammate handles are validated by getConfig().
    // Multiple author: qualifiers use OR semantics in GitHub search.
    const authorClauses = teammates.map((t) => `author:${t}`).join("+");
    const data = await ghApi(
      `search/issues?q=repo:${repo}+is:pr+is:open+${authorClauses}&per_page=30&sort=updated&order=desc`
    );

    const byTeammate: Record<string, PrCardData[]> = {};
    for (const item of (data as { items: unknown[] }).items) {
      const pr = transformSearchItem(item as Parameters<typeof transformSearchItem>[0]);
      const login = pr.author.login;
      if (!byTeammate[login]) byTeammate[login] = [];
      byTeammate[login].push(pr);
    }

    return NextResponse.json({
      byTeammate,
      lastFetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/teammate-prs]", err);
    return NextResponse.json(
      { error: "Failed to fetch teammate PRs", details: String(err) },
      { status: 500 }
    );
  }
}
