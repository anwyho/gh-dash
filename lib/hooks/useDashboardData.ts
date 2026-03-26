"use client";

import useSWR, { useSWRConfig } from "swr";
import { useCallback, useMemo } from "react";
import { fetcher } from "@/lib/fetcher";
import type {
  PrCardData, PrDetails,
  MyPrsResponse, TeammatePrsResponse, ReviewRequestsResponse,
} from "@/types/pr";

// Stable SWR keys — no syncKey suffix so all views share the same cache entries.
// Manual sync calls POST /api/cache/clear to bust server-side pr-details cache,
// then invalidates client SWR cache via mutate().
const KEYS = {
  myPrs: "/api/my-prs",
  teammatePrs: "/api/teammate-prs",
  reviewRequests: "/api/review-requests",
} as const;

interface DashboardData {
  myPrs: MyPrsResponse | undefined;
  tmPrs: TeammatePrsResponse | undefined;
  rvPrs: ReviewRequestsResponse | undefined;
  detailsMap: Record<number, PrDetails> | undefined;
  isLoading: boolean;
  refresh: () => void;
}

export function useDashboardData(refreshIntervalMs: number): DashboardData {
  const { mutate } = useSWRConfig();

  const { data: myPrs, isLoading: myLoad } =
    useSWR<MyPrsResponse>(KEYS.myPrs, fetcher, { refreshInterval: refreshIntervalMs });
  const { data: tmPrs, isLoading: tmLoad } =
    useSWR<TeammatePrsResponse>(KEYS.teammatePrs, fetcher, { refreshInterval: refreshIntervalMs });
  const { data: rvPrs, isLoading: rvLoad } =
    useSWR<ReviewRequestsResponse>(KEYS.reviewRequests, fetcher, { refreshInterval: refreshIntervalMs });

  // Collect all PR numbers for the batch details call
  const allNumbers = useMemo(() => {
    const nums = new Set<number>();
    myPrs?.drafts?.forEach(p => nums.add(p.number));
    myPrs?.active?.forEach(p => nums.add(p.number));
    myPrs?.recentlyClosed?.forEach(p => nums.add(p.number));
    rvPrs?.reviewRequests?.forEach(p => nums.add(p.number));
    tmPrs && Object.values(tmPrs.byTeammate).flat().forEach(p => nums.add(p.number));
    return [...nums];
  }, [myPrs, tmPrs, rvPrs]);

  const batchKey = allNumbers.length > 0
    ? `/api/pr-details-batch?numbers=${allNumbers.join(",")}`
    : null;

  const { data: detailsMap } = useSWR<Record<number, PrDetails>>(
    batchKey, fetcher,
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  const refresh = useCallback(() => {
    // 1. Bust server-side pr-details cache (10-min TTL bypass)
    fetch("/api/cache/clear", { method: "POST" }).catch(console.error);
    // 2. Invalidate all client SWR entries for this dashboard
    mutate(KEYS.myPrs);
    mutate(KEYS.teammatePrs);
    mutate(KEYS.reviewRequests);
    if (batchKey) mutate(batchKey);
  }, [mutate, batchKey]);

  return {
    myPrs,
    tmPrs,
    rvPrs,
    detailsMap,
    isLoading: myLoad || tmLoad || rvLoad,
    refresh,
  };
}
