export type ReviewState = "approved" | "changes_requested" | "pending";
export type CiState = "success" | "failure" | "pending" | "unknown";
export type PrState = "draft" | "open" | "merged" | "closed";

export interface PrLabel {
  id: number;
  name: string;
  color: string;
}

export interface PrAuthor {
  login: string;
  avatarUrl: string;
}

export interface PrCardData {
  number: number;
  title: string;
  htmlUrl: string;
  state: PrState;
  author: PrAuthor;
  labels: PrLabel[];
  updatedAt: string;
}

export interface PrDetails {
  reviewState: ReviewState;
  ciState: CiState;
}

export interface MyPrsResponse {
  drafts: PrCardData[];
  active: PrCardData[];
  recentlyClosed: PrCardData[];
  lastFetchedAt: string;
}

export interface TeammatePrsResponse {
  byTeammate: Record<string, PrCardData[]>;
  lastFetchedAt: string;
}
