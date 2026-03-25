import fs from "fs";
import path from "path";

const GITHUB_USERNAME_RE =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/;
const GITHUB_REPO_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export interface AppConfig {
  myGitHubLogin: string;
  teammates: string[];
  repo: string;
  refreshIntervalMs: number;
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (_config) return _config;

  const configPath = path.join(process.cwd(), "config.json");

  if (!fs.existsSync(configPath)) {
    throw new Error(
      "config.json not found. Copy config.example.json to config.json and fill in your details."
    );
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as AppConfig;

  if (!GITHUB_USERNAME_RE.test(parsed.myGitHubLogin)) {
    throw new Error(
      `Invalid myGitHubLogin in config.json: "${parsed.myGitHubLogin}"`
    );
  }

  if (!GITHUB_REPO_RE.test(parsed.repo)) {
    throw new Error(`Invalid repo in config.json: "${parsed.repo}"`);
  }

  for (const handle of parsed.teammates) {
    if (!GITHUB_USERNAME_RE.test(handle)) {
      throw new Error(
        `Invalid teammate GitHub handle in config.json: "${handle}"`
      );
    }
  }

  if (
    typeof parsed.refreshIntervalMs !== "number" ||
    parsed.refreshIntervalMs < 10000
  ) {
    parsed.refreshIntervalMs = 120000;
  }

  _config = parsed;
  return _config;
}
