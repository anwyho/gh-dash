"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import type { PrCardData, PrDetails } from "@/types/pr";
import NavBar from "@/components/NavBar";
import { useDashboardData } from "@/lib/hooks/useDashboardData";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  draft: "#52525b", open: "#22c55e", merged: "#a855f7", closed: "#ef4444",
};
const BUCKET_COLORS = ["#6366f1", "#22c55e", "#64748b"] as const;
const BUCKET_LABELS = ["Review Queue", "My PRs", "Team"] as const;
const GRAVITY = 0.25;
const DAMPING = 0.97;
const FLOOR_BOUNCE = 0.45;
const WALL_BOUNCE = 0.5;

// ── Ball type ─────────────────────────────────────────────────────────────────

interface Ball {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  color: string;
  bucket: 0 | 1 | 2; // which column
  pr: PrCardData;
}

function makeBalls(prs: PrCardData[], bucket: Ball["bucket"], w: number): Ball[] {
  const colW = w / 3;
  const left = bucket * colW;
  return prs.map((pr) => {
    const age = Math.max(0, differenceInDays(new Date(), new Date(pr.createdAt)));
    const radius = Math.max(20, Math.min(50, 20 + age * 1.2));
    return {
      id: pr.number,
      // spawn at top of the column, random x within it
      x: left + radius + Math.random() * (colW - radius * 2),
      y: 60 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 2,
      radius,
      color: bucket === 0 ? "#6366f1" : STATE_COLORS[pr.state] ?? "#52525b",
      bucket,
      pr,
    };
  });
}

function tick(balls: Ball[], w: number, h: number, mx: number, my: number) {
  const colW = w / 3;
  const HEADER_H = 48; // reserved for column labels

  for (const b of balls) {
    // Downward gravity
    b.vy += GRAVITY;

    // Horizontal lane attraction — soft pull toward column center
    const laneCenter = (b.bucket + 0.5) * colW;
    b.vx += (laneCenter - b.x) * 0.003;

    // Mouse repulsion
    const mdx = mx - b.x, mdy = my - b.y;
    const md = Math.hypot(mdx, mdy);
    const repel = b.radius + 60;
    if (md < repel && md > 0.5) {
      const f = ((repel - md) / repel) * 3;
      b.vx -= (mdx / md) * f; b.vy -= (mdy / md) * f;
    }

    b.vx *= DAMPING; b.vy *= DAMPING;
    b.x += b.vx; b.y += b.vy;

    // Floor
    const floor = h - b.radius - 4;
    if (b.y > floor) { b.y = floor; b.vy = -Math.abs(b.vy) * FLOOR_BOUNCE; b.vx *= 0.85; }

    // Ceiling (below header)
    const ceil = HEADER_H + b.radius;
    if (b.y < ceil) { b.y = ceil; b.vy = Math.abs(b.vy) * 0.3; }

    // Lane walls (hard boundaries)
    const laneLeft = b.bucket * colW + b.radius + 2;
    const laneRight = (b.bucket + 1) * colW - b.radius - 2;
    if (b.x < laneLeft) { b.x = laneLeft; b.vx = Math.abs(b.vx) * WALL_BOUNCE; }
    if (b.x > laneRight) { b.x = laneRight; b.vx = -Math.abs(b.vx) * WALL_BOUNCE; }
  }

  // Ball-ball collisions (only within same bucket for performance)
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      if (balls[i].bucket !== balls[j].bucket) continue;
      const a = balls[i], b = balls[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius + 2;
      if (dist < min && dist > 0.01) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = (min - dist) * 0.5;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const dot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (dot > 0) {
          a.vx -= dot * nx * 0.5; a.vy -= dot * ny * 0.5;
          b.vx += dot * nx * 0.5; b.vy += dot * ny * 0.5;
        }
      }
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface HoverInfo { pr: PrCardData; screenX: number; screenY: number; }
interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function PhysicsView({ refreshIntervalMs, repo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const bgRef = useRef({ bg: "#0c0c0f", divider: "rgba(255,255,255,0.07)", text: "rgba(255,255,255,0.25)" });
  const [hovered, setHovered] = useState<HoverInfo | null>(null);
  const [initTrigger, setInitTrigger] = useState(0);
  const initialized = useRef(false);

  const { myPrs, tmPrs, rvPrs, detailsMap, isLoading, refresh: dataRefresh } = useDashboardData(refreshIntervalMs);

  const handleRefresh = useCallback(() => {
    initialized.current = false;
    setInitTrigger(t => t + 1);
    dataRefresh();
  }, [dataRefresh]);

  // Track theme without polling getComputedStyle
  useEffect(() => {
    const update = () => {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      bgRef.current = dark
        ? { bg: "#0c0c0f", divider: "rgba(255,255,255,0.07)", text: "rgba(255,255,255,0.25)" }
        : { bg: "#ffffff", divider: "rgba(0,0,0,0.08)", text: "rgba(0,0,0,0.25)" };
    };
    update();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Init balls when data + canvas are ready
  useEffect(() => {
    if (!myPrs || !tmPrs) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    if (w < 10 || h < 10) return;
    canvas.width = w; canvas.height = h;
    initialized.current = true;

    const rvArr = rvPrs?.reviewRequests ?? [];
    const myArr = [...(myPrs.active ?? []), ...(myPrs.drafts ?? [])];
    const tmArr = Object.values(tmPrs.byTeammate).flat();
    const rvIds = new Set(rvArr.map(p => p.number));
    const myIds = new Set(myArr.map(p => p.number));

    ballsRef.current = [
      ...makeBalls(rvArr, 0, w),
      ...makeBalls(myArr, 1, w),
      ...makeBalls(tmArr.filter(p => !rvIds.has(p.number) && !myIds.has(p.number)), 2, w),
    ];
  }, [myPrs, tmPrs, rvPrs, initTrigger]);

  // Draw loop — runs once, reads refs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ro = new ResizeObserver(() => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      if (w < 10 || h < 10) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        initialized.current = false;
        setInitTrigger(t => t + 1);
      }
    });
    ro.observe(canvas.parentElement!);

    let lastHoverId: number | null = null;

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      if (w < 1 || h < 1) { rafRef.current = requestAnimationFrame(draw); return; }
      const colW = w / 3;
      const { bg, divider, text } = bgRef.current;

      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

      // Column dividers
      ctx.strokeStyle = divider; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(colW, 0); ctx.lineTo(colW, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(colW * 2, 0); ctx.lineTo(colW * 2, h); ctx.stroke();

      // Column headers
      ctx.fillStyle = text;
      ctx.font = "700 11px Manrope, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      BUCKET_LABELS.forEach((label, i) => {
        const x = (i + 0.5) * colW;
        // Accent stripe
        ctx.fillStyle = BUCKET_COLORS[i] + "22";
        ctx.fillRect(i * colW, 0, colW, 40);
        ctx.fillStyle = BUCKET_COLORS[i];
        ctx.fillText(label.toUpperCase(), x, 20);
        // Count
        const count = ballsRef.current.filter(b => b.bucket === i).length;
        if (count > 0) {
          ctx.fillStyle = text;
          ctx.font = "500 10px 'JetBrains Mono', monospace";
          ctx.fillText(String(count), x, 34);
          ctx.font = "700 11px Manrope, sans-serif";
        }
      });

      if (!initialized.current) {
        ctx.fillStyle = text;
        ctx.font = "12px Manrope, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText((!myPrs || !tmPrs) ? "Loading…" : "Settling…", w / 2, h / 2);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      tick(ballsRef.current, w, h, mouseRef.current.x, mouseRef.current.y);

      let newHoverId: number | null = null;
      let hoveredBall: Ball | null = null;

      for (const b of ballsRef.current) {
        const dx = mouseRef.current.x - b.x, dy = mouseRef.current.y - b.y;
        const isHover = Math.hypot(dx, dy) < b.radius;
        if (isHover) { newHoverId = b.id; hoveredBall = b; }
        const r = isHover ? b.radius * 1.15 : b.radius;

        // Glow on hover
        if (isHover) {
          const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.2);
          glow.addColorStop(0, b.color + "40"); glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(b.x, b.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
        }

        // Ball
        const grad = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.35, r * 0.05, b.x, b.y, r);
        grad.addColorStop(0, b.color + "ff"); grad.addColorStop(0.6, b.color + "cc"); grad.addColorStop(1, b.color + "44");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();

        // PR number
        const fontSize = Math.max(8, Math.min(13, r * 0.38));
        ctx.fillStyle = isHover ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)";
        ctx.font = `${isHover ? 600 : 500} ${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`#${b.pr.number}`, b.x, b.y);
      }

      if (newHoverId !== lastHoverId) {
        lastHoverId = newHoverId;
        if (hoveredBall) {
          setHovered({ pr: hoveredBall.pr, screenX: hoveredBall.x, screenY: hoveredBall.y });
          canvas.style.cursor = "pointer";
        } else {
          setHovered(null);
          canvas.style.cursor = "default";
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NavBar repo={repo} onRefresh={handleRefresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />

      <div id="main-content" style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="PR bucket simulation — three columns: Review Queue, My PRs, Team. Ball size = PR age."
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          }}
          onMouseLeave={() => { mouseRef.current = { x: -9999, y: -9999 }; setHovered(null); }}
          onClick={() => hovered && window.open(hovered.pr.htmlUrl, "_blank")}
        />

        {/* Screen reader list */}
        <ul className="sr-only" aria-label="Pull requests">
          {ballsRef.current.map(b => (
            <li key={b.id}>
              <a href={b.pr.htmlUrl} target="_blank" rel="noopener noreferrer">
                PR #{b.pr.number}: {b.pr.title} — {b.pr.state}, @{b.pr.author.login}
              </a>
            </li>
          ))}
        </ul>

        {/* Hover tooltip */}
        {hovered && (() => {
          const d = detailsMap?.[hovered.pr.number];
          return (
            <div style={{ position: "absolute", left: Math.min(hovered.screenX + 16, (typeof window !== "undefined" ? window.innerWidth : 1440) - 290), top: Math.max(50, hovered.screenY - 110), background: "var(--bg-card)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "14px 16px", width: 268, pointerEvents: "none", boxShadow: "0 8px 32px rgba(0,0,0,.55)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>#{hovered.pr.number}</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: STATE_COLORS[hovered.pr.state], background: STATE_COLORS[hovered.pr.state] + "18", padding: "1px 6px", borderRadius: 3 }}>{hovered.pr.state}</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4, margin: "0 0 10px" }}>{hovered.pr.title}</p>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                {[
                  ["Author", `@${hovered.pr.author.login}`],
                  ["Opened", formatDistanceToNow(new Date(hovered.pr.createdAt), { addSuffix: true })],
                  ["Updated", formatDistanceToNow(new Date(hovered.pr.updatedAt), { addSuffix: true })],
                  ...(d ? [["Review", d.reviewState.replace("_", " ")], ["CI", d.ciState]] : []),
                ].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l}</span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{v}</span>
                  </div>
                ))}
              </div>
              {hovered.pr.labels.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 8 }}>
                  {hovered.pr.labels.map(l => <span key={l.id} style={{ background: `#${l.color}`, borderRadius: 3, padding: "1px 5px", fontSize: 10, fontWeight: 600, color: "#000" }}>{l.name}</span>)}
                </div>
              )}
              <p style={{ fontSize: 10, color: "var(--accent)", marginTop: 8 }}>Click to open →</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
