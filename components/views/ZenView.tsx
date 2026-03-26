"use client";

import { useState, useCallback, useRef } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import type { PrCardData, MyPrsResponse, TeammatePrsResponse, ReviewRequestsResponse } from "@/types/pr";
import NavBar from "@/components/NavBar";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATE_COLORS: Record<string, string> = {
  draft: "#6b6560",
  open: "#3fb950",
  merged: "#a371f7",
  closed: "#f85149",
};

interface OrbitDot {
  pr: PrCardData;
  angle: number; // 0..2PI
  orbitRadius: number;
  dotRadius: number;
  color: string;
  ring: "inner" | "middle" | "outer";
  ringIndex: number;
  totalInRing: number;
}

function buildOrbitDots(
  myActive: PrCardData[],
  myDrafts: PrCardData[],
  reviewReqs: PrCardData[],
  teamPrs: PrCardData[]
): OrbitDot[] {
  const dots: OrbitDot[] = [];

  // Inner ring: review requests (most urgent, nearest to center)
  reviewReqs.forEach((pr, i) => {
    dots.push({
      pr, angle: (i / Math.max(reviewReqs.length, 1)) * Math.PI * 2,
      orbitRadius: 100, dotRadius: 9, color: "#f0a500",
      ring: "inner", ringIndex: i, totalInRing: reviewReqs.length,
    });
  });

  // Middle ring: my active PRs + drafts
  const myPrs = [...myActive, ...myDrafts];
  myPrs.forEach((pr, i) => {
    dots.push({
      pr, angle: (i / Math.max(myPrs.length, 1)) * Math.PI * 2,
      orbitRadius: 190, dotRadius: 7,
      color: STATE_COLORS[pr.state] ?? "#3a3530",
      ring: "middle", ringIndex: i, totalInRing: myPrs.length,
    });
  });

  // Outer ring: teammate PRs
  teamPrs.forEach((pr, i) => {
    dots.push({
      pr, angle: (i / Math.max(teamPrs.length, 1)) * Math.PI * 2,
      orbitRadius: 290, dotRadius: 5, color: STATE_COLORS[pr.state] ?? "#3a3530",
      ring: "outer", ringIndex: i, totalInRing: teamPrs.length,
    });
  });

  return dots;
}

interface Props {
  refreshIntervalMs: number;
  myLogin: string;
  repo: string;
}

export default function ZenView({ refreshIntervalMs, myLogin, repo }: Props) {
  const [hoveredPr, setHoveredPr] = useState<{ pr: PrCardData; cx: number; cy: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: myPrs, isLoading: myLoad, mutate: mutateMyPrs } = useSWR<MyPrsResponse>(
    "/api/my-prs", fetcher, { refreshInterval: refreshIntervalMs }
  );
  const { data: tmPrs, isLoading: tmLoad, mutate: mutateTm } = useSWR<TeammatePrsResponse>(
    "/api/teammate-prs", fetcher, { refreshInterval: refreshIntervalMs }
  );
  const { data: reviewReqs, isLoading: reviewLoad, mutate: mutateReview } = useSWR<ReviewRequestsResponse>(
    "/api/review-requests", fetcher, { refreshInterval: refreshIntervalMs }
  );

  const handleRefresh = useCallback(() => {
    mutateMyPrs(); mutateTm(); mutateReview();
  }, [mutateMyPrs, mutateTm, mutateReview]);

  const isLoading = myLoad || tmLoad || reviewLoad;

  const reviewArr = reviewReqs?.reviewRequests ?? [];
  const myActive = myPrs?.active ?? [];
  const myDrafts = myPrs?.drafts ?? [];
  const teamPrs = Object.values(tmPrs?.byTeammate ?? {}).flat();

  const dots = buildOrbitDots(myActive, myDrafts, reviewArr, teamPrs);

  // Animation speeds per ring (deg/s)
  const SPEEDS = { inner: 14, middle: 8, outer: 4 };
  // Animation durations per ring (ms for full rotation)
  const DURATIONS = {
    inner: Math.round(360 / SPEEDS.inner * 1000),
    middle: Math.round(360 / SPEEDS.middle * 1000),
    outer: Math.round(360 / SPEEDS.outer * 1000),
  };

  const cx = 380; // SVG center x
  const cy = 380; // SVG center y

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <NavBar repo={repo} onRefresh={handleRefresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />

      <main
        ref={containerRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          position: "relative",
          overflow: "hidden",
        }}
        onClick={() => setPaused((p) => !p)}
      >
        {/* Deep space background — radial gradient */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, rgba(26,25,23,1) 0%, rgba(10,9,8,1) 70%)",
          pointerEvents: "none",
        }} />

        {/* Star field */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {Array.from({ length: 120 }, (_, i) => {
            const x = (Math.sin(i * 137.508) * 0.5 + 0.5) * 100;
            const y = (Math.cos(i * 137.508 + 1) * 0.5 + 0.5) * 100;
            const r = Math.random() * 1.2 + 0.3;
            return (
              <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill={`rgba(232,226,217,${0.1 + Math.random() * 0.25})`} />
            );
          })}
        </svg>

        {/* Orbit SVG */}
        <svg
          viewBox="0 0 760 760"
          style={{ width: "min(760px, 90vmin)", height: "min(760px, 90vmin)", position: "relative", zIndex: 1 }}
        >
          <defs>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glowStrong" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Orbit rings */}
          {[100, 190, 290].map((r, i) => (
            <circle key={r} cx={cx} cy={cy} r={r}
              fill="none"
              stroke={`rgba(46,43,40,${0.6 - i * 0.1})`}
              strokeWidth={1}
              strokeDasharray={i === 0 ? "4 6" : i === 1 ? "none" : "2 8"}
            />
          ))}

          {/* Center: repo */}
          <circle cx={cx} cy={cy} r={36} fill="rgba(26,25,23,1)" stroke="rgba(240,165,0,0.3)" strokeWidth={1.5} filter="url(#glow)" />
          <circle cx={cx} cy={cy} r={30} fill="rgba(240,165,0,0.06)" />
          <text x={cx} y={cy - 5} textAnchor="middle" fill="rgba(240,165,0,0.9)" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="700" letterSpacing="2">HI</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(122,118,112,0.7)" fontSize="7" fontFamily="JetBrains Mono, monospace">hawaiian-ice</text>

          {/* Ring labels */}
          <text x={cx + 106} y={cy - 4} fill="rgba(240,165,0,0.5)" fontSize="7" fontFamily="JetBrains Mono, monospace">review ({reviewArr.length})</text>
          <text x={cx + 196} y={cy - 4} fill="rgba(122,118,112,0.5)" fontSize="7" fontFamily="JetBrains Mono, monospace">@{myLogin} ({myActive.length + myDrafts.length})</text>
          <text x={cx + 296} y={cy - 4} fill="rgba(122,118,112,0.35)" fontSize="7" fontFamily="JetBrains Mono, monospace">team ({teamPrs.length})</text>

          {/* Orbit dots */}
          {dots.map((dot) => {
            const dur = DURATIONS[dot.ring];
            const isHovered = hoveredPr?.pr.number === dot.pr.number;

            return (
              <g
                key={`${dot.ring}-${dot.pr.number}`}
                style={{ animationPlayState: paused || isHovered ? "paused" : "running" }}
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${(dot.angle * 180 / Math.PI)} ${cx} ${cy}`}
                  to={`${(dot.angle * 180 / Math.PI) + 360} ${cx} ${cy}`}
                  dur={`${dur}ms`}
                  repeatCount="indefinite"
                  additive="sum"
                  calcMode="linear"
                />
                {/* Dot */}
                <circle
                  cx={cx + dot.orbitRadius}
                  cy={cy}
                  r={isHovered ? dot.dotRadius * 2.5 : dot.dotRadius}
                  fill={isHovered ? dot.color : dot.color + "bb"}
                  filter={isHovered ? "url(#glowStrong)" : undefined}
                  style={{ cursor: "pointer", transition: "r 0.2s" }}
                  onMouseEnter={() => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    setHoveredPr({ pr: dot.pr, cx: cx + dot.orbitRadius, cy });
                    setPaused(true);
                  }}
                  onMouseLeave={() => {
                    setHoveredPr(null);
                    setPaused(false);
                  }}
                  onClick={(e) => { e.stopPropagation(); window.open(dot.pr.htmlUrl, "_blank"); }}
                />
                {/* PR number label on hover */}
                {isHovered && (
                  <text
                    x={cx + dot.orbitRadius}
                    y={cy - dot.dotRadius * 2.5 - 5}
                    textAnchor="middle"
                    fill={dot.color}
                    fontSize="8"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                  >
                    #{dot.pr.number}
                  </text>
                )}
              </g>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <text x={cx} y={cy + 60} textAnchor="middle" fill="rgba(122,118,112,0.5)" fontSize="9" fontFamily="JetBrains Mono, monospace">
              loading...
            </text>
          )}
        </svg>

        {/* Hover tooltip */}
        {hoveredPr && (
          <div
            style={{
              position: "absolute",
              right: 32,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(26,25,23,0.97)",
              border: "1px solid var(--border-hover)",
              borderRadius: 8,
              padding: "16px 18px",
              maxWidth: 260,
              boxShadow: "0 0 40px rgba(0,0,0,0.8)",
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700 }}>#{hoveredPr.pr.number}</span>
              <span style={{ fontSize: "0.6rem", color: STATE_COLORS[hoveredPr.pr.state] ?? "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {hoveredPr.pr.state}
              </span>
            </div>
            <p style={{ margin: "0 0 10px", fontSize: "0.78rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
              {hoveredPr.pr.title}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "0.63rem", color: "var(--text-muted)" }}>@{hoveredPr.pr.author.login}</span>
              <span style={{ fontSize: "0.63rem", color: "var(--text-muted)" }}>
                opened {formatDistanceToNow(new Date(hoveredPr.pr.createdAt), { addSuffix: true })}
              </span>
              <span style={{ fontSize: "0.63rem", color: "var(--text-muted)" }}>
                updated {formatDistanceToNow(new Date(hoveredPr.pr.updatedAt), { addSuffix: true })}
              </span>
              {hoveredPr.pr.labels.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                  {hoveredPr.pr.labels.map((l) => (
                    <span key={l.id} style={{ background: `#${l.color}`, color: "#000", borderRadius: 2, padding: "0 5px", fontSize: "0.58rem", fontWeight: 600 }}>
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: "0.6rem", color: "var(--accent)" }}>click dot to open PR →</p>
          </div>
        )}

        {/* Pause hint */}
        <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontSize: "0.6rem", color: "var(--text-faint)", letterSpacing: "0.1em", pointerEvents: "none" }}>
          {paused ? "click anywhere to resume" : "click to pause · hover a dot to inspect"}
        </div>
      </main>
    </div>
  );
}
