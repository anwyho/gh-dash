"use client";

import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import type { PrCardData, PrDetails } from "@/types/pr";
import NavBar from "@/components/NavBar";
import { useDashboardData } from "@/lib/hooks/useDashboardData";

const STATE_COLOR: Record<string, string> = {
  draft: "#52525b",
  open: "#22c55e",
  merged: "#a855f7",
  closed: "#ef4444",
};

interface OrbitItem {
  pr: PrCardData;
  offsetDeg: number;
  orbitR: number;
  dotR: number;
  color: string;
  ring: "inner" | "mid" | "outer";
  speedMs: number;
}

// Ring layout: teammates inner, my PRs middle, review requests outer
// scale multiplies all radii (adjustable by user)
function buildItems(
  review: PrCardData[], myActive: PrCardData[], myDrafts: PrCardData[], team: PrCardData[],
  scale: number
): OrbitItem[] {
  const items: OrbitItem[] = [];
  const spread = (arr: PrCardData[]) => arr.map((_, i) => (i / Math.max(arr.length, 1)) * 360);

  // Inner: teammates — closest to center, fastest
  spread(team).forEach((deg, i) => items.push({
    pr: team[i], offsetDeg: deg,
    orbitR: Math.round(100 * scale), dotR: 7,
    color: STATE_COLOR[team[i].state] ?? "#636c76",
    ring: "inner", speedMs: 20000,
  }));

  // Middle: my PRs
  const myAll = [...myActive, ...myDrafts];
  spread(myAll).forEach((deg, i) => items.push({
    pr: myAll[i], offsetDeg: deg,
    orbitR: Math.round(190 * scale), dotR: 8,
    color: STATE_COLOR[myAll[i].state] ?? "#636c76",
    ring: "mid", speedMs: 32000,
  }));

  // Outer: review requests — outermost, prominent amber
  spread(review).forEach((deg, i) => items.push({
    pr: review[i], offsetDeg: deg,
    orbitR: Math.round(295 * scale), dotR: 10,
    color: "#d29922", ring: "outer", speedMs: 50000,
  }));

  return items;
}

interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function ZenView({ refreshIntervalMs, myLogin, repo }: Props) {
  const [hoveredPr, setHoveredPr] = useState<PrCardData | null>(null);
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(1.0);
  const { myPrs, tmPrs, rvPrs, detailsMap, isLoading, refresh } = useDashboardData(refreshIntervalMs);

  const review = rvPrs?.reviewRequests ?? [];
  const myActive = myPrs?.active ?? [];
  const myDrafts = myPrs?.drafts ?? [];
  const team = Object.values(tmPrs?.byTeammate ?? {}).flat();
  const items = useMemo(
    () => buildItems(review, myActive, myDrafts, team, scale),
    [review, myActive, myDrafts, team, scale]
  );

  const cx = 400, cy = 400;
  const size = 800;
  // Ring radii (for hitboxes and labels) — match buildItems
  const ringR = { inner: Math.round(100 * scale), mid: Math.round(190 * scale), outer: Math.round(295 * scale) };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NavBar repo={repo} onRefresh={refresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />

      <main
        id="main-content"
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: "var(--bg)", cursor: "default" }}
        onClick={() => setPaused(p => !p)}
      >
        {/* Radial vignette */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(12,12,15,0.7) 100%)", pointerEvents: "none" }} />

        {/* SVG orbital */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Orbital diagram showing ${review.length} review requests (inner ring), ${myActive.length + myDrafts.length} of your PRs (middle ring), and ${team.length} teammate PRs (outer ring)`}
          style={{ width: "min(800px, 88vmin)", height: "min(800px, 88vmin)", position: "relative", zIndex: 1 }}
        >
          <defs>
            <filter id="glow-soft"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow-hard"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <radialGradient id="center-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
            </radialGradient>
          </defs>

          {/* Ambient center glow */}
          <circle cx={cx} cy={cy} r={80} fill="url(#center-grad)" />

          {/* Orbit rings — visual + wide transparent hitbox for pause-on-hover */}
          {([
            { r: ringR.inner, dash: "3 7", opacity: 0.3, label: `team ${team.length}`, labelColor: "rgba(100,180,120,0.7)" },
            { r: ringR.mid, dash: "none", opacity: 0.22, label: `@${myLogin} ${myActive.length + myDrafts.length}`, labelColor: "rgba(130,170,255,0.6)" },
            { r: ringR.outer, dash: "2 10", opacity: 0.15, label: `review ${review.length}`, labelColor: "rgba(210,153,34,0.8)" },
          ]).map(({ r, dash, opacity, label, labelColor }) => (
            <g key={r}>
              {/* Visual ring */}
              <circle cx={cx} cy={cy} r={r}
                fill="none" stroke={`rgba(139,148,158,${opacity})`} strokeWidth={1}
                strokeDasharray={dash === "none" ? undefined : dash}
              />
              {/* Wide invisible hitbox — hovering the ring pauses all animation */}
              <circle cx={cx} cy={cy} r={r}
                fill="none" stroke="transparent" strokeWidth={24}
                style={{ cursor: "default" }}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
              />
              {/* Ring label */}
              <text x={cx + r + 6} y={cy - 4} fill={labelColor}
                fontSize="9" fontFamily="Manrope, sans-serif" fontWeight="600"
              >{label}</text>
            </g>
          ))}

          {/* Center hub */}
          <circle cx={cx} cy={cy} r={40} fill="var(--bg-card)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} filter="url(#glow-soft)" />
          <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--accent)" fontSize="13" fontFamily="'JetBrains Mono', monospace" fontWeight="700" letterSpacing="3">HI</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontFamily="Manrope, sans-serif" fontWeight="500">hawaiian-ice</text>

          {/* Center hub labels */}

          {/* Orbiting dots */}
          {items.map((item) => {
            const isHovered = hoveredPr?.number === item.pr.number;
            const displayR = isHovered ? item.dotR * 2.8 : item.dotR;
            return (
              <g
                key={`${item.ring}-${item.pr.number}`}
                style={{ animationPlayState: paused || isHovered ? "paused" : "running" }}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${item.offsetDeg} ${cx} ${cy}`}
                  to={`${item.offsetDeg + 360} ${cx} ${cy}`}
                  dur={`${item.speedMs}ms`}
                  repeatCount="indefinite"
                  calcMode="linear"
                />
                {/* Dot glow */}
                {isHovered && (
                  <circle
                    cx={cx + item.orbitR} cy={cy}
                    r={displayR * 2.5}
                    fill={item.color + "18"}
                    filter="url(#glow-hard)"
                  />
                )}
                {/* Dot — keyboard + pointer accessible */}
                <circle
                  cx={cx + item.orbitR} cy={cy}
                  r={displayR}
                  fill={isHovered ? item.color : item.color + "bb"}
                  filter={isHovered ? "url(#glow-soft)" : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`PR #${item.pr.number}: ${item.pr.title} — ${item.pr.state}, by @${item.pr.author.login}`}
                  style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredPr(item.pr);
                    setPaused(true);
                  }}
                  onMouseLeave={() => {
                    setHoveredPr(null);
                    setPaused(false);
                  }}
                  onFocus={() => { setHoveredPr(item.pr); setPaused(true); }}
                  onBlur={() => { setHoveredPr(null); setPaused(false); }}
                  onClick={(e) => { e.stopPropagation(); window.open(item.pr.htmlUrl, "_blank"); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      window.open(item.pr.htmlUrl, "_blank");
                    }
                  }}
                />
                {/* Label on hover */}
                {isHovered && (
                  <text
                    x={cx + item.orbitR} y={cy - displayR - 6}
                    textAnchor="middle"
                    fill={item.color}
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                  >
                    #{item.pr.number}
                  </text>
                )}
              </g>
            );
          })}

          {isLoading && (
            <text x={cx} y={cy + 65} textAnchor="middle" fill="rgba(135,135,160,0.35)" fontSize="9" fontFamily="Manrope, sans-serif">
              loading…
            </text>
          )}
        </svg>

        {/* Detail card */}
        {hoveredPr && (
          <div style={{
            position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)",
            background: "var(--bg-card)", border: "1px solid var(--border-strong)",
            borderRadius: 12, padding: "18px 20px", width: 260,
            boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
            pointerEvents: "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                #{hoveredPr.number}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                color: STATE_COLOR[hoveredPr.state] ?? "var(--text-secondary)",
                background: (STATE_COLOR[hoveredPr.state] ?? "#52525b") + "18",
                padding: "1px 6px", borderRadius: 3,
              }}>
                {hoveredPr.state}
              </span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.45, marginBottom: 12 }}>
              {hoveredPr.title}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              {[
                ["Author", `@${hoveredPr.author.login}`],
                ["Opened", formatDistanceToNow(new Date(hoveredPr.createdAt), { addSuffix: true })],
                ["Updated", formatDistanceToNow(new Date(hoveredPr.updatedAt), { addSuffix: true })],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{value}</span>
                </div>
              ))}
            </div>
            {hoveredPr.labels.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 10 }}>
                {hoveredPr.labels.map(l => (
                  <span key={l.id} style={{ background: `#${l.color}`, borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 600, color: "#000" }}>
                    {l.name}
                  </span>
                ))}
              </div>
            )}
            {(() => {
              const d: PrDetails | undefined = detailsMap?.[hoveredPr.number];
              const body = d?.body?.replace(/<!--[\s\S]*?-->/g, "").trim();
              return body ? (
                <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {body.slice(0, 400)}{body.length > 400 ? "…" : ""}
                </p>
              ) : null;
            })()}
            <p style={{ fontSize: 10, color: "var(--accent)", marginTop: 10 }}>Click dot to open PR →</p>
          </div>
        )}

        {/* Status hint */}
        {/* Ring size controls */}
        <div style={{ position: "absolute", bottom: 20, right: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>rings</span>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setScale(s => Math.max(0.4, parseFloat((s - 0.1).toFixed(1)))); }}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Shrink orbital rings"
          >−</button>
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: "var(--text-muted)", minWidth: 28, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setScale(s => Math.min(2.0, parseFloat((s + 0.1).toFixed(1)))); }}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Grow orbital rings"
          >+</button>
        </div>

        <p
          aria-live="polite"
          style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.02em", pointerEvents: "none", whiteSpace: "nowrap" }}
        >
          {paused ? "Click anywhere to resume" : "Hover ring or dot to pause · Click dot to open"}
        </p>

        {/* Screen-reader accessible PR list (visually hidden) */}
        {items.length > 0 && (
          <ul className="sr-only" aria-label="All pull requests in orbital view">
            {items.map((item) => (
              <li key={`${item.ring}-${item.pr.number}`}>
                <a href={item.pr.htmlUrl} target="_blank" rel="noopener noreferrer">
                  PR #{item.pr.number}: {item.pr.title} — {item.pr.state}, by @{item.pr.author.login}
                  {item.ring === "inner" ? " (needs your review)" : ""}
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
