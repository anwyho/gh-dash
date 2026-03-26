"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import type {
  PrCardData,
  MyPrsResponse,
  TeammatePrsResponse,
  ReviewRequestsResponse,
  PrDetails,
} from "@/types/pr";
import NavBar from "@/components/NavBar";
import useSWRImmutable from "swr/immutable";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  refreshIntervalMs: number;
  myLogin: string;
  repo: string;
}

// Urgency based on PR age in days
function urgencyColor(createdAt: string): string {
  const days = differenceInDays(new Date(), new Date(createdAt));
  if (days < 1) return "var(--state-open)";
  if (days < 3) return "var(--accent)";
  return "var(--state-closed)";
}

function urgencyLabel(createdAt: string): string {
  const days = differenceInDays(new Date(), new Date(createdAt));
  if (days < 1) return "today";
  if (days === 1) return "1d";
  return `${days}d`;
}

// ── Compact PR card used in swimlanes ──────────────────────────────────────

function PrChip({ pr, showAge = false }: { pr: PrCardData; showAge?: boolean }) {
  const { data: details } = useSWRImmutable<PrDetails>(
    `/api/pr-details?number=${pr.number}`,
    fetcher
  );
  const ageColor = urgencyColor(pr.createdAt);
  const ageLabel = urgencyLabel(pr.createdAt);
  const relTime = formatDistanceToNow(new Date(pr.updatedAt), { addSuffix: true });

  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`${pr.title}\nby @${pr.author.login}\nupdated ${relTime}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        textDecoration: "none",
        borderLeft: `3px solid ${showAge ? ageColor : "var(--border)"}`,
        borderTop: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        borderRadius: "0 4px 4px 0",
        padding: "7px 10px",
        background: "var(--bg-card)",
        minWidth: 180,
        maxWidth: 240,
        flexShrink: 0,
        transition: "background 0.12s, border-color 0.12s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-card-hover)";
        (e.currentTarget as HTMLAnchorElement).style.borderTopColor = "var(--border-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-card)";
        (e.currentTarget as HTMLAnchorElement).style.borderTopColor = "var(--border)";
      }}
    >
      {/* Row 1: number + age */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700 }}>
          #{pr.number}
        </span>
        {showAge && (
          <span style={{ fontSize: "0.6rem", color: ageColor, fontWeight: 600 }}>
            {ageLabel}
          </span>
        )}
      </div>

      {/* Row 2: title */}
      <span
        style={{
          fontSize: "0.72rem",
          color: "var(--text-primary)",
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {pr.title}
      </span>

      {/* Row 3: badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>
          @{pr.author.login}
        </span>
        {details && (
          <>
            <span
              style={{
                fontSize: "0.6rem",
                color:
                  details.reviewState === "approved"
                    ? "var(--review-approved)"
                    : details.reviewState === "changes_requested"
                    ? "var(--review-changes)"
                    : "var(--text-faint)",
                fontWeight: 600,
              }}
            >
              {details.reviewState === "approved"
                ? "✓"
                : details.reviewState === "changes_requested"
                ? "✗"
                : "?"}
            </span>
            <span
              style={{
                fontSize: "0.6rem",
                color:
                  details.ciState === "success"
                    ? "var(--ci-success)"
                    : details.ciState === "failure"
                    ? "var(--ci-failure)"
                    : details.ciState === "pending"
                    ? "var(--ci-pending)"
                    : "var(--text-faint)",
              }}
            >
              {details.ciState === "success"
                ? "◆"
                : details.ciState === "failure"
                ? "◆"
                : details.ciState === "pending"
                ? "◇"
                : "·"}
            </span>
          </>
        )}
      </div>
    </a>
  );
}

// ── Lane ──────────────────────────────────────────────────────────────────

interface LaneProps {
  label: string;
  prs: PrCardData[] | undefined;
  isLoading: boolean;
  showAge?: boolean;
  emptyMsg?: string;
  labelColor?: string;
  count?: number;
}

function Lane({ label, prs, isLoading, showAge = false, emptyMsg = "none", labelColor, count }: LaneProps) {
  const displayCount = count ?? prs?.length ?? 0;
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Lane header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: labelColor ?? "var(--text-muted)",
            flexShrink: 0,
            minWidth: 140,
          }}
        >
          {label}
        </span>
        {!isLoading && (
          <span
            style={{
              fontSize: "0.58rem",
              color: "var(--text-faint)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              padding: "0 5px",
              lineHeight: "16px",
            }}
          >
            {displayCount}
          </span>
        )}
        <div style={{ flex: 1, height: 1, background: "var(--border)", opacity: 0.4 }} />
      </div>

      {/* Horizontal scroll area */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 6,
          paddingLeft: 148, // align with label width
        }}
      >
        {isLoading &&
          [1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                minWidth: 180,
                height: 75,
                borderRadius: 4,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                animation: "pulse 1.5s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
          ))}

        {!isLoading && (!prs || prs.length === 0) && (
          <span style={{ fontSize: "0.68rem", color: "var(--text-faint)", fontStyle: "italic" }}>
            — {emptyMsg}
          </span>
        )}

        {!isLoading &&
          prs?.map((pr) => <PrChip key={pr.number} pr={pr} showAge={showAge} />)}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function ControlPanel({ refreshIntervalMs, myLogin, repo }: Props) {
  const {
    data: myPrs,
    error: myPrsErr,
    isLoading: myPrsLoading,
    mutate: mutateMyPrs,
  } = useSWR<MyPrsResponse>("/api/my-prs", fetcher, {
    refreshInterval: refreshIntervalMs,
  });

  const {
    data: teammatePrs,
    error: tmErr,
    isLoading: tmLoading,
    mutate: mutateTm,
  } = useSWR<TeammatePrsResponse>("/api/teammate-prs", fetcher, {
    refreshInterval: refreshIntervalMs,
  });

  const {
    data: reviewReqs,
    isLoading: reviewLoading,
    mutate: mutateReview,
  } = useSWR<ReviewRequestsResponse>("/api/review-requests", fetcher, {
    refreshInterval: refreshIntervalMs,
  });

  const handleRefresh = useCallback(() => {
    mutateMyPrs();
    mutateTm();
    mutateReview();
  }, [mutateMyPrs, mutateTm, mutateReview]);

  const isAnyLoading = myPrsLoading || tmLoading || reviewLoading;
  const lastFetchedAt = myPrs?.lastFetchedAt;

  // Sort review requests by age (oldest first = most urgent)
  const sortedReviewReqs = reviewReqs?.reviewRequests
    ? [...reviewReqs.reviewRequests].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    : undefined;

  // All teammate PRs flattened for a summary count
  const teammateTotal = teammatePrs
    ? Object.values(teammatePrs.byTeammate).reduce((n, prs) => n + prs.length, 0)
    : 0;

  return (
    <div style={{ minHeight: "100vh" }}>
      <NavBar
        repo={repo}
        onRefresh={handleRefresh}
        isLoading={isAnyLoading}
        lastFetchedAt={lastFetchedAt}
      />

      <main style={{ padding: "24px 24px 64px", maxWidth: 1600, margin: "0 auto" }}>
        {/* ── Section: Review Queue ── */}
        <section style={{ marginBottom: 36, paddingBottom: 28, borderBottom: "1px solid var(--border)" }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              review queue
            </span>
            {!reviewLoading && sortedReviewReqs && sortedReviewReqs.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: "0.6rem", color: "var(--state-closed)" }}>
                ← oldest first · left border = urgency
              </span>
            )}
          </div>
          <Lane
            label="needs your review"
            prs={sortedReviewReqs}
            isLoading={reviewLoading}
            showAge
            emptyMsg="inbox zero 🎉"
            labelColor="var(--state-closed)"
          />
        </section>

        {/* ── Section: My PRs ── */}
        <section style={{ marginBottom: 36, paddingBottom: 28, borderBottom: "1px solid var(--border)" }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              @{myLogin}
            </span>
          </div>
          <Lane
            label="active"
            prs={myPrs?.active}
            isLoading={myPrsLoading}
            emptyMsg="no active PRs"
            labelColor="var(--state-open)"
          />
          <Lane
            label="draft"
            prs={myPrs?.drafts}
            isLoading={myPrsLoading}
            emptyMsg="no drafts"
          />
          <Lane
            label="recently closed"
            prs={myPrs?.recentlyClosed}
            isLoading={myPrsLoading}
            emptyMsg="nothing closed recently"
          />
        </section>

        {/* ── Section: Team ── */}
        <section>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              team
            </span>
            {!tmLoading && (
              <span style={{ fontSize: "0.6rem", color: "var(--text-faint)" }}>
                {teammateTotal} open PRs
              </span>
            )}
          </div>
          {tmErr && (
            <p style={{ fontSize: "0.68rem", color: "var(--state-closed)", fontStyle: "italic" }}>
              ✕ failed to load
            </p>
          )}
          {!tmErr &&
            (tmLoading
              ? [1, 2].map((i) => (
                  <Lane key={i} label="..." prs={undefined} isLoading emptyMsg="" />
                ))
              : teammatePrs &&
                Object.entries(teammatePrs.byTeammate).map(([login, prs]) => (
                  <Lane
                    key={login}
                    label={`@${login}`}
                    prs={prs}
                    isLoading={false}
                    emptyMsg="no open PRs"
                  />
                )))}
          {!tmLoading && !tmErr && teammatePrs && Object.keys(teammatePrs.byTeammate).length === 0 && (
            <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", fontStyle: "italic" }}>
              — no open team PRs
            </p>
          )}
        </section>
      </main>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        ::-webkit-scrollbar { height: 4px; width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
      `}</style>
    </div>
  );
}
