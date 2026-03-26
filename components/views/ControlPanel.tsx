"use client";

import { useMemo } from "react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import type { PrCardData, PrDetails } from "@/types/pr";
import NavBar from "@/components/NavBar";
import { useDashboardData } from "@/lib/hooks/useDashboardData";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const STATE_COLOR: Record<string, string> = {
  draft: "var(--state-draft)",
  open: "var(--state-open)",
  merged: "var(--state-merged)",
  closed: "var(--state-closed)",
};

// ── PrChip ───────────────────────────────────────────────────────────────────

interface PrChipProps {
  pr: PrCardData;
  showUrgency?: boolean;
  details?: PrDetails;
}

function PrChip({ pr, showUrgency, details }: PrChipProps) {
  const dotColor = showUrgency ? ageColor(pr.createdAt) : STATE_COLOR[pr.state];
  const age = showUrgency ? ageLabel(pr.createdAt) : null;
  const rel = formatDistanceToNow(new Date(pr.updatedAt), { addSuffix: true });

  const reviewLabel =
    details?.reviewState === "approved" ? "✓ approved"
    : details?.reviewState === "changes_requested" ? "✗ changes"
    : "· review";
  const reviewColor =
    details?.reviewState === "approved" ? "var(--review-approved)"
    : details?.reviewState === "changes_requested" ? "var(--review-changes)"
    : "var(--text-muted)";
  const ciLabel =
    details?.ciState === "success" ? "CI ✓"
    : details?.ciState === "failure" ? "CI ✗"
    : details?.ciState === "pending" ? "CI …"
    : null;
  const ciColor =
    details?.ciState === "success" ? "var(--ci-success)"
    : details?.ciState === "failure" ? "var(--ci-failure)"
    : details?.ciState === "pending" ? "var(--ci-pending)"
    : "var(--text-muted)";

  const ageDesc = age ? `, open ${age}` : "";
  const statusDesc = details
    ? `, review ${details.reviewState.replace("_", " ")}, CI ${details.ciState}`
    : "";

  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`PR #${pr.number}: ${pr.title} by ${pr.author.login}${ageDesc}${statusDesc}`}
      className="pr-chip"
    >
      <div aria-hidden="true" className="pr-chip-dot" style={{ background: dotColor }} />
      <div className="pr-chip-body">
        <div className="pr-chip-header">
          <span className="pr-chip-number">#{pr.number}</span>
          {age && <span style={{ color: dotColor }} className="pr-chip-age">{age}</span>}
        </div>
        <span className="pr-chip-title">{pr.title}</span>
        <div className="pr-chip-meta">
          <span className="pr-chip-author">{pr.author.login}</span>
          {details && (
            <>
              <span aria-hidden="true" className="pr-chip-sep">·</span>
              <span style={{ color: reviewColor }} className="pr-chip-status">{reviewLabel}</span>
              {ciLabel && (
                <>
                  <span aria-hidden="true" className="pr-chip-sep">·</span>
                  <span style={{ color: ciColor }} className="pr-chip-status">{ciLabel}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Lane ─────────────────────────────────────────────────────────────────────

interface LaneProps {
  label: string;
  sublabel?: string;
  prs?: PrCardData[];
  detailsMap?: Record<number, PrDetails>;
  isLoading: boolean;
  showUrgency?: boolean;
  emptyMsg?: string;
  labelColor?: string;
}

function Lane({ label, sublabel, prs, detailsMap, isLoading, showUrgency, emptyMsg = "—", labelColor }: LaneProps) {
  const count = prs?.length ?? 0;
  return (
    <div className="lane">
      <div className="lane-label-col">
        <div className="lane-label" style={{ color: labelColor ?? "var(--text-secondary)" }}>{label}</div>
        {sublabel && <div className="lane-sublabel">{sublabel}</div>}
        {!isLoading && count > 0 && <div className="lane-count">{count}</div>}
      </div>
      <ul
        className="lane-chips"
        aria-label={label}
        aria-busy={isLoading}
        role="list"
      >
        {isLoading
          ? [1, 2, 3].map(i => <li key={i} aria-hidden="true" className="chip-skeleton" />)
          : count === 0
          ? <li className="lane-empty">{emptyMsg}</li>
          : prs!.map(pr => (
              <li key={pr.number}>
                <PrChip pr={pr} showUrgency={showUrgency} details={detailsMap?.[pr.number]} />
              </li>
            ))
        }
      </ul>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">{title}</span>
        {badge && <span className="section-badge">{badge}</span>}
        <div className="section-rule" />
      </div>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function ControlPanel({ refreshIntervalMs, myLogin, repo }: Props) {
  const { myPrs, tmPrs, rvPrs, detailsMap, isLoading, refresh } = useDashboardData(refreshIntervalMs);

  const tmTotal = tmPrs
    ? Object.values(tmPrs.byTeammate).reduce((n, ps) => n + ps.length, 0)
    : 0;

  const reviewQueue = useMemo(() =>
    rvPrs?.reviewRequests
      ? [...rvPrs.reviewRequests].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      : undefined,
    [rvPrs]
  );

  return (
    <div className="view-root">
      <NavBar repo={repo} onRefresh={refresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />
      <main id="main-content" className="control-main">

        <Section title="Review queue" badge={reviewQueue ? String(reviewQueue.length) : undefined}>
          <Lane
            label="Needs your review"
            sublabel="oldest → most urgent"
            prs={reviewQueue}
            detailsMap={detailsMap}
            isLoading={isLoading}
            showUrgency
            emptyMsg="Inbox zero"
            labelColor={reviewQueue?.length ? "var(--danger)" : undefined}
          />
        </Section>

        <div className="section-gap" />

        <Section title={`@${myLogin}`}>
          <Lane label="Active" prs={myPrs?.active} detailsMap={detailsMap} isLoading={isLoading} emptyMsg="No active PRs" labelColor="var(--success)" />
          <Lane label="Draft" prs={myPrs?.drafts} detailsMap={detailsMap} isLoading={isLoading} emptyMsg="No drafts" />
          <Lane label="Recently closed" prs={myPrs?.recentlyClosed} detailsMap={detailsMap} isLoading={isLoading} emptyMsg="—" />
        </Section>

        <div className="section-gap" />

        <Section title="Team" badge={tmTotal ? String(tmTotal) : undefined}>
          {isLoading
            ? [1, 2].map(i => <Lane key={i} label="…" isLoading emptyMsg="" />)
            : tmPrs && Object.entries(tmPrs.byTeammate).map(([login, prs]) => (
                <Lane key={login} label={`@${login}`} prs={prs} detailsMap={detailsMap} isLoading={false} emptyMsg="—" />
              ))
          }
        </Section>
      </main>

      <style>{`
        .view-root { height:100vh; display:flex; flex-direction:column; overflow:hidden; }
        .control-main { flex:1; overflow-y:auto; padding:20px 24px 48px; }

        .section { margin-bottom:8px; }
        .section-header { display:flex; align-items:center; gap:8px; padding-bottom:10px; margin-bottom:4px; }
        .section-title { font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted); }
        .section-badge { font-size:10px; font-family:'JetBrains Mono',monospace; color:var(--text-muted); background:rgba(255,255,255,.04); border:1px solid var(--border); border-radius:3px; padding:0 5px; line-height:16px; }
        .section-rule { flex:1; height:1px; background:var(--border); }
        .section-gap { height:24px; }
        @media (prefers-color-scheme:light) { .section-badge { background:rgba(0,0,0,.03); } }

        .lane { display:flex; min-height:56px; }
        .lane-label-col { width:160px; flex-shrink:0; padding-top:10px; padding-right:20px; }
        .lane-label { font-size:11px; font-weight:600; letter-spacing:-.01em; }
        .lane-sublabel { font-size:10px; color:var(--text-muted); margin-top:2px; }
        .lane-count { font-size:10px; color:var(--text-muted); margin-top:4px; font-family:'JetBrains Mono',monospace; }
        .lane-chips { flex:1; display:flex; gap:7px; overflow-x:auto; padding-bottom:8px; padding-top:2px; align-items:flex-start; min-width:0; list-style:none; }
        .lane-empty { font-size:12px; color:var(--text-muted); padding-top:10px; font-style:italic; }

        .chip-skeleton { min-width:200px; height:68px; border-radius:7px; background:var(--bg-card); border:1px solid var(--border); flex-shrink:0; animation:pulse 1.5s ease infinite; }

        .pr-chip { display:flex; gap:9px; padding:9px 11px; background:var(--bg-card); border:1px solid var(--border); border-radius:7px; min-width:200px; max-width:260px; flex-shrink:0; text-decoration:none; cursor:pointer; transition:background .1s,border-color .1s; }
        .pr-chip:hover { background:var(--bg-card-hover); border-color:var(--border-strong); }
        .pr-chip-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; margin-top:3px; }
        .pr-chip-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
        .pr-chip-header { display:flex; align-items:baseline; justify-content:space-between; gap:6px; }
        .pr-chip-number { font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; color:var(--text-muted); }
        .pr-chip-age { font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; flex-shrink:0; }
        .pr-chip-title { font-size:12px; font-weight:500; color:var(--text-primary); line-height:1.35; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
        .pr-chip-meta { display:flex; align-items:center; gap:7px; margin-top:1px; }
        .pr-chip-author { font-size:11px; color:var(--text-secondary); }
        .pr-chip-sep { font-size:10px; color:var(--text-muted); }
        .pr-chip-status { font-size:10px; font-weight:600; letter-spacing:.02em; }
      `}</style>
    </div>
  );
}
