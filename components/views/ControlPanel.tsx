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
function isStale(pr: PrCardData) {
  return (pr.state === "open" || pr.state === "draft") &&
    differenceInDays(new Date(), new Date(pr.updatedAt)) >= 3;
}

const STATE_COLOR: Record<string, string> = {
  draft: "var(--state-draft)", open: "var(--state-open)",
  merged: "var(--state-merged)", closed: "var(--state-closed)",
};

/** Extract dependency PR numbers from body text */
function parseDeps(body: string | null | undefined): number[] {
  if (!body) return [];
  const pattern = /(?:blocked?\s+by|depends?\s+on|requires?|supersedes?|closes?)\s+#(\d+)/gi;
  const nums = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(body)) !== null) nums.add(parseInt(m[1], 10));
  return [...nums];
}

function cleanBody(body: string | null | undefined): string {
  if (!body) return "";
  return body.replace(/<!--[\s\S]*?-->/g, "").replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}

/** Fuzzy-ish search: all words must appear somewhere in the haystack */
function matchesSearch(pr: PrCardData, q: string): boolean {
  if (!q) return true;
  const hay = [
    pr.title, pr.author.login, String(pr.number),
    ...pr.labels.map(l => l.name),
  ].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

// ── localStorage set hook ─────────────────────────────────────────────────────

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
  const clear = useCallback(() => { setSet(new Set()); localStorage.removeItem(key); }, [key]);
  return { set, add, remove, clear };
}

// ── Popover ────────────────────────────────────────────────────────────────────

interface PopoverInfo { pr: PrCardData; details: PrDetails | undefined; rect: DOMRect; }

function Popover({ info }: { info: PopoverInfo }) {
  const { pr, details, rect } = info;
  const W = 340, PAD = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  const top = rect.bottom + PAD + 420 > vh ? Math.max(PAD, rect.top - 420 - PAD) : rect.bottom + PAD;
  const left = Math.min(rect.left, vw - W - PAD);
  const body = cleanBody(details?.body);
  const deps = parseDeps(details?.body);

  const reviewColor = details?.reviewState === "approved" ? "var(--review-approved)"
    : details?.reviewState === "changes_requested" ? "var(--review-changes)" : "var(--text-muted)";
  const ciColor = details?.ciState === "success" ? "var(--ci-success)"
    : details?.ciState === "failure" ? "var(--ci-failure)"
    : details?.ciState === "pending" ? "var(--ci-pending)" : "var(--text-muted)";

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
            ["Changes", `+${details.additions} / −${details.deletions} · ${details.changedFiles} files`],
            ...(details.reviewComments > 0 || details.commentCount > 0
              ? [[
                  "Comments",
                  [
                    details.reviewComments > 0 && `${details.reviewComments} review`,
                    details.commentCount > 0 && `${details.commentCount} general`,
                  ].filter(Boolean).join(" · "),
                ]]
              : []),
          ] : []),
        ].map(([l, v]) => (
          <div key={l} className="popover-row">
            <span className="popover-row-label">{l}</span>
            <span className="popover-row-value" style={{
              color: l === "Review" ? reviewColor : l === "CI" ? ciColor : undefined,
            }}>{v}</span>
          </div>
        ))}
      </div>
      {deps.length > 0 && (
        <div className="popover-deps">
          <span className="popover-deps-label">Deps</span>
          {deps.map(n => (
            <a key={n} className="popover-dep-pill" href={`https://github.com/${pr.htmlUrl.split("/").slice(3, 5).join("/")}/pull/${n}`} target="_blank" rel="noopener noreferrer">#{n}</a>
          ))}
        </div>
      )}
      {body && <p className="popover-body">{body}</p>}
      <p className="popover-hint">Click to open on GitHub →</p>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  pr: PrCardData;
  details?: PrDetails;
  showUrgency?: boolean;
  starred: boolean;
  focused: boolean;
  onHover: (info: PopoverInfo) => void;
  onHoverEnd: () => void;
  onStar: (n: number) => void;
  onHide: (n: number) => void;
  cardRef?: (el: HTMLElement | null) => void;
}

function PrCard({ pr, details, showUrgency, starred, focused, onHover, onHoverEnd, onStar, onHide, cardRef }: CardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const dotColor = showUrgency ? ageColor(pr.createdAt) : STATE_COLOR[pr.state];
  const age = showUrgency ? ageLabel(pr.createdAt) : null;
  const stale = isStale(pr);
  const deps = parseDeps(details?.body);

  const reviewLabel = details?.reviewState === "approved" ? "✓ apr"
    : details?.reviewState === "changes_requested" ? "✗ chg" : null;
  const reviewColor = details?.reviewState === "approved" ? "var(--review-approved)"
    : details?.reviewState === "changes_requested" ? "var(--review-changes)" : "var(--text-muted)";
  const ciLabel = details?.ciState === "success" ? "◆" : details?.ciState === "failure" ? "◆"
    : details?.ciState === "pending" ? "◇" : null;
  const ciColor = details?.ciState === "success" ? "var(--ci-success)"
    : details?.ciState === "failure" ? "var(--ci-failure)" : "var(--ci-pending)";
  const totalComments = (details?.reviewComments ?? 0) + (details?.commentCount ?? 0);

  const handleEnter = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) onHover({ pr, details, rect });
  }, [pr, details, onHover]);

  return (
    <div
      className={[
        "pr-card-wrap",
        starred ? "pr-card-wrap--starred" : "",
        focused ? "pr-card-wrap--focused" : "",
      ].filter(Boolean).join(" ")}
      ref={el => cardRef?.(el)}
    >
      <a
        ref={ref}
        href={pr.htmlUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`PR #${pr.number}: ${pr.title}`}
        className="pr-card"
        onMouseEnter={handleEnter}
        onMouseLeave={onHoverEnd}
      >
        {/* Row 1: meta */}
        <div className="pr-card-meta">
          <span className="pr-card-number">#{pr.number}</span>
          <div aria-hidden="true" className="pr-card-dot" style={{ background: dotColor }} />
          {age && <span className="pr-card-age" style={{ color: dotColor }}>{age}</span>}
          {stale && <span className="pr-card-stale" title="No activity for 3+ days">stale</span>}
          <span className="pr-card-badges">
            {reviewLabel && <span style={{ color: reviewColor }} className="pr-card-badge-text">{reviewLabel}</span>}
            {ciLabel && <span style={{ color: ciColor }} className="pr-card-badge-icon">{ciLabel}</span>}
          </span>
        </div>

        {/* Row 2: full title (wraps) */}
        <div className="pr-card-title">{pr.title}</div>

        {/* Row 3: dependency pills (if any) */}
        {deps.length > 0 && (
          <div className="pr-card-deps" onClick={e => e.preventDefault()}>
            {deps.map(n => (
              <a key={n} className="pr-card-dep" href={`${pr.htmlUrl.replace(/\/pull\/\d+$/, "")}/pull/${n}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                ⤳ #{n}
              </a>
            ))}
          </div>
        )}

        {/* Row 4: footer — star left, stats center, comments right */}
        <div className="pr-card-footer">
          <button
            type="button"
            className={`pr-card-star${starred ? " pr-card-star--on" : ""}`}
            aria-label={starred ? `Unstar PR #${pr.number}` : `Star PR #${pr.number}`}
            aria-pressed={starred}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onStar(pr.number); }}
          >
            {starred ? "★" : "☆"}
          </button>

          <span className="pr-card-author">{pr.author.login}</span>

          {details && details.changedFiles > 0 && (
            <span className="pr-card-diff">
              <span style={{ color: "var(--add-color)" }}>+{details.additions}</span>
              <span className="pr-card-diff-sep">/</span>
              <span style={{ color: "var(--del-color)" }}>−{details.deletions}</span>
              <span className="pr-card-diff-sep">·</span>
              <span style={{ color: "var(--text-muted)" }}>{details.changedFiles}f</span>
            </span>
          )}

          {totalComments > 0 && (
            <span className="pr-card-comments" title={[
              details?.reviewComments ? `${details.reviewComments} review` : "",
              details?.commentCount ? `${details.commentCount} general` : "",
            ].filter(Boolean).join(", ")}>
              💬 {totalComments}
            </span>
          )}
        </div>
      </a>

      {/* Hide button — top-right, shown on hover, separate from star */}
      <button
        type="button"
        className="pr-card-hide"
        aria-label={`Hide PR #${pr.number}`}
        onClick={() => { onHoverEnd(); onHide(pr.number); }}
        tabIndex={-1}
        title="Hide this PR"
      >
        ×
      </button>
    </div>
  );
}

// ── Section grid ──────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  prs?: PrCardData[];
  detailsMap?: Record<number, PrDetails>;
  hidden: Set<number>;
  starred: Set<number>;
  focusedPr: number | null;
  isLoading: boolean;
  showUrgency?: boolean;
  emptyMsg?: string;
  labelColor?: string;
  searchQuery: string;
  onHover: (info: PopoverInfo) => void;
  onHoverEnd: () => void;
  onStar: (n: number) => void;
  onHide: (n: number) => void;
  registerRef: (n: number, el: HTMLElement | null) => void;
}

function GridSection({ title, prs, detailsMap, hidden, starred, focusedPr, isLoading, showUrgency, emptyMsg = "—", labelColor, searchQuery, onHover, onHoverEnd, onStar, onHide, registerRef }: SectionProps) {
  const visible = useMemo(() =>
    prs?.filter(p => !hidden.has(p.number) && matchesSearch(p, searchQuery))
      .sort((a, b) => (starred.has(b.number) ? 1 : 0) - (starred.has(a.number) ? 1 : 0)),
    [prs, hidden, starred, searchQuery]
  );
  const count = visible?.length ?? 0;
  if (!isLoading && count === 0 && !searchQuery) return (
    <section className="grid-section">
      <div className="grid-section-header">
        <span className="grid-section-title" style={{ color: labelColor }}>{title}</span>
        <div className="grid-section-rule" />
      </div>
      <p className="grid-empty">{emptyMsg}</p>
    </section>
  );
  if (!isLoading && count === 0 && searchQuery) return null;
  return (
    <section className="grid-section">
      <div className="grid-section-header">
        <span className="grid-section-title" style={{ color: labelColor }}>{title}</span>
        {!isLoading && count > 0 && <span className="grid-section-badge">{count}</span>}
        <div className="grid-section-rule" />
      </div>
      {isLoading ? (
        <div className="pr-grid">{[1,2,3,4].map(i => <div key={i} className="pr-card-skeleton" aria-hidden="true" />)}</div>
      ) : (
        <div className="pr-grid">
          {visible!.map(pr => (
            <PrCard key={pr.number} pr={pr} details={detailsMap?.[pr.number]}
              showUrgency={showUrgency} starred={starred.has(pr.number)} focused={focusedPr === pr.number}
              onHover={onHover} onHoverEnd={onHoverEnd} onStar={onStar} onHide={onHide}
              cardRef={el => registerRef(pr.number, el)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Hidden drawer ─────────────────────────────────────────────────────────────

function HiddenDrawer({ allPrs, detailsMap, hidden, starred, onShow, onClear, onStar }: {
  allPrs: PrCardData[]; detailsMap?: Record<number, PrDetails>;
  hidden: Set<number>; starred: Set<number>;
  onShow: (n: number) => void; onClear: () => void; onStar: (n: number) => void;
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

// ── Keyboard shortcut help ────────────────────────────────────────────────────

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="shortcut-overlay" onClick={onClose}>
      <div className="shortcut-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcut-header">
          <span>Keyboard shortcuts</span>
          <button type="button" onClick={onClose} className="shortcut-close">×</button>
        </div>
        {[
          ["/", "Focus search"],
          ["j / ↓", "Next PR"],
          ["k / ↑", "Previous PR"],
          ["o / Enter", "Open PR in GitHub"],
          ["s", "Star / unstar PR"],
          ["h", "Hide PR"],
          ["1", "My PRs tab"],
          ["2", "Review Queue tab"],
          ["Esc", "Clear search / close"],
          ["?", "Show this help"],
        ].map(([key, desc]) => (
          <div key={key} className="shortcut-row">
            <kbd className="shortcut-key">{key}</kbd>
            <span className="shortcut-desc">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = "mine" | "review";
interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function ControlPanel({ refreshIntervalMs, myLogin, repo }: Props) {
  const [tab, setTab] = useState<Tab>("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedPr, setFocusedPr] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());

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

  const toggleStar = useCallback((n: number) => { starred.has(n) ? unstar(n) : star(n); }, [starred, star, unstar]);
  const registerRef = useCallback((n: number, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(n, el); else cardRefs.current.delete(n);
  }, []);

  // Flat ordered list of all visible PRs for keyboard nav
  const visiblePrNumbers = useMemo(() => {
    const all: PrCardData[] = tab === "mine"
      ? [...(myPrs?.active ?? []), ...(myPrs?.drafts ?? []), ...(myPrs?.recentlyClosed ?? [])]
      : [...(rvPrs?.reviewRequests ?? []), ...Object.values(tmPrs?.byTeammate ?? {}).flat()];
    return all.filter(p => !hidden.has(p.number) && matchesSearch(p, searchQuery)).map(p => p.number);
  }, [tab, myPrs, rvPrs, tmPrs, hidden, searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = document.activeElement?.tagName === "INPUT";
      if (e.key === "?" && !inInput) { setShowHelp(s => !s); return; }
      if (e.key === "Escape") {
        if (showHelp) { setShowHelp(false); return; }
        if (searchQuery) { setSearchQuery(""); searchRef.current?.blur(); return; }
        setFocusedPr(null); return;
      }
      if (e.key === "/" && !inInput) { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "1" && !inInput) { setTab("mine"); return; }
      if (e.key === "2" && !inInput) { setTab("review"); return; }
      if (inInput) return;

      const idx = focusedPr !== null ? visiblePrNumbers.indexOf(focusedPr) : -1;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(idx + 1, visiblePrNumbers.length - 1);
        const n = visiblePrNumbers[next];
        setFocusedPr(n ?? null);
        if (n) cardRefs.current.get(n)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(idx - 1, 0);
        const n = visiblePrNumbers[prev];
        setFocusedPr(n ?? null);
        if (n) cardRefs.current.get(n)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      if (focusedPr === null) return;
      const pr = [...(myPrs?.active ?? []), ...(myPrs?.drafts ?? []), ...(myPrs?.recentlyClosed ?? []),
        ...(rvPrs?.reviewRequests ?? []), ...Object.values(tmPrs?.byTeammate ?? {}).flat()]
        .find(p => p.number === focusedPr);
      if (!pr) return;
      if (e.key === "o" || e.key === "Enter") { window.open(pr.htmlUrl, "_blank"); return; }
      if (e.key === "s") { toggleStar(focusedPr); return; }
      if (e.key === "h") { hide(focusedPr); setFocusedPr(null); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedPr, visiblePrNumbers, searchQuery, showHelp, myPrs, rvPrs, tmPrs, toggleStar, hide]);

  const reviewQueue = useMemo(() =>
    rvPrs?.reviewRequests ? [...rvPrs.reviewRequests].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)) : undefined,
    [rvPrs]
  );
  const allPrs = useMemo(() => {
    const seen = new Set<number>(); const result: PrCardData[] = [];
    const add = (arr?: PrCardData[]) => arr?.forEach(p => { if (!seen.has(p.number)) { seen.add(p.number); result.push(p); } });
    add(myPrs?.active); add(myPrs?.drafts); add(myPrs?.recentlyClosed); add(rvPrs?.reviewRequests);
    tmPrs && Object.values(tmPrs.byTeammate).flat().forEach(p => { if (!seen.has(p.number)) { seen.add(p.number); result.push(p); } });
    return result;
  }, [myPrs, rvPrs, tmPrs]);

  const reviewCount = reviewQueue?.filter(p => !hidden.has(p.number)).length ?? 0;
  const sectionProps = { detailsMap, hidden, starred, focusedPr, isLoading: false, searchQuery, onHover, onHoverEnd, onStar: toggleStar, onHide: hide, registerRef };

  return (
    <div className="view-root">
      <NavBar repo={repo} onRefresh={refresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />

      {/* Tab bar */}
      <div className="tab-bar" role="tablist">
        {([["mine", "My PRs", (myPrs?.active?.filter(p => !hidden.has(p.number)).length ?? 0) + (myPrs?.drafts?.filter(p => !hidden.has(p.number)).length ?? 0), false] as const,
          ["review", "Review Queue", reviewCount, reviewCount > 0] as const]).map(([id, label, count, urgent]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id}
            className={`tab-btn${tab === id ? " tab-btn--active" : ""}`}
            onClick={() => setTab(id)}>
            {label}
            {!isLoading && count > 0 && <span className={`tab-badge${urgent ? " tab-badge--urgent" : ""}`}>{count}</span>}
          </button>
        ))}
        <button type="button" className="tab-help-btn" onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)" aria-label="Show keyboard shortcuts">?</button>
      </div>

      {/* Search bar */}
      <div className="search-bar">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          ref={searchRef}
          type="search"
          className="search-input"
          placeholder="Search by title, author, label, #number…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="Search PRs"
        />
        {searchQuery && <button type="button" className="search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">×</button>}
        {focusedPr && <span className="search-focus-hint">PR #{focusedPr} focused · j/k to navigate</span>}
      </div>

      <main id="main-content" className="control-main">
        {tab === "mine" && (
          <>
            {starred.size > 0 && (
              <GridSection title="Starred" labelColor="var(--warning)"
                prs={allPrs.filter(p => starred.has(p.number))} {...sectionProps} emptyMsg="—" />
            )}
            <GridSection title="Active" labelColor="var(--success)" prs={myPrs?.active} {...sectionProps} isLoading={isLoading} emptyMsg="No active PRs" />
            <GridSection title="Draft" prs={myPrs?.drafts} {...sectionProps} isLoading={isLoading} emptyMsg="No drafts" />
            <GridSection title="Recently closed" prs={myPrs?.recentlyClosed} {...sectionProps} isLoading={isLoading} emptyMsg="—" />
          </>
        )}
        {tab === "review" && (
          <>
            <GridSection title="Needs your review" labelColor={reviewCount > 0 ? "var(--danger)" : undefined}
              prs={reviewQueue} {...sectionProps} isLoading={rvPrs === undefined} showUrgency emptyMsg="Inbox zero" />
            {tmPrs && Object.entries(tmPrs.byTeammate).map(([login, prs]) => (
              <GridSection key={login} title={`@${login}`} prs={prs} {...sectionProps} emptyMsg="—" />
            ))}
          </>
        )}
        <HiddenDrawer allPrs={allPrs} detailsMap={detailsMap} hidden={hidden} starred={starred}
          onShow={show} onClear={clearHidden} onStar={toggleStar} />
      </main>

      {popover && (
        <div onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }} onMouseLeave={onHoverEnd}>
          <Popover info={popover} />
        </div>
      )}
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}

      <style>{`
        .view-root{height:100vh;display:flex;flex-direction:column;overflow:hidden;}
        /* Tab bar */
        .tab-bar{display:flex;align-items:center;gap:0;border-bottom:1px solid var(--border);background:var(--bg-subtle);padding:0 20px;flex-shrink:0;}
        .tab-btn{background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);cursor:pointer;font-size:12px;font-family:inherit;font-weight:500;padding:10px 14px;display:flex;align-items:center;gap:6px;transition:color .1s,border-color .1s;margin-bottom:-1px;}
        .tab-btn:hover{color:var(--text-primary);}
        .tab-btn--active{color:var(--text-primary);font-weight:600;border-bottom-color:var(--accent);}
        .tab-badge{font-family:'JetBrains Mono',monospace;font-size:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:0 6px;color:var(--text-secondary);}
        .tab-badge--urgent{background:var(--danger-dim);border-color:var(--danger);color:var(--danger);}
        .tab-help-btn{margin-left:auto;background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'JetBrains Mono',monospace;width:22px;height:22px;display:flex;align-items:center;justify-content:center;transition:color .1s,border-color .1s;}
        .tab-help-btn:hover{color:var(--text-primary);border-color:var(--border-strong);}
        /* Search bar */
        .search-bar{display:flex;align-items:center;gap:8px;padding:8px 20px;border-bottom:1px solid var(--border);background:var(--bg-subtle);flex-shrink:0;}
        .search-icon{font-size:15px;color:var(--text-muted);}
        .search-input{flex:1;background:transparent;border:none;color:var(--text-primary);font-size:12px;font-family:inherit;outline:none;}
        .search-input::placeholder{color:var(--text-muted);}
        .search-clear{background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0 4px;line-height:1;}
        .search-clear:hover{color:var(--text-primary);}
        .search-focus-hint{font-size:10px;color:var(--accent);font-family:'JetBrains Mono',monospace;white-space:nowrap;}
        /* Main */
        .control-main{flex:1;overflow-y:auto;padding:16px 20px 48px;}
        /* Section */
        .grid-section{margin-bottom:20px;}
        .grid-section-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
        .grid-section-title{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted);}
        .grid-section-badge{font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-muted);background:var(--bg-card);border:1px solid var(--border);border-radius:3px;padding:0 5px;line-height:16px;}
        .grid-section-rule{flex:1;height:1px;background:var(--border);}
        .grid-empty{font-size:12px;color:var(--text-muted);font-style:italic;padding:4px 0;}
        /* Grid — auto rows so cards within a row align */
        .pr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;align-items:start;}
        /* Skeleton */
        .pr-card-skeleton{border-radius:7px;background:var(--bg-card);border:1px solid var(--border);height:90px;animation:pulse 1.5s ease infinite;}
        /* Card */
        .pr-card-wrap{position:relative;}
        .pr-card-wrap--starred .pr-card{border-left:3px solid var(--warning);}
        .pr-card-wrap--focused .pr-card{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-glow);}
        .pr-card{display:flex;flex-direction:column;gap:5px;padding:10px 32px 10px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:7px;text-decoration:none;cursor:pointer;transition:background .1s,border-color .1s;width:100%;box-sizing:border-box;}
        .pr-card:hover{background:var(--bg-card-hover);border-color:var(--border-strong);}
        /* Row 1 */
        .pr-card-meta{display:flex;align-items:center;gap:5px;flex-shrink:0;}
        .pr-card-number{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;color:var(--text-muted);flex-shrink:0;}
        .pr-card-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
        .pr-card-age{font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;flex-shrink:0;}
        .pr-card-stale{font-size:9px;font-weight:700;color:var(--warning);background:var(--warning-dim);border-radius:3px;padding:0 4px;letter-spacing:.03em;}
        .pr-card-badges{display:flex;align-items:center;gap:4px;margin-left:auto;}
        .pr-card-badge-text{font-size:9.5px;font-weight:700;}
        .pr-card-badge-icon{font-size:10px;}
        /* Row 2: full title, no truncation */
        .pr-card-title{font-size:12px;font-weight:600;color:var(--text-primary);line-height:1.4;word-break:break-word;}
        /* Row 3: deps */
        .pr-card-deps{display:flex;flex-wrap:wrap;gap:4px;}
        .pr-card-dep{font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--accent);background:var(--accent-glow);border-radius:3px;padding:1px 5px;text-decoration:none;transition:opacity .1s;}
        .pr-card-dep:hover{opacity:.75;}
        /* Row 4: footer — star left, then content, spaced */
        .pr-card-footer{display:flex;align-items:center;gap:8px;flex-shrink:0;}
        .pr-card-star{background:transparent;border:none;cursor:pointer;font-size:13px;color:var(--text-muted);padding:0 2px;line-height:1;flex-shrink:0;transition:color .1s;}
        .pr-card-star:hover,.pr-card-star--on{color:var(--warning);}
        .pr-card-author{font-size:10px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;flex-shrink:0;}
        .pr-card-diff{font-family:'JetBrains Mono',monospace;font-size:9.5px;display:flex;align-items:center;gap:3px;}
        .pr-card-diff-sep{color:var(--text-muted);}
        .pr-card-comments{font-size:10px;color:var(--text-secondary);margin-left:auto;flex-shrink:0;}
        /* Hide button — top-right, appears on hover, AWAY from star */
        .pr-card-hide{position:absolute;top:6px;right:6px;background:transparent;border:none;cursor:pointer;font-size:14px;color:var(--text-muted);padding:0 3px;line-height:1;opacity:0;transition:opacity .1s,color .1s;border-radius:3px;}
        .pr-card-wrap:hover .pr-card-hide{opacity:1;}
        .pr-card-hide:hover{color:var(--danger);}
        /* Popover */
        .popover{position:fixed;z-index:1000;background:var(--bg-card);border:1px solid var(--border-strong);border-radius:10px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.5);pointer-events:auto;}
        .popover-header{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;}
        .popover-number{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--text-muted);}
        .popover-state{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:1px 6px;border-radius:3px;}
        .popover-label{font-size:10px;font-weight:600;padding:1px 6px;border-radius:3px;color:#000;}
        .popover-title{font-size:13px;font-weight:600;color:var(--text-primary);line-height:1.45;margin-bottom:10px;word-break:break-word;}
        .popover-meta{display:flex;flex-direction:column;gap:3px;border-top:1px solid var(--border);padding-top:8px;margin-bottom:8px;}
        .popover-row{display:flex;justify-content:space-between;gap:12px;}
        .popover-row-label{font-size:11px;color:var(--text-muted);flex-shrink:0;}
        .popover-row-value{font-size:11px;color:var(--text-secondary);text-align:right;}
        .popover-deps{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;padding-top:6px;border-top:1px solid var(--border);}
        .popover-deps-label{font-size:10px;color:var(--text-muted);flex-shrink:0;}
        .popover-dep-pill{font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--accent);background:var(--accent-glow);border-radius:3px;padding:1px 6px;text-decoration:none;}
        .popover-body{font-size:11px;color:var(--text-secondary);line-height:1.55;border-top:1px solid var(--border);padding-top:8px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto;}
        .popover-hint{font-size:10px;color:var(--accent);margin-top:8px;}
        /* Hidden drawer */
        .hidden-drawer{margin-top:8px;border-top:1px solid var(--border);padding-top:8px;}
        .hidden-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:inherit;padding:4px 0;gap:8px;}
        .hidden-toggle:hover{color:var(--text-secondary);}
        .hidden-clear{font-size:10px;color:var(--accent);background:transparent;border:none;cursor:pointer;font-family:inherit;padding:0;margin-left:auto;}
        .hidden-clear:hover{text-decoration:underline;}
        .hidden-list{margin-top:6px;border:1px solid var(--border);border-radius:6px;overflow:hidden;}
        .hidden-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);}
        .hidden-row:last-child{border-bottom:none;}
        .hidden-num{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);width:50px;flex-shrink:0;}
        .hidden-title{font-size:12px;color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .hidden-star{background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:0 3px;}
        .hidden-star:hover,.hidden-star--on{color:var(--warning);}
        .hidden-restore{background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:0 4px;flex-shrink:0;}
        .hidden-restore:hover{color:var(--success);}
        /* Keyboard help modal */
        .shortcut-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;align-items:center;justify-content:center;}
        .shortcut-modal{background:var(--bg-card);border:1px solid var(--border-strong);border-radius:10px;padding:20px;min-width:280px;box-shadow:0 8px 32px rgba(0,0,0,.5);}
        .shortcut-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:13px;font-weight:600;color:var(--text-primary);}
        .shortcut-close{background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:0 4px;line-height:1;}
        .shortcut-close:hover{color:var(--text-primary);}
        .shortcut-row{display:flex;align-items:center;gap:12px;padding:4px 0;}
        kbd.shortcut-key{font-family:'JetBrains Mono',monospace;font-size:11px;background:var(--bg-subtle);border:1px solid var(--border-strong);border-radius:4px;padding:2px 7px;color:var(--text-primary);min-width:60px;text-align:center;}
        .shortcut-desc{font-size:12px;color:var(--text-secondary);}
      `}</style>
    </div>
  );
}
