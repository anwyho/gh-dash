"use client";

import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import { useCallback } from "react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import type {
  PrCardData, PrDetails,
  MyPrsResponse, TeammatePrsResponse, ReviewRequestsResponse,
} from "@/types/pr";
import NavBar from "@/components/NavBar";
import { fetcher } from "@/lib/fetcher";

function ageColor(createdAt: string) {
  const d = differenceInDays(new Date(), new Date(createdAt));
  if (d < 1) return "var(--urgent-none)";
  if (d < 2) return "var(--urgent-low)";
  if (d < 4) return "var(--urgent-mid)";
  return "var(--urgent-high)";
}
function ageLabel(createdAt: string) {
  const d = differenceInDays(new Date(), new Date(createdAt));
  if (d === 0) return "today";
  if (d === 1) return "1d";
  return `${d}d`;
}

const STATE_DOT: Record<string, string> = {
  draft: "var(--state-draft)",
  open: "var(--state-open)",
  merged: "var(--state-merged)",
  closed: "var(--state-closed)",
};

// ── Compact PR chip ─────────────────────────────────────────────────────────

function PrChip({ pr, showUrgency = false }: { pr: PrCardData; showUrgency?: boolean }) {
  const { data: details } = useSWRImmutable<PrDetails>(
    `/api/pr-details?number=${pr.number}`, fetcher
  );
  const dotColor = showUrgency ? ageColor(pr.createdAt) : STATE_DOT[pr.state];
  const age = showUrgency ? ageLabel(pr.createdAt) : null;
  const rel = formatDistanceToNow(new Date(pr.updatedAt), { addSuffix: true });

  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`${pr.title}\n@${pr.author.login} · updated ${rel}`}
      style={{
        display: "flex",
        gap: 9,
        padding: "9px 11px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 7,
        minWidth: 200,
        maxWidth: 260,
        flexShrink: 0,
        textDecoration: "none",
        cursor: "pointer",
        transition: "background 0.1s, border-color 0.1s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = "var(--bg-card-hover)";
        el.style.borderColor = "var(--border-strong)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.background = "var(--bg-card)";
        el.style.borderColor = "var(--border)";
      }}
    >
      {/* Urgency / state dot */}
      <div style={{ paddingTop: 3, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        {/* PR number + age */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.01em" }}>
            #{pr.number}
          </span>
          {age && (
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 600, color: dotColor, flexShrink: 0 }}>
              {age}
            </span>
          )}
        </div>

        {/* Title */}
        <span style={{
          fontSize: 12, fontWeight: 500, color: "var(--text-primary)",
          lineHeight: 1.35, overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {pr.title}
        </span>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 1 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 400 }}>
            {pr.author.login}
          </span>
          {details && (
            <>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>·</span>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.02em",
                color: details.reviewState === "approved" ? "var(--review-approved)"
                  : details.reviewState === "changes_requested" ? "var(--review-changes)"
                  : "var(--text-muted)",
              }}>
                {details.reviewState === "approved" ? "✓ approved"
                  : details.reviewState === "changes_requested" ? "✗ changes"
                  : "· review"}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>·</span>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: details.ciState === "success" ? "var(--ci-success)"
                  : details.ciState === "failure" ? "var(--ci-failure)"
                  : details.ciState === "pending" ? "var(--ci-pending)"
                  : "var(--text-muted)",
              }}>
                {details.ciState === "success" ? "CI ✓"
                  : details.ciState === "failure" ? "CI ✗"
                  : details.ciState === "pending" ? "CI …"
                  : ""}
              </span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Lane ────────────────────────────────────────────────────────────────────

interface LaneProps {
  label: string;
  sublabel?: string;
  prs?: PrCardData[];
  isLoading: boolean;
  showUrgency?: boolean;
  emptyMsg?: string;
  labelColor?: string;
}

function Lane({ label, sublabel, prs, isLoading, showUrgency, emptyMsg = "—", labelColor }: LaneProps) {
  const count = prs?.length ?? 0;
  return (
    <div style={{ display: "flex", gap: 0, minHeight: 56 }}>
      {/* Fixed-width label column */}
      <div style={{ width: 160, flexShrink: 0, paddingTop: 10, paddingRight: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: labelColor ?? "var(--text-secondary)", letterSpacing: "-0.01em" }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sublabel}</div>
        )}
        {!isLoading && count > 0 && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, fontFamily: "JetBrains Mono, monospace" }}>
            {count}
          </div>
        )}
      </div>

      {/* Scrollable chips */}
      <div style={{
        flex: 1,
        display: "flex",
        gap: 7,
        overflowX: "auto",
        paddingBottom: 8,
        paddingTop: 2,
        paddingRight: 4,
        alignItems: "flex-start",
        minWidth: 0,
      }}>
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} style={{ minWidth: 200, height: 68, borderRadius: 7, background: "var(--bg-card)", border: "1px solid var(--border)", flexShrink: 0, animation: "pulse 1.5s ease infinite" }} />
        ))}
        {!isLoading && count === 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 10, fontStyle: "italic" }}>
            {emptyMsg}
          </span>
        )}
        {!isLoading && prs?.map(pr => (
          <PrChip key={pr.number} pr={pr} showUrgency={showUrgency} />
        ))}
      </div>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingBottom: 10, marginBottom: 4,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)",
            background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
            borderRadius: 3, padding: "0 5px", lineHeight: "16px",
          }}>
            {badge}
          </span>
        )}
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {children}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function ControlPanel({ refreshIntervalMs, myLogin, repo }: Props) {
  const { data: myPrs, isLoading: myLoad, mutate: mm } =
    useSWR<MyPrsResponse>("/api/my-prs", fetcher, { refreshInterval: refreshIntervalMs });
  const { data: tmPrs, isLoading: tmLoad, mutate: mt } =
    useSWR<TeammatePrsResponse>("/api/teammate-prs", fetcher, { refreshInterval: refreshIntervalMs });
  const { data: rvPrs, isLoading: rvLoad, mutate: mr } =
    useSWR<ReviewRequestsResponse>("/api/review-requests", fetcher, { refreshInterval: refreshIntervalMs });

  const handleRefresh = useCallback(() => { mm(); mt(); mr(); }, [mm, mt, mr]);

  const isLoading = myLoad || tmLoad || rvLoad;
  const lastFetchedAt = myPrs?.lastFetchedAt;

  const reviewQueue = rvPrs?.reviewRequests
    ? [...rvPrs.reviewRequests].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    : undefined;

  const tmTotal = tmPrs
    ? Object.values(tmPrs.byTeammate).reduce((n, ps) => n + ps.length, 0)
    : 0;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NavBar repo={repo} onRefresh={handleRefresh} isLoading={isLoading} lastFetchedAt={lastFetchedAt} />

      <main style={{ flex: 1, overflowY: "auto", padding: "20px 24px 48px" }}>

        {/* Review queue */}
        <Section title="Review queue" badge={reviewQueue ? String(reviewQueue.length) : undefined}>
          <Lane
            label="Needs your review"
            sublabel="oldest → most urgent"
            prs={reviewQueue}
            isLoading={rvLoad}
            showUrgency
            emptyMsg="Inbox zero"
            labelColor={reviewQueue && reviewQueue.length > 0 ? "var(--danger)" : "var(--text-secondary)"}
          />
        </Section>

        <div style={{ height: 24 }} />

        {/* My PRs */}
        <Section title={`@${myLogin}`}>
          <Lane label="Active" prs={myPrs?.active} isLoading={myLoad} emptyMsg="No active PRs" labelColor="var(--success)" />
          <Lane label="Draft" prs={myPrs?.drafts} isLoading={myLoad} emptyMsg="No drafts" />
          <Lane label="Recently closed" prs={myPrs?.recentlyClosed} isLoading={myLoad} emptyMsg="—" />
        </Section>

        <div style={{ height: 24 }} />

        {/* Team */}
        <Section title="Team" badge={tmTotal ? String(tmTotal) : undefined}>
          {tmLoad && [1, 2].map(i => (
            <Lane key={i} label="…" prs={undefined} isLoading emptyMsg="" />
          ))}
          {!tmLoad && tmPrs && Object.keys(tmPrs.byTeammate).length === 0 && (
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No open team PRs</span>
          )}
          {!tmLoad && tmPrs && Object.entries(tmPrs.byTeammate).map(([login, prs]) => (
            <Lane key={login} label={`@${login}`} prs={prs} isLoading={false} emptyMsg="—" />
          ))}
        </Section>
      </main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        ::-webkit-scrollbar { height: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
      `}</style>
    </div>
  );
}
