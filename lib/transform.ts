import type { PrCardData, PrState } from "@/types/pr";

// Shape returned by GitHub Search API items[]
interface GhSearchItem {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  user: { login: string; avatar_url: string };
  labels: { id: number; name: string; color: string }[];
  updated_at: string;
  pull_request?: { merged_at: string | null };
}

export function transformSearchItem(item: GhSearchItem): PrCardData {
  const mergedAt = item.pull_request?.merged_at ?? null;

  let state: PrState;
  if (item.draft) {
    state = "draft";
  } else if (item.state === "closed" && mergedAt) {
    state = "merged";
  } else if (item.state === "closed") {
    state = "closed";
  } else {
    state = "open";
  }

  return {
    number: item.number,
    title: item.title,
    htmlUrl: item.html_url,
    state,
    author: {
      login: item.user.login,
      avatarUrl: item.user.avatar_url,
    },
    labels: item.labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    })),
    updatedAt: item.updated_at,
  };
}
