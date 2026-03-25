import type { CiState } from "@/types/pr";

interface GhCheckRun {
  status: string;
  conclusion: string | null;
}

const FAILURE_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "action_required",
  "cancelled",
]);

export function computeCiState(data: { check_runs: GhCheckRun[] }): CiState {
  const runs = data.check_runs ?? [];
  if (runs.length === 0) return "unknown";

  const hasInProgress = runs.some((r) => r.status !== "completed");
  if (hasInProgress) return "pending";

  const conclusions = runs.map((r) => r.conclusion ?? "");
  if (conclusions.some((c) => FAILURE_CONCLUSIONS.has(c))) return "failure";
  if (
    conclusions.every(
      (c) => c === "success" || c === "skipped" || c === "neutral"
    )
  )
    return "success";
  return "unknown";
}
