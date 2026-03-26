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
  draft:  "var(--state-draft)",
  open:   "var(--state-open)",
  merged: "var(--state-merged)",
  closed: "var(--state-closed)",
};

function cleanBody(body: string | null | undefined): string {
  if (!body) return "";
  return body
    .replace(/<!--[\s\S]*?-->/g, "")   // strip HTML comments
    .replace(/^#{1,6}\s+/gm, "")       // strip markdown headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // flatten links
    .trim();
}

// ── localStorage hooks ────────────────────────────────────────────────────────

function useLocalSet(key: string) {
  const [set, setSet] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as number[]); }
    catch { return new Set(); }
  });
  const add = useCallback((n: number) => setSet(prev => {
    const next = new Set(prev); next.add(n);
    localStorage.setItem(key, JSON.stringify([...next])); return next;
  }), [key]);
  const remove = useCallback((n: number) => setSet(prev => {
    const next = new Set(prev); next.delete(n);
    localStorage.setItem(key, JSON.stringify([...next])); return next;
  }), [key]);
  const clear = useCallback(() => {
    setSet(new Set()); localStorage.removeItem(key);
  }, [key]);
  return { set, add, remove, clear };
}

// ── Popover ────────────────────────────────────────────────────────────────────

interface PopoverInfo { pr: PrCardData; details: PrDetails | undefined; rect: DOMRect; }

function Popover({ info }: { info: PopoverInfo }) {
  const { pr, details, rect } = info;
  const W = 340, PAD = 10;
  const top = rect.bottom + PAD + 400 > (typeof window !== "undefined" ? window.innerHeight : 900)
    ? Math.max(PAD, rect.top - 400 - PAD) : rect.bottom + PAD;
  const left = Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth : 1440) - W - PAD);

  const body = cleanBody(pr.title && details?.body !== undefined ? details?.body : undefined);

  return (
    <div className="popover" style={{ top, left, width: W }} role="tooltip">
      <div className="popover-header">
        <span className="popover-number">#{pr.number}</span>
        <span className="popover-state" style={{ color: STATE_COLOR[pr.state] }}>{pr.state}</span>
        {pr.labels.map(l => (
          <span key={l.id} className="popover-label" style={{ background: `#${l.color}` }}>{l.name}</span>
        ))}
      </div>
      <p className="popover-title">{pr.title}</p>
      <div className="popover-meta">
        {[
          ["Author", `@${pr.author.login}`],
          ["Updated", formatDistanceToNow(new Date(pr.updatedAt), { addSuffix: true })],
          ["Opened", formatDistanceToNow(new Date(pr.createdAt), { addSuffix: true })],
          ...(details ? [
            ["Review", details.reviewState.replace("_", " ")],
            ["CI", details.ciState],
            ["Changes", `+${details.additions} −${details.deletions} · ${details.changedFiles} files`],
          ] : []),
        ].map(([l, v]) => (
          <div key={l} className="popover-row">
            <span className="popover-row-label">{l}</span>
            <span className="popover-row-value">{v}</span>
          </div>
        ))}
      </div>
      {details?.body && (
        <p className="popover-body">{cleanBody(details.body)}</p>
      )}
      <p className="popover-hint">Click to open on GitHub →</p>
    </div>
  );
}

// ── Card (fixed height, uniform) ──────────────────────────────────────────────

const CARD_H = 148; // px — every card is this height

interface CardProps {
  pr: PrCardData;
  details?: PrDetails;
  showUrgency?: boolean;
  starred: boolean;
  hidden: boolean;
  onHover: (info: PopoverInfo) => void;
  onHoverEnd: () => void;
  onStar: (n: number) => void;
  onHide: (n: number) => void;
}

function PrCard({ pr, details, showUrgency, starred, onHover, onHoverEnd, onStar, onHide }: CardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const dotColor = showUrgency ? ageColor(pr.createdAt) : STATE_COLOR[pr.state];
  const age = showUrgency ? ageLabel(pr.createdAt) : null;

  const reviewLabel =
    details?.reviewState === "approved" ? "✓" :
    details?.reviewState === "changes_requested" ? "✗" : null;
  const reviewColor =
    details?.reviewState === "approved" ? "var(--review-approved)" : "var(--review-changes)";
  const ciLabel =
    details?.ciState === "success" ? "◆" :
    details?.ciState === "failure" ? "◆" :
    details?.ciState === "pending" ? "◇" : null;
  const ciColor =
    details?.ciState === "success" ? "var(--ci-success)" :
    details?.ciState === "failure" ? "var(--ci-failure)" :
    "var(--ci-pending)";

  const body = cleanBody(details?.body);

  const handleEnter = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) onHover({ pr, details, rect });
  }, [pr, details, onHover]);

  return (
    <div className={`pr-card-wrap${starred ? " pr-card-wrap--starred" : ""}`}>
      <a
        ref={ref}
        href={pr.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`PR #${pr.number}: ${pr.title}`}
        className="pr-card"
        style={{ height: CARD_H }}
        onMouseEnter={handleEnter}
        onMouseLeave={onHoverEnd}
      >
        {/* Row 1 — meta */}
        <div className="pr-card-meta">
          <span className="pr-card-number">#{pr.number}</span>
          <div aria-hidden="true" className="pr-card-dot" style={{ background: dotColor }} />
          {age && <span className="pr-card-age" style={{ color: dotColor }}>{age}</span>}
          <span className="pr-card-badges">
            {reviewLabel && <span style={{ color: reviewColor, fontSize: 10, fontWeight: 700 }}>{reviewLabel}</span>}
            {ciLabel && <span style={{ color: ciColor, fontSize: 10 }}>{ciLabel}</span>}
          </span>
        </div>

        {/* Row 2 — title */}
        <div className="pr-card-title">{pr.title}</div>

        {/* Row 3 — description (fixed 3-line block) */}
        <div className="pr-card-desc">
          {body || <span className="pr-card-nodesc">No description</span>}
        </div>

        {/* Row 4 — footer */}
        <div className="pr-card-footer">
          <span className="pr-card-author">{pr.author.login}</span>
          {details && details.changedFiles > 0 && (
            <span className="pr-card-diff">
              <span style={{ color: "var(--add-color)" }}>+{details.additions}</span>
              <span style={{ color: "var(--text-muted)" }}>/</span>
              <span style={{ color: "var(--del-color)" }}>−{details.deletions}</span>
              <span style={{ color: "var(--text-muted)" }}> {details.changedFiles}f</span>
            </span>
          )}
        </div>
      </a>

      {/* Action buttons — outside <a> to avoid nested interactive elements */}
      <div className="pr-card-actions">
        <button
          type="button"
          className={`pr-card-star${starred ? " pr-card-star--on" : ""}`}
          aria-label={starred ? `Unstar PR #${pr.number}` : `Star PR #${pr.number}`}
          aria-pressed={starred}
          onClick={() => onStar(pr.number)}
        >
          {starred ? "★" : "☆"}
        </button>
        <button
          type="button"
          className="pr-card-hide"
          aria-label={`Hide PR #${pr.number}`}
          onClick={() => { onHoverEnd(); onHide(pr.number); }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Section grid ──────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  badge?: number;
  prs?: PrCardData[];
  detailsMap?: Record<number, PrDetails>;
  hidden: Set<number>;
  starred: Set<number>;
  isLoading: boolean;
  showUrgency?: boolean;
  emptyMsg?: string;
  labelColor?: string;
  onHover: (info: PopoverInfo) => void;
  onHoverEnd: () => void;
  onStar: (n: number) => void;
  onHide: (n: number) => void;
}

function GridSection({
  title, badge, prs, detailsMap, hidden, starred, isLoading,
  showUrgency, emptyMsg = "—", labelColor,
  onHover, onHoverEnd, onStar, onHide,
}: SectionProps) {
  const visible = prs?.filter(p => !hidden.has(p.number));
  const count = visible?.length ?? 0;
  const sortedVisible = visible
    ? [...visible].sort((a, b) => (starred.has(b.number) ? 1 : 0) - (starred.has(a.number) ? 1 : 0))
    : undefined;

  return (
    <section className="grid-section">
      <div className="grid-section-header">
        <span className="grid-section-title" style={{ color: labelColor }}>{title}</span>
        {!isLoading && count > 0 && <span className="grid-section-badge">{badge ?? count}</span>}
        <div className="grid-section-rule" />
      </div>
      {isLoading ? (
        <div className="pr-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="pr-card-skeleton" style={{ height: CARD_H }} aria-hidden="true" />
          ))}
        </div>
      ) : count === 0 ? (
        <p className="grid-empty">{emptyMsg}</p>
      ) : (
        <div className="pr-grid">
          {sortedVisible!.map(pr => (
            <PrCard
              key={pr.number}
              pr={pr}
              details={detailsMap?.[pr.number]}
              showUrgency={showUrgency}
              starred={starred.has(pr.number)}
              hidden={hidden.has(pr.number)}
              onHover={onHover}
              onHoverEnd={onHoverEnd}
              onStar={onStar}
              onHide={onHide}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Hidden section ─────────────────────────────────────────────────────────────

function HiddenDrawer({
  allPrs, detailsMap, hidden, starred, onShow, onClear, onStar,
}: {
  allPrs: PrCardData[];
  detailsMap?: Record<number, PrDetails>;
  hidden: Set<number>;
  starred: Set<number>;
  onShow: (n: number) => void;
  onClear: () => void;
  onStar: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const hiddenPrs = allPrs.filter(p => hidden.has(p.number));
  if (hiddenPrs.length === 0) return null;
  return (
    <div className="hidden-drawer">
      <button type="button" className="hidden-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{open ? "▾" : "▸"} Hidden ({hiddenPrs.length})</span>
        <button type="button" className="hidden-clear" onClick={e => { e.stopPropagation(); onClear(); }}>restore all</button>
      </button>
      {open && (
        <div className="hidden-list">
          {hiddenPrs.map(pr => (
            <div key={pr.number} className="hidden-row">
              <span className="hidden-num">#{pr.number}</span>
              <span className="hidden-title">{pr.title}</span>
              <button type="button" className={`hidden-star${starred.has(pr.number) ? " hidden-star--on" : ""}`} onClick={() => onStar(pr.number)}>{starred.has(pr.number) ? "★" : "☆"}</button>
              <button type="button" className="hidden-restore" onClick={() => onShow(pr.number)} aria-label={`Restore PR #${pr.number}`}>↩</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = "mine" | "review";

interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function ControlPanel({ refreshIntervalMs, myLogin, repo }: Props) {
  const [tab, setTab] = useState<Tab>("mine");
  const { myPrs, tmPrs, rvPrs, detailsMap, isLoading, refresh } = useDashboardData(refreshIntervalMs);
  const { set: hidden, add: hide, remove: show, clear: clearHidden } = useLocalSet("gh-dash:hidden-prs");
  const { set: starred, add: star, remove: unstar } = useLocalSet("gh-dash:starred-prs");
  const [popover, setPopover] = useState<PopoverInfo | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onHover = useCallback((info: PopoverInfo) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setPopover(info);
  }, []);
  const onHoverEnd = useCallback(() => {
    hideTimer.current = setTimeout(() => setPopover(null), 150);
  }, []);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const toggleStar = useCallback((n: number) => {
    starred.has(n) ? unstar(n) : star(n);
  }, [starred, star, unstar]);

  const reviewQueue = useMemo(() =>
    rvPrs?.reviewRequests
      ? [...rvPrs.reviewRequests].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      : undefined,
    [rvPrs]
  );

  const allPrs = useMemo(() => {
    const seen = new Set<number>(); const result: PrCardData[] = [];
    const add = (arr?: PrCardData[]) => arr?.forEach(p => { if (!seen.has(p.number)) { seen.add(p.number); result.push(p); } });
    add(myPrs?.active); add(myPrs?.drafts); add(myPrs?.recentlyClosed);
    add(rvPrs?.reviewRequests);
    tmPrs && Object.values(tmPrs.byTeammate).flat().forEach(p => { if (!seen.has(p.number)) { seen.add(p.number); result.push(p); } });
    return result;
  }, [myPrs, rvPrs, tmPrs]);

  const cardProps = { detailsMap, hidden, starred, isLoading: false, onHover, onHoverEnd, onStar: toggleStar, onHide: hide };
  const reviewVisibleCount = reviewQueue?.filter(p => !hidden.has(p.number)).length ?? 0;

  return (
    <div className="view-root">
      <NavBar repo={repo} onRefresh={refresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />

      {/* ── Tab bar ── */}
      <div className="tab-bar" role="tablist" aria-label="Dashboard views">
        <button
          role="tab" type="button"
          aria-selected={tab === "mine"}
          className={`tab-btn${tab === "mine" ? " tab-btn--active" : ""}`}
          onClick={() => setTab("mine")}
        >
          My PRs
          {!isLoading && myPrs && (
            <span className="tab-badge">
              {(myPrs.active?.filter(p => !hidden.has(p.number)).length ?? 0) +
               (myPrs.drafts?.filter(p => !hidden.has(p.number)).length ?? 0)}
            </span>
          )}
        </button>
        <button
          role="tab" type="button"
          aria-selected={tab === "review"}
          className={`tab-btn${tab === "review" ? " tab-btn--active" : ""}`}
          onClick={() => setTab("review")}
        >
          Review Queue
          {!isLoading && reviewVisibleCount > 0 && (
            <span className="tab-badge tab-badge--urgent">{reviewVisibleCount}</span>
          )}
        </button>
      </div>

      <main id="main-content" className="control-main">

        {/* ── My PRs tab ── */}
        {tab === "mine" && (
          <>
            {starred.size > 0 && (
              <GridSection title="Starred" badge={[...(myPrs?.active ?? []), ...(myPrs?.drafts ?? []), ...(myPrs?.recentlyClosed ?? [])].filter(p => starred.has(p.number) && !hidden.has(p.number)).length}
                prs={allPrs.filter(p => starred.has(p.number))}
                {...cardProps} isLoading={isLoading} labelColor="var(--warning)"
                emptyMsg="—"
              />
            )}
            <GridSection title="Active" prs={myPrs?.active} {...cardProps} isLoading={isLoading} labelColor="var(--success)" emptyMsg="No active PRs" />
            <GridSection title="Draft" prs={myPrs?.drafts} {...cardProps} isLoading={isLoading} emptyMsg="No drafts" />
            <GridSection title="Recently closed" prs={myPrs?.recentlyClosed} {...cardProps} isLoading={isLoading} emptyMsg="—" />
          </>
        )}

        {/* ── Review Queue tab ── */}
        {tab === "review" && (
          <>
            <GridSection
              title="Needs your review"
              prs={reviewQueue}
              {...cardProps} isLoading={rvPrs === undefined}
              showUrgency
              emptyMsg="Inbox zero"
              labelColor={reviewVisibleCount > 0 ? "var(--danger)" : undefined}
            />
            {tmPrs && Object.entries(tmPrs.byTeammate).map(([login, prs]) => (
              <GridSection key={login} title={`@${login}`} prs={prs} {...cardProps} isLoading={false} emptyMsg="—" />
            ))}
          </>
        )}

        <HiddenDrawer
          allPrs={allPrs} detailsMap={detailsMap}
          hidden={hidden} starred={starred}
          onShow={show} onClear={clearHidden} onStar={toggleStar}
        />
      </main>

      {popover && (
        <div onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }} onMouseLeave={onHoverEnd}>
          <Popover info={popover} />
        </div>
      )}

      <style>{`
        .view-root { height:100vh; display:flex; flex-direction:column; overflow:hidden; }

        /* Tab bar */
        .tab-bar { display:flex; gap:0; border-bottom:1px solid var(--border); background:var(--bg-subtle); padding:0 20px; flex-shrink:0; }
        .tab-btn { background:transparent; border:none; border-bottom:2px solid transparent; color:var(--text-secondary); cursor:pointer; font-size:12px; font-family:inherit; font-weight:500; padding:10px 14px; display:flex; align-items:center; gap:6px; transition:color .1s,border-color .1s; margin-bottom:-1px; }
        .tab-btn:hover { color:var(--text-primary); }
        .tab-btn--active { color:var(--text-primary); font-weight:600; border-bottom-color:var(--accent); }
        .tab-badge { font-family:'JetBrains Mono',monospace; font-size:10px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:0 6px; color:var(--text-secondary); }
        .tab-badge--urgent { background:var(--danger-dim); border-color:var(--danger); color:var(--danger); }

        .control-main { flex:1; overflow-y:auto; padding:20px 20px 48px; display:flex; flex-direction:column; gap:0; }

        /* Section */
        .grid-section { margin-bottom:24px; }
        .grid-section-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .grid-section-title { font-size:10px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--text-muted); }
        .grid-section-badge { font-size:10px; font-family:'JetBrains Mono',monospace; color:var(--text-muted); background:var(--bg-card); border:1px solid var(--border); border-radius:3px; padding:0 5px; line-height:16px; }
        .grid-section-rule { flex:1; height:1px; background:var(--border); }
        .grid-empty { font-size:12px; color:var(--text-muted); font-style:italic; padding:4px 0; }

        /* Grid */
        .pr-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:8px; }

        /* Skeleton */
        .pr-card-skeleton { border-radius:7px; background:var(--bg-card); border:1px solid var(--border); animation:pulse 1.5s ease infinite; }

        /* Card wrapper (for action buttons outside <a>) */
        .pr-card-wrap { position:relative; }
        .pr-card-wrap--starred .pr-card { border-left:3px solid var(--warning); }

        .pr-card {
          display:flex; flex-direction:column; justify-content:space-between;
          padding:10px 12px; padding-right:36px; /* room for action buttons */
          background:var(--bg-card); border:1px solid var(--border); border-radius:7px;
          text-decoration:none; cursor:pointer; overflow:hidden;
          transition:background .1s, border-color .1s;
          box-sizing:border-box; width:100%;
        }
        .pr-card:hover { background:var(--bg-card-hover); border-color:var(--border-strong); }

        /* Row 1: meta */
        .pr-card-meta { display:flex; align-items:center; gap:5px; flex-shrink:0; }
        .pr-card-number { font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600; color:var(--text-muted); flex-shrink:0; }
        .pr-card-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .pr-card-age { font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:700; flex-shrink:0; }
        .pr-card-badges { display:flex; align-items:center; gap:4px; margin-left:auto; flex-shrink:0; }

        /* Row 2: title */
        .pr-card-title { font-size:12px; font-weight:600; color:var(--text-primary); line-height:1.35; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; flex-shrink:0; }

        /* Row 3: description — flex:1 fills remaining space */
        .pr-card-desc { flex:1; overflow:hidden; font-size:11px; line-height:1.5; color:var(--text-secondary); display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; word-break:break-word; margin:3px 0; }
        .pr-card-nodesc { color:var(--text-muted); font-style:italic; }

        /* Row 4: footer */
        .pr-card-footer { display:flex; align-items:center; gap:6px; flex-shrink:0; }
        .pr-card-author { font-size:10px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:90px; }
        .pr-card-diff { font-family:'JetBrains Mono',monospace; font-size:9.5px; display:flex; gap:1px; }

        /* Action buttons */
        .pr-card-actions { position:absolute; top:6px; right:6px; display:flex; flex-direction:column; gap:2px; opacity:0; transition:opacity .1s; }
        .pr-card-wrap:hover .pr-card-actions { opacity:1; }
        .pr-card-star { background:transparent; border:none; cursor:pointer; font-size:13px; color:var(--text-muted); padding:1px 3px; border-radius:3px; line-height:1; transition:color .1s; }
        .pr-card-star:hover,.pr-card-star--on { color:var(--warning); }
        .pr-card-hide { background:transparent; border:none; cursor:pointer; font-size:14px; color:var(--text-muted); padding:0 3px; border-radius:3px; line-height:1; transition:color .1s; }
        .pr-card-hide:hover { color:var(--danger); }

        /* Popover */
        .popover { position:fixed; z-index:1000; background:var(--bg-card); border:1px solid var(--border-strong); border-radius:10px; padding:14px 16px; box-shadow:0 8px 32px rgba(0,0,0,.5); pointer-events:auto; }
        .popover-header { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
        .popover-number { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; color:var(--text-muted); }
        .popover-state { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; padding:1px 6px; border-radius:3px; }
        .popover-label { font-size:10px; font-weight:600; padding:1px 6px; border-radius:3px; color:#000; }
        .popover-title { font-size:13px; font-weight:600; color:var(--text-primary); line-height:1.45; margin-bottom:10px; }
        .popover-meta { display:flex; flex-direction:column; gap:3px; border-top:1px solid var(--border); padding-top:8px; margin-bottom:8px; }
        .popover-row { display:flex; justify-content:space-between; gap:12px; }
        .popover-row-label { font-size:11px; color:var(--text-muted); flex-shrink:0; }
        .popover-row-value { font-size:11px; color:var(--text-secondary); text-align:right; }
        .popover-body { font-size:11px; color:var(--text-secondary); line-height:1.55; border-top:1px solid var(--border); padding-top:8px; white-space:pre-wrap; word-break:break-word; max-height:200px; overflow-y:auto; }
        .popover-hint { font-size:10px; color:var(--accent); margin-top:8px; }

        /* Hidden drawer */
        .hidden-drawer { margin-top:8px; border-top:1px solid var(--border); padding-top:8px; }
        .hidden-toggle { display:flex; align-items:center; justify-content:space-between; width:100%; background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:11px; font-family:inherit; padding:4px 0; gap:8px; }
        .hidden-toggle:hover { color:var(--text-secondary); }
        .hidden-clear { font-size:10px; color:var(--accent); background:transparent; border:none; cursor:pointer; font-family:inherit; padding:0; margin-left:auto; }
        .hidden-clear:hover { text-decoration:underline; }
        .hidden-list { margin-top:6px; border:1px solid var(--border); border-radius:6px; overflow:hidden; }
        .hidden-row { display:flex; align-items:center; gap:8px; padding:6px 10px; border-bottom:1px solid var(--border); }
        .hidden-row:last-child { border-bottom:none; }
        .hidden-num { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--text-muted); width:50px; flex-shrink:0; }
        .hidden-title { font-size:12px; color:var(--text-secondary); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .hidden-star { background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:13px; padding:0 3px; }
        .hidden-star:hover,.hidden-star--on { color:var(--warning); }
        .hidden-restore { background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:13px; padding:0 4px; flex-shrink:0; }
        .hidden-restore:hover { color:var(--success); }
      `}</style>
    </div>
  );
}
