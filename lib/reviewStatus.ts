import type { ReviewState } from "@/types/pr";

interface GhReview {
  state: string;
  user: { login: string };
}

export function computeReviewState(reviews: GhReview[]): ReviewState {
  // Last review per reviewer wins; COMMENTED and DISMISSED are ignored
  const latest: Record<string, "APPROVED" | "CHANGES_REQUESTED"> = {};

  for (const review of reviews) {
    if (review.state === "APPROVED" || review.state === "CHANGES_REQUESTED") {
      latest[review.user.login] = review.state;
    }
  }

  const states = Object.values(latest);
  if (states.includes("CHANGES_REQUESTED")) return "changes_requested";
  if (states.includes("APPROVED")) return "approved";
  return "pending";
}
