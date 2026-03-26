"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
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

// ── Hidden PRs (localStorage) ─────────────────────────────────────────────────

const LS_KEY = "gh-dash:hidden-prs";

function useHiddenPrs() {
  const [hidden, setHidden] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(LS_KEY);
      return new Set(raw ? (JSON.parse(raw) as number[]) : []);
    } catch { return new Set(); }
  });

  const hide = useCallback((n: number) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.add(n);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const show = useCallback((n: number) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.delete(n);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setHidden(new Set());
    localStorage.removeItem(LS_KEY);
  }, []);

  return { hidden, hide, show, clearAll };
}

// ── Popover (fixed-position hover card) ───────────────────────────────────────

interface PopoverInfo {
  pr: PrCardData;
  details: PrDetails | undefined;
  rect: DOMRect;
}

function Popover({ info }: { info: PopoverInfo }) {
  const { pr, details, rect } = info;

  // Position: below chip by default, flip above if near bottom
  const POPOVER_H = 320;
  const POPOVER_W = 320;
  const PAD = 10;
  const top = rect.bottom + PAD + POPOVER_H > window.innerHeight
    ? Math.max(PAD, rect.top - POPOVER_H - PAD)
    : rect.bottom + PAD;
  const left = Math.min(rect.left, window.innerWidth - POPOVER_W - PAD);

  const reviewColor =
    details?.reviewState === "approved" ? "var(--review-approved)"
    : details?.reviewState === "changes_requested" ? "var(--review-changes)"
    : "var(--text-muted)";
  const ciColor =
    details?.ciState === "success" ? "var(--ci-success)"
    : details?.ciState === "failure" ? "var(--ci-failure)"
    : details?.ciState === "pending" ? "var(--ci-pending)"
    : "var(--text-muted)";

  const body = details?.body
    ?.replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  return (
    <div
      className="popover"
      style={{ top, left, width: POPOVER_W }}
      role="tooltip"
    >
      <div className="popover-header">
        <span className="popover-number">#{pr.number}</span>
        <span className="popover-state" style={{ color: STATE_COLOR[pr.state] ?? "var(--text-muted)" }}>
          {pr.state}
        </span>
        {pr.labels.map(l => (
          <span key={l.id} className="popover-label" style={{ background: `#${l.color}` }}>
            {l.name}
          </span>
        ))}
      </div>

      <p className="popover-title">{pr.title}</p>

      <div className="popover-meta">
        <Row label="Author" value={`@${pr.author.login}`} />
        <Row label="Updated" value={formatDistanceToNow(new Date(pr.updatedAt), { addSuffix: true })} />
        <Row label="Opened" value={formatDistanceToNow(new Date(pr.createdAt), { addSuffix: true })} />
        {details && (
          <>
            <Row
              label="Review"
              value={details.reviewState.replace("_", " ")}
              valueColor={reviewColor}
            />
            <Row
              label="CI"
              value={details.ciState}
              valueColor={ciColor}
            />
          </>
        )}
      </div>

      {body && (
        <p className="popover-body">{body.slice(0, 500)}{body.length > 500 ? "…" : ""}</p>
      )}

      <p className="popover-hint">Click to open on GitHub →</p>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="popover-row">
      <span className="popover-row-label">{label}</span>
      <span className="popover-row-value" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
    </div>
  );
}

// ── PrChip ────────────────────────────────────────────────────────────────────

interface PrChipProps {
  pr: PrCardData;
  showUrgency?: boolean;
  details?: PrDetails;
  onHover: (info: PopoverInfo) => void;
  onHoverEnd: () => void;
  onHide: (n: number) => void;
}

function PrChip({ pr, showUrgency, details, onHover, onHoverEnd, onHide }: PrChipProps) {
  const chipRef = useRef<HTMLAnchorElement>(null);
  const dotColor = showUrgency ? ageColor(pr.createdAt) : STATE_COLOR[pr.state];
  const age = showUrgency ? ageLabel(pr.createdAt) : null;

  const reviewLabel =
    details?.reviewState === "approved" ? "✓ approved"
    : details?.reviewState === "changes_requested" ? "✗ changes"
    : null;
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
    : "var(--ci-pending)";

  const handleMouseEnter = useCallback(() => {
    const rect = chipRef.current?.getBoundingClientRect();
    if (rect) onHover({ pr, details, rect });
  }, [pr, details, onHover]);

  return (
    <div className="pr-chip-wrap">
      <a
        ref={chipRef}
        href={pr.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`PR #${pr.number}: ${pr.title}`}
        className="pr-chip"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={onHoverEnd}
      >
        <div aria-hidden="true" className="pr-chip-dot" style={{ background: dotColor }} />
        <div className="pr-chip-body">
          <div className="pr-chip-header">
            <span className="pr-chip-number">#{pr.number}</span>
            {age && <span className="pr-chip-age" style={{ color: dotColor }}>{age}</span>}
          </div>
          <span className="pr-chip-title">{pr.title}</span>
          <div className="pr-chip-meta">
            <span className="pr-chip-author">{pr.author.login}</span>
            {reviewLabel && (
              <>
                <span aria-hidden="true" className="pr-chip-sep">·</span>
                <span className="pr-chip-status" style={{ color: reviewColor }}>{reviewLabel}</span>
              </>
            )}
            {ciLabel && (
              <>
                <span aria-hidden="true" className="pr-chip-sep">·</span>
                <span className="pr-chip-status" style={{ color: ciColor }}>{ciLabel}</span>
              </>
            )}
          </div>
        </div>
      </a>
      <button
        type="button"
        className="pr-chip-hide"
        aria-label={`Hide PR #${pr.number}`}
        onClick={e => { e.stopPropagation(); onHoverEnd(); onHide(pr.number); }}
        tabIndex={-1}
      >
        ×
      </button>
    </div>
  );
}

// ── Lane ──────────────────────────────────────────────────────────────────────

interface LaneProps {
  label: string;
  sublabel?: string;
  prs?: PrCardData[];
  detailsMap?: Record<number, PrDetails>;
  hiddenPrs: Set<number>;
  isLoading: boolean;
  showUrgency?: boolean;
  emptyMsg?: string;
  labelColor?: string;
  onHover: (info: PopoverInfo) => void;
  onHoverEnd: () => void;
  onHide: (n: number) => void;
}

function Lane({
  label, sublabel, prs, detailsMap, hiddenPrs, isLoading,
  showUrgency, emptyMsg = "—", labelColor,
  onHover, onHoverEnd, onHide,
}: LaneProps) {
  const visible = prs?.filter(p => !hiddenPrs.has(p.number));
  const count = visible?.length ?? 0;

  return (
    <div className="lane">
      <div className="lane-label-col">
        <div className="lane-label" style={{ color: labelColor ?? "var(--text-secondary)" }}>{label}</div>
        {sublabel && <div className="lane-sublabel">{sublabel}</div>}
        {!isLoading && count > 0 && <div className="lane-count">{count}</div>}
      </div>
      <div className="lane-chips" aria-label={label} aria-busy={isLoading}>
        {isLoading
          ? [1, 2, 3].map(i => <div key={i} aria-hidden="true" className="chip-skeleton" />)
          : count === 0
          ? <span className="lane-empty">{emptyMsg}</span>
          : visible!.map(pr => (
              <PrChip
                key={pr.number}
                pr={pr}
                showUrgency={showUrgency}
                details={detailsMap?.[pr.number]}
                onHover={onHover}
                onHoverEnd={onHoverEnd}
                onHide={onHide}
              />
            ))
        }
      </div>
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

// ── Hidden section ────────────────────────────────────────────────────────────

function HiddenSection({
  prs, detailsMap, hidden, onShow, onClear,
}: {
  prs: PrCardData[];
  detailsMap?: Record<number, PrDetails>;
  hidden: Set<number>;
  onShow: (n: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hiddenPrs = prs.filter(p => hidden.has(p.number));
  if (hiddenPrs.length === 0) return null;

  return (
    <div className="hidden-section">
      <button
        type="button"
        className="hidden-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{open ? "▾" : "▸"} Hidden ({hiddenPrs.length})</span>
        <button
          type="button"
          className="hidden-clear"
          onClick={e => { e.stopPropagation(); onClear(); }}
          aria-label="Restore all hidden PRs"
        >
          restore all
        </button>
      </button>
      {open && (
        <div className="hidden-chips">
          {hiddenPrs.map(pr => {
            const d = detailsMap?.[pr.number];
            return (
              <div key={pr.number} className="hidden-chip">
                <span className="hidden-chip-num">#{pr.number}</span>
                <span className="hidden-chip-title">{pr.title}</span>
                {d && (
                  <span
                    className="hidden-chip-status"
                    style={{
                      color: d.ciState === "success" ? "var(--ci-success)"
                        : d.ciState === "failure" ? "var(--ci-failure)" : "var(--text-muted)"
                    }}
                  >
                    {d.ciState === "success" ? "◆" : d.ciState === "failure" ? "◆" : "◇"}
                  </span>
                )}
                <button
                  type="button"
                  className="hidden-chip-restore"
                  onClick={() => onShow(pr.number)}
                  aria-label={`Restore PR #${pr.number}`}
                >
                  ↩
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function ControlPanel({ refreshIntervalMs, myLogin, repo }: Props) {
  const { myPrs, tmPrs, rvPrs, detailsMap, isLoading, refresh } = useDashboardData(refreshIntervalMs);
  const { hidden, hide, show, clearAll } = useHiddenPrs();
  const [popover, setPopover] = useState<PopoverInfo | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onHover = useCallback((info: PopoverInfo) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setPopover(info);
  }, []);

  const onHoverEnd = useCallback(() => {
    hideTimer.current = setTimeout(() => setPopover(null), 120);
  }, []);

  // Re-position popover when it re-renders (window resize)
  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const tmTotal = tmPrs
    ? Object.values(tmPrs.byTeammate).reduce((n, ps) => n + ps.length - ps.filter(p => hidden.has(p.number)).length, 0)
    : 0;

  const reviewQueue = useMemo(() =>
    rvPrs?.reviewRequests
      ? [...rvPrs.reviewRequests].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      : undefined,
    [rvPrs]
  );

  // All PRs for the hidden section
  const allPrs = useMemo(() => {
    const seen = new Set<number>();
    const result: PrCardData[] = [];
    const add = (arr?: PrCardData[]) => arr?.forEach(p => { if (!seen.has(p.number)) { seen.add(p.number); result.push(p); } });
    add(myPrs?.active); add(myPrs?.drafts); add(myPrs?.recentlyClosed);
    add(rvPrs?.reviewRequests);
    tmPrs && Object.values(tmPrs.byTeammate).flat().forEach(p => { if (!seen.has(p.number)) { seen.add(p.number); result.push(p); } });
    return result;
  }, [myPrs, rvPrs, tmPrs]);

  const laneProps = { detailsMap, hiddenPrs: hidden, isLoading, onHover, onHoverEnd, onHide: hide };

  return (
    <div className="view-root">
      <NavBar repo={repo} onRefresh={refresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />

      <main id="main-content" className="control-main">
        {/* ── @me first ── */}
        <Section title={`@${myLogin}`}>
          <Lane label="Active" prs={myPrs?.active} {...laneProps} emptyMsg="No active PRs" labelColor="var(--success)" />
          <Lane label="Draft" prs={myPrs?.drafts} {...laneProps} emptyMsg="No drafts" />
          <Lane label="Recently closed" prs={myPrs?.recentlyClosed} {...laneProps} emptyMsg="—" />
        </Section>

        <div className="section-gap" />

        {/* ── Review queue ── */}
        <Section title="Review queue" badge={reviewQueue?.filter(p => !hidden.has(p.number)).length ? String(reviewQueue!.filter(p => !hidden.has(p.number)).length) : undefined}>
          <Lane
            label="Needs your review"
            sublabel="oldest → most urgent"
            prs={reviewQueue}
            {...laneProps}
            showUrgency
            emptyMsg="Inbox zero"
            labelColor={reviewQueue?.some(p => !hidden.has(p.number)) ? "var(--danger)" : undefined}
          />
        </Section>

        <div className="section-gap" />

        {/* ── Team ── */}
        <Section title="Team" badge={tmTotal ? String(tmTotal) : undefined}>
          {isLoading
            ? [1, 2].map(i => <Lane key={i} label="…" {...laneProps} emptyMsg="" />)
            : tmPrs && Object.entries(tmPrs.byTeammate).map(([login, prs]) => (
                <Lane key={login} label={`@${login}`} prs={prs} {...laneProps} emptyMsg="—" />
              ))
          }
        </Section>

        <div className="section-gap" />

        {/* ── Hidden PRs ── */}
        <HiddenSection
          prs={allPrs}
          detailsMap={detailsMap}
          hidden={hidden}
          onShow={show}
          onClear={clearAll}
        />
      </main>

      {/* ── Floating popover ── */}
      {popover && (
        <div
          onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
          onMouseLeave={onHoverEnd}
        >
          <Popover info={popover} />
        </div>
      )}

      <style>{`
        .view-root { height:100vh; display:flex; flex-direction:column; overflow:hidden; }
        .control-main { flex:1; overflow-y:auto; padding:20px 24px 48px; }

        .section { margin-bottom:8px; }
        .section-header { display:flex; align-items:center; gap:8px; padding-bottom:10px; margin-bottom:4px; }
        .section-title { font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted); }
        .section-badge { font-size:10px; font-family:'JetBrains Mono',monospace; color:var(--text-muted); background:var(--bg-card); border:1px solid var(--border); border-radius:3px; padding:0 5px; line-height:16px; }
        .section-rule { flex:1; height:1px; background:var(--border); }
        .section-gap { height:24px; }

        .lane { display:flex; min-height:40px; margin-bottom:6px; }
        .lane-label-col { width:148px; flex-shrink:0; padding-top:8px; padding-right:16px; }
        .lane-label { font-size:11px; font-weight:600; letter-spacing:-.01em; }
        .lane-sublabel { font-size:10px; color:var(--text-muted); margin-top:2px; }
        .lane-count { font-size:10px; color:var(--text-muted); margin-top:3px; font-family:'JetBrains Mono',monospace; }
        .lane-chips { flex:1; display:flex; flex-wrap:wrap; gap:7px; padding-bottom:4px; align-items:flex-start; min-width:0; }
        .lane-empty { font-size:12px; color:var(--text-muted); padding-top:8px; font-style:italic; }

        .chip-skeleton { width:240px; height:64px; border-radius:7px; background:var(--bg-card); border:1px solid var(--border); animation:pulse 1.5s ease infinite; }

        /* Chip wrap — position:relative for hide button */
        .pr-chip-wrap { position:relative; display:inline-flex; }
        .pr-chip-hide { position:absolute; top:4px; right:4px; background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:14px; line-height:1; padding:1px 4px; border-radius:3px; opacity:0; transition:opacity .1s,color .1s; }
        .pr-chip-wrap:hover .pr-chip-hide { opacity:1; }
        .pr-chip-hide:hover { color:var(--danger); }

        .pr-chip { display:flex; gap:9px; padding:9px 11px; background:var(--bg-card); border:1px solid var(--border); border-radius:7px; width:240px; text-decoration:none; cursor:pointer; transition:background .1s,border-color .1s; }
        .pr-chip:hover { background:var(--bg-card-hover); border-color:var(--border-strong); }
        .pr-chip-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; margin-top:3px; }
        .pr-chip-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
        .pr-chip-header { display:flex; align-items:baseline; justify-content:space-between; gap:6px; }
        .pr-chip-number { font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; color:var(--text-muted); }
        .pr-chip-age { font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; flex-shrink:0; }
        .pr-chip-title { font-size:12px; font-weight:500; color:var(--text-primary); line-height:1.4; word-break:break-word; }
        .pr-chip-meta { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin-top:2px; }
        .pr-chip-author { font-size:11px; color:var(--text-secondary); }
        .pr-chip-sep { font-size:10px; color:var(--text-muted); }
        .pr-chip-status { font-size:10px; font-weight:600; letter-spacing:.02em; }

        /* Popover */
        .popover { position:fixed; z-index:1000; background:var(--bg-card); border:1px solid var(--border-strong); border-radius:10px; padding:14px 16px; box-shadow:0 8px 32px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.04); pointer-events:auto; }
        @media (prefers-color-scheme:light) { .popover { box-shadow:0 8px 32px rgba(0,0,0,.18); } }
        .popover-header { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
        .popover-number { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; color:var(--text-muted); }
        .popover-state { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; padding:1px 6px; border-radius:3px; }
        .popover-label { font-size:10px; font-weight:600; padding:1px 6px; border-radius:3px; color:#000; }
        .popover-title { font-size:13px; font-weight:500; color:var(--text-primary); line-height:1.45; margin-bottom:10px; word-break:break-word; }
        .popover-meta { display:flex; flex-direction:column; gap:3px; border-top:1px solid var(--border); padding-top:8px; margin-bottom:8px; }
        .popover-row { display:flex; justify-content:space-between; gap:12px; }
        .popover-row-label { font-size:11px; color:var(--text-muted); flex-shrink:0; }
        .popover-row-value { font-size:11px; color:var(--text-secondary); text-align:right; }
        .popover-body { font-size:11px; color:var(--text-secondary); line-height:1.55; border-top:1px solid var(--border); padding-top:8px; white-space:pre-wrap; word-break:break-word; max-height:160px; overflow-y:auto; }
        .popover-hint { font-size:10px; color:var(--accent); margin-top:8px; }

        /* Hidden section */
        .hidden-section { margin-top:8px; }
        .hidden-toggle { display:flex; align-items:center; justify-content:space-between; width:100%; background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:11px; font-family:inherit; padding:6px 0; gap:8px; }
        .hidden-toggle:hover { color:var(--text-secondary); }
        .hidden-clear { font-size:10px; color:var(--accent); background:transparent; border:none; cursor:pointer; font-family:inherit; padding:0; margin-left:auto; }
        .hidden-clear:hover { text-decoration:underline; }
        .hidden-chips { display:flex; flex-direction:column; gap:3px; margin-top:6px; border:1px solid var(--border); border-radius:6px; padding:8px; background:var(--bg-subtle); }
        .hidden-chip { display:flex; align-items:center; gap:8px; padding:3px 0; }
        .hidden-chip-num { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--text-muted); flex-shrink:0; width:52px; }
        .hidden-chip-title { font-size:12px; color:var(--text-muted); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-style:italic; }
        .hidden-chip-status { font-size:11px; flex-shrink:0; }
        .hidden-chip-restore { background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:13px; padding:0 4px; flex-shrink:0; }
        .hidden-chip-restore:hover { color:var(--success); }
      `}</style>
    </div>
  );
}
