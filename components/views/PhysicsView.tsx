"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useSWR from "swr";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import type { PrCardData, MyPrsResponse, TeammatePrsResponse, ReviewRequestsResponse } from "@/types/pr";
import NavBar from "@/components/NavBar";
import { fetcher } from "@/lib/fetcher";

// Stripe-aligned palette
const STATE_COLORS: Record<string, string> = {
  draft: "#52525b",
  open: "#22c55e",
  merged: "#a855f7",
  closed: "#ef4444",
};
const REVIEW_COLOR = "#6366f1"; // indigo ring for review-requested

interface Ball {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  color: string;
  pr: PrCardData;
  label: "review-req" | "mine" | "teammate";
}

function makeBalls(prs: PrCardData[], label: Ball["label"], w: number, h: number): Ball[] {
  return prs.map((pr, i) => {
    const age = Math.max(0, differenceInDays(new Date(), new Date(pr.createdAt)));
    const radius = Math.round(Math.max(26, Math.min(62, 26 + age * 1.4)));
    const angle = (i / Math.max(prs.length, 1)) * Math.PI * 2;
    const spread = Math.min(w, h) * 0.28;
    return {
      id: pr.number,
      x: w / 2 + Math.cos(angle) * spread * (0.5 + Math.random() * 0.5),
      y: h / 2 + Math.sin(angle) * spread * (0.5 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      radius,
      color: STATE_COLORS[pr.state] ?? "#52525b",
      pr, label,
    };
  });
}

function tick(balls: Ball[], w: number, h: number, mx: number, my: number) {
  const cx = w / 2, cy = h / 2;
  for (const b of balls) {
    // Gravity toward center
    const dx = cx - b.x, dy = cy - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) { b.vx += (dx / dist) * 0.04; b.vy += (dy / dist) * 0.04; }

    // Mouse repulsion
    const mdx = mx - b.x, mdy = my - b.y;
    const md = Math.hypot(mdx, mdy);
    const repel = b.radius + 70;
    if (md < repel && md > 0.5) {
      const f = ((repel - md) / repel) * 2.5;
      b.vx -= (mdx / md) * f; b.vy -= (mdy / md) * f;
    }

    b.vx *= 0.97; b.vy *= 0.97;
    b.x += b.vx; b.y += b.vy;

    // Wall bounce with padding
    const pad = b.radius + 6;
    if (b.x < pad) { b.x = pad; b.vx = Math.abs(b.vx) * 0.65; }
    if (b.x > w - pad) { b.x = w - pad; b.vx = -Math.abs(b.vx) * 0.65; }
    if (b.y < pad) { b.y = pad; b.vy = Math.abs(b.vy) * 0.65; }
    if (b.y > h - pad) { b.y = h - pad; b.vy = -Math.abs(b.vy) * 0.65; }
  }

  // Ball-ball collision
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius + 3;
      if (dist < min && dist > 0.01) {
        const nx = dx / dist, ny = dy / dist;
        const overlap = (min - dist) * 0.5;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          a.vx -= dot * nx * 0.55; a.vy -= dot * ny * 0.55;
          b.vx += dot * nx * 0.55; b.vy += dot * ny * 0.55;
        }
      }
    }
  }
}

interface HoverInfo { pr: PrCardData; screenX: number; screenY: number; label: Ball["label"]; }

interface Props { refreshIntervalMs: number; myLogin: string; repo: string; }

export default function PhysicsView({ refreshIntervalMs, myLogin, repo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);
  const [ready, setReady] = useState(false);

  const { data: myPrs, isLoading: myLoad, mutate: mm } = useSWR<MyPrsResponse>("/api/my-prs", fetcher, { refreshInterval: refreshIntervalMs });
  const { data: tmPrs, isLoading: tmLoad, mutate: mt } = useSWR<TeammatePrsResponse>("/api/teammate-prs", fetcher, { refreshInterval: refreshIntervalMs });
  const { data: rvPrs, isLoading: rvLoad, mutate: mr } = useSWR<ReviewRequestsResponse>("/api/review-requests", fetcher, { refreshInterval: refreshIntervalMs });
  const handleRefresh = useCallback(() => { mm(); mt(); mr(); setReady(false); }, [mm, mt, mr]);

  // Init balls once data arrives
  useEffect(() => {
    if (!myPrs || !tmPrs || ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    if (w < 10 || h < 10) return; // canvas not rendered yet

    const rvArr = rvPrs?.reviewRequests ?? [];
    const myArr = [...(myPrs.active ?? []), ...(myPrs.drafts ?? [])];
    const tmArr = Object.values(tmPrs.byTeammate).flat();
    const rvIds = new Set(rvArr.map(p => p.number));
    const myIds = new Set(myArr.map(p => p.number));
    const filteredTm = tmArr.filter(p => !rvIds.has(p.number) && !myIds.has(p.number));

    canvas.width = w; canvas.height = h;
    ballsRef.current = [
      ...makeBalls(rvArr, "review-req", w, h),
      ...makeBalls(myArr, "mine", w, h),
      ...makeBalls(filteredTm, "teammate", w, h),
    ];
    setReady(true);
  }, [myPrs, tmPrs, rvPrs, ready]);

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // re-init if we have data
      setReady(false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    let lastHoverId: number | null = null;

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      if (w < 1 || h < 1) { rafRef.current = requestAnimationFrame(draw); return; }

      // Use computed CSS variable for background (respects light/dark)
      const style = getComputedStyle(canvas);
      const bgColor = style.getPropertyValue("--bg").trim() || "#0c0c0f";
      const dotGridColor = bgColor.startsWith("#f") || bgColor.startsWith("#fff")
        ? "rgba(0,0,0,0.04)"
        : "rgba(255,255,255,0.025)";
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      // Subtle dot grid
      ctx.fillStyle = dotGridColor;
      const gs = 36;
      for (let x = gs; x < w; x += gs)
        for (let y = gs; y < h; y += gs) {
          ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
        }

      if (!ready) {
        // Loading state
        ctx.fillStyle = "rgba(135,135,160,0.3)";
        ctx.font = "12px Manrope, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("Loading PRs…", w / 2, h / 2);
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

        const r = isHover ? b.radius * 1.18 : b.radius;

        // Ambient glow
        if (isHover) {
          const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2.5);
          glow.addColorStop(0, b.color + "30");
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(b.x, b.y, r * 2.5, 0, Math.PI * 2); ctx.fill();
        }

        // Ball fill — clean radial gradient
        const grad = ctx.createRadialGradient(b.x - r * 0.28, b.y - r * 0.28, r * 0.05, b.x, b.y, r);
        grad.addColorStop(0, b.color + "ff");
        grad.addColorStop(0.55, b.color + "bb");
        grad.addColorStop(1, b.color + "40");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();

        // Review-req ring (indigo)
        if (b.label === "review-req") {
          ctx.strokeStyle = REVIEW_COLOR + (isHover ? "dd" : "88");
          ctx.lineWidth = isHover ? 2.5 : 1.5;
          ctx.beginPath(); ctx.arc(b.x, b.y, r + 4, 0, Math.PI * 2); ctx.stroke();
        }

        // PR number text
        const fontSize = Math.max(9, Math.min(14, r * 0.38));
        ctx.fillStyle = isHover ? "rgba(255,255,255,0.95)" : "rgba(240,240,245,0.75)";
        ctx.font = `${isHover ? 600 : 500} ${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`#${b.pr.number}`, b.x, b.y);
      }

      if (newHoverId !== lastHoverId) {
        lastHoverId = newHoverId;
        if (hoveredBall) {
          setHovered({ pr: hoveredBall.pr, screenX: hoveredBall.x, screenY: hoveredBall.y, label: hoveredBall.label });
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
  }, [ready]);

  const isLoading = myLoad || tmLoad || rvLoad;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NavBar repo={repo} onRefresh={handleRefresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />

      {/* Legend bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 20,
        padding: "0 20px", height: 38, flexShrink: 0,
        borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)",
      }}>
        {([
          { color: REVIEW_COLOR, label: "needs review", ring: true },
          { color: STATE_COLORS.open, label: "open / active" },
          { color: STATE_COLORS.draft, label: "draft" },
          { color: STATE_COLORS.merged, label: "merged" },
        ] as { color: string; label: string; ring?: boolean }[]).map(({ color, label, ring }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: ring ? "transparent" : color,
              border: ring ? `2px solid ${color}` : "none",
              outline: ring ? `1px solid ${color}30` : "none",
            }} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
          ball size = age · hover to inspect · cursor repels
        </span>
      </div>

      {/* Canvas container — fills all remaining space */}
      <div id="main-content" style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            ready
              ? `Physics simulation of ${ballsRef.current.length} pull requests. Each ball represents a PR — size indicates age. Use the list below for accessible navigation.`
              : "Loading pull request physics simulation"
          }
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          }}
          onMouseLeave={() => { mouseRef.current = { x: -9999, y: -9999 }; setHovered(null); }}
          onClick={() => hovered && window.open(hovered.pr.htmlUrl, "_blank")}
        />

        {/* Screen-reader accessible PR list (visually hidden) */}
        {ready && (
          <ul className="sr-only" aria-label="Pull requests (accessible list)">
            {ballsRef.current.map((b) => (
              <li key={b.id}>
                <a href={b.pr.htmlUrl} target="_blank" rel="noopener noreferrer">
                  PR #{b.pr.number}: {b.pr.title} — {b.pr.state}, by @{b.pr.author.login}
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* Hover tooltip — Stripe card style */}
        {hovered && (
          <div style={{
            position: "absolute",
            left: Math.min(hovered.screenX + 16, window.innerWidth - 300),
            top: Math.max(8, hovered.screenY - 120),
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            padding: "14px 16px",
            width: 272,
            pointerEvents: "none",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                #{hovered.pr.number}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                color: STATE_COLORS[hovered.pr.state] ?? "var(--text-secondary)",
                background: (STATE_COLORS[hovered.pr.state] ?? "#52525b") + "18",
                padding: "1px 6px", borderRadius: 3,
              }}>
                {hovered.pr.state}
              </span>
              {hovered.label === "review-req" && (
                <span style={{ fontSize: 10, fontWeight: 700, color: REVIEW_COLOR, background: REVIEW_COLOR + "18", padding: "1px 6px", borderRadius: 3 }}>
                  Review needed
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.45, marginBottom: 10 }}>
              {hovered.pr.title}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <Row label="Author" value={`@${hovered.pr.author.login}`} />
              <Row label="Opened" value={formatDistanceToNow(new Date(hovered.pr.createdAt), { addSuffix: true })} />
              <Row label="Updated" value={formatDistanceToNow(new Date(hovered.pr.updatedAt), { addSuffix: true })} />
            </div>
            {hovered.pr.labels.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 10 }}>
                {hovered.pr.labels.map(l => (
                  <span key={l.id} style={{ background: `#${l.color}`, color: "#000", borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
                    {l.name}
                  </span>
                ))}
              </div>
            )}
            <p style={{ fontSize: 10, color: "var(--accent)", marginTop: 10 }}>Click to open →</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}
