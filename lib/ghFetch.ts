// Direct GitHub API fetcher — no subprocess overhead.
// Uses `gh auth token` once to get the token, then makes direct HTTP calls.
// Much faster than exec('gh api ...') for parallel requests.

import { execSync } from "child_process";

let _token: string | null = null;
let _tokenFetchedAt = 0;
const TOKEN_TTL = 50 * 60 * 1000; // refresh token every 50 min

function getToken(): string {
  if (_token && Date.now() - _tokenFetchedAt < TOKEN_TTL) return _token;
  _token = execSync("gh auth token", { encoding: "utf8" }).trim();
  _tokenFetchedAt = Date.now();
  return _token;
}

export async function ghFetch(endpoint: string): Promise<unknown> {
  const token = getToken();
  const res = await fetch(`https://api.github.com/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status} ${endpoint}: ${body.slice(0, 200)}`);
  }
  return res.json();
}
