"use client";

import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import type { PrCardData } from "@/types/pr";
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

function buildItems(
  review: PrCardData[], myActive: PrCardData[], myDrafts: PrCardData[], team: PrCardData[]
): OrbitItem[] {
  const items: OrbitItem[] = [];
  const spread = (arr: PrCardData[]) => arr.map((pr, i) => (i / Math.max(arr.length, 1)) * 360);

  spread(review).forEach((deg, i) => items.push({
    pr: review[i], offsetDeg: deg, orbitR: 110, dotR: 8,
    color: "#6366f1", ring: "inner", speedMs: 18000,
  }));

  const myAll = [...myActive, ...myDrafts];
  spread(myAll).forEach((deg, i) => items.push({
    pr: myAll[i], offsetDeg: deg, orbitR: 200, dotR: 6,
    color: STATE_COLOR[myAll[i].state] ?? "#52525b", ring: "mid", speedMs: 30000,
  }));

  spread(team).forEach((deg, i) => items.push({
    pr: team[i], offsetDeg: deg, orbitR: 305, dotR: 4.5,
    color: STATE_COLOR[team[i].state] ?? "#52525b", ring: "outer", speedMs: 55000,
  }));

  return items;
}

interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function ZenView({ refreshIntervalMs, myLogin, repo }: Props) {
  const [hoveredPr, setHoveredPr] = useState<PrCardData | null>(null);
  const [paused, setPaused] = useState(false);
  const { myPrs, tmPrs, rvPrs, isLoading, refresh } = useDashboardData(refreshIntervalMs);

  const review = rvPrs?.reviewRequests ?? [];
  const myActive = myPrs?.active ?? [];
  const myDrafts = myPrs?.drafts ?? [];
  const team = Object.values(tmPrs?.byTeammate ?? {}).flat();
  const items = useMemo(() => buildItems(review, myActive, myDrafts, team), [review, myActive, myDrafts, team]);

  const cx = 400, cy = 400;
  const size = 800;

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

          {/* Orbit rings */}
          {([
            { r: 110, dash: "3 7", opacity: 0.25 },
            { r: 200, dash: "none", opacity: 0.18 },
            { r: 305, dash: "2 10", opacity: 0.12 },
          ] as { r: number; dash: string; opacity: number }[]).map(({ r, dash, opacity }) => (
            <circle key={r} cx={cx} cy={cy} r={r}
              fill="none" stroke={`rgba(255,255,255,${opacity})`} strokeWidth={1}
              strokeDasharray={dash === "none" ? undefined : dash}
            />
          ))}

          {/* Center hub */}
          <circle cx={cx} cy={cy} r={40} fill="var(--bg-card)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} filter="url(#glow-soft)" />
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#6366f1" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="700" letterSpacing="2">HI</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(135,135,160,0.6)" fontSize="8" fontFamily="Manrope, sans-serif" fontWeight="500">hawaiian-ice</text>

          {/* Ring labels */}
          <text x={cx + 116} y={cy - 6} fill="rgba(99,102,241,0.5)" fontSize="8" fontFamily="Manrope, sans-serif" fontWeight="600">review {review.length}</text>
          <text x={cx + 206} y={cy - 6} fill="rgba(135,135,160,0.4)" fontSize="8" fontFamily="Manrope, sans-serif" fontWeight="500">@{myLogin} {myActive.length + myDrafts.length}</text>
          <text x={cx + 311} y={cy - 6} fill="rgba(135,135,160,0.3)" fontSize="8" fontFamily="Manrope, sans-serif" fontWeight="500">team {team.length}</text>

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
            <p style={{ fontSize: 10, color: "var(--accent)", marginTop: 10 }}>Click dot to open PR →</p>
          </div>
        )}

        {/* Status hint */}
        <p
          aria-live="polite"
          style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.02em", pointerEvents: "none", whiteSpace: "nowrap" }}
        >
          {paused ? "Click to resume" : "Hover to inspect · Click to pause"}
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
