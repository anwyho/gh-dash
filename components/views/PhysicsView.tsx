"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useSWR from "swr";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import type { PrCardData, MyPrsResponse, TeammatePrsResponse, ReviewRequestsResponse } from "@/types/pr";
import NavBar from "@/components/NavBar";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATE_COLORS: Record<string, string> = {
  draft: "#5a5550",
  open: "#2ea043",
  merged: "#8957e5",
  closed: "#da3633",
};

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glowColor: string;
  pr: PrCardData;
  label: string; // review-req | mine | teammate
}

function makeBalls(prs: PrCardData[], label: string, width: number, height: number): Ball[] {
  return prs.map((pr, i) => {
    const age = differenceInDays(new Date(), new Date(pr.createdAt));
    const radius = Math.max(22, Math.min(60, 22 + age * 1.2));
    const angle = (i / Math.max(prs.length, 1)) * Math.PI * 2 + Math.random() * 0.5;
    const spread = Math.min(width, height) * 0.3;
    return {
      id: pr.number,
      x: width / 2 + Math.cos(angle) * spread * Math.random(),
      y: height / 2 + Math.sin(angle) * spread * Math.random(),
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      radius,
      color: STATE_COLORS[pr.state] ?? "#3a3530",
      glowColor: STATE_COLORS[pr.state] ?? "#3a3530",
      pr,
      label,
    };
  });
}

function physicsStep(balls: Ball[], width: number, height: number, mouseX: number, mouseY: number) {
  const cx = width / 2;
  const cy = height / 2;

  for (const b of balls) {
    // Gentle gravity toward center
    const dx = cx - b.x;
    const dy = cy - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      b.vx += (dx / dist) * 0.05;
      b.vy += (dy / dist) * 0.05;
    }

    // Mouse repulsion
    const mx = mouseX - b.x;
    const my = mouseY - b.y;
    const md = Math.sqrt(mx * mx + my * my);
    const repelRadius = b.radius + 60;
    if (md < repelRadius && md > 1) {
      const force = (repelRadius - md) / repelRadius;
      b.vx -= (mx / md) * force * 3;
      b.vy -= (my / md) * force * 3;
    }

    // Damping
    b.vx *= 0.97;
    b.vy *= 0.97;
    b.x += b.vx;
    b.y += b.vy;

    // Wall bounce
    const pad = b.radius + 8;
    if (b.x < pad) { b.x = pad; b.vx = Math.abs(b.vx) * 0.7; }
    if (b.x > width - pad) { b.x = width - pad; b.vx = -Math.abs(b.vx) * 0.7; }
    if (b.y < pad) { b.y = pad; b.vy = Math.abs(b.vy) * 0.7; }
    if (b.y > height - pad) { b.y = height - pad; b.vy = -Math.abs(b.vy) * 0.7; }
  }

  // Ball-ball collision
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const bb = balls[j];
      const dx = bb.x - a.x;
      const dy = bb.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.radius + bb.radius + 4;
      if (dist < minDist && dist > 0.01) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) * 0.5;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        bb.x += nx * overlap;
        bb.y += ny * overlap;
        const dvx = a.vx - bb.vx;
        const dvy = a.vy - bb.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) {
          a.vx -= dot * nx * 0.6;
          a.vy -= dot * ny * 0.6;
          bb.vx += dot * nx * 0.6;
          bb.vy += dot * ny * 0.6;
        }
      }
    }
  }
}

interface HoveredInfo {
  pr: PrCardData;
  x: number;
  y: number;
  label: string;
}

interface Props {
  refreshIntervalMs: number;
  myLogin: string;
  repo: string;
}

export default function PhysicsView({ refreshIntervalMs, myLogin, repo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef<number>(0);
  const [hovered, setHovered] = useState<HoveredInfo | null>(null);
  const [initialized, setInitialized] = useState(false);

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

  // Initialize balls once data arrives
  useEffect(() => {
    if (!myPrs || !tmPrs || initialized) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    const reviewPrs = reviewReqs?.reviewRequests ?? [];
    const myAllPrs = [...(myPrs.drafts ?? []), ...(myPrs.active ?? [])];
    const tmAllPrs = Object.values(tmPrs.byTeammate).flat();

    // Deduplicate: review-req may overlap with teammates
    const reviewIds = new Set(reviewPrs.map((p) => p.number));
    const myIds = new Set(myAllPrs.map((p) => p.number));
    const filteredTm = tmAllPrs.filter((p) => !reviewIds.has(p.number) && !myIds.has(p.number));

    ballsRef.current = [
      ...makeBalls(reviewPrs, "review-req", w, h),
      ...makeBalls(myAllPrs, "mine", w, h),
      ...makeBalls(filteredTm, "teammate", w, h),
    ];
    setInitialized(true);
  }, [myPrs, tmPrs, reviewReqs, initialized]);

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let hoveredId: number | null = null;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "#0f0e0d";
      ctx.fillRect(0, 0, w, h);

      // Subtle grid
      ctx.strokeStyle = "rgba(46,43,40,0.4)";
      ctx.lineWidth = 1;
      const gridSize = 48;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      if (!initialized) {
        ctx.fillStyle = "rgba(122, 118, 112, 0.4)";
        ctx.font = "12px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText("loading...", w / 2, h / 2);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      physicsStep(ballsRef.current, w, h, mouseRef.current.x, mouseRef.current.y);

      let newHoveredId: number | null = null;
      let hoveredBall: Ball | null = null;

      for (const b of ballsRef.current) {
        const dx = mouseRef.current.x - b.x;
        const dy = mouseRef.current.y - b.y;
        const isHover = Math.sqrt(dx * dx + dy * dy) < b.radius;
        if (isHover) { newHoveredId = b.id; hoveredBall = b; }

        const r = isHover ? b.radius * 1.2 : b.radius;

        // Glow
        if (isHover) {
          const g = ctx.createRadialGradient(b.x, b.y, r * 0.3, b.x, b.y, r * 2);
          g.addColorStop(0, b.glowColor + "55");
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Ball body
        const grad = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, r * 0.1, b.x, b.y, r);
        const baseColor = b.color;
        grad.addColorStop(0, baseColor + "ee");
        grad.addColorStop(0.6, baseColor + "99");
        grad.addColorStop(1, baseColor + "44");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Ring for review-req
        if (b.label === "review-req") {
          ctx.strokeStyle = "rgba(240,165,0,0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // PR number text
        ctx.fillStyle = isHover ? "#ffffff" : "rgba(232,226,217,0.8)";
        ctx.font = `${isHover ? "bold " : ""}${Math.max(9, r * 0.35)}px JetBrains Mono, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`#${b.pr.number}`, b.x, b.y);
      }

      if (newHoveredId !== hoveredId) {
        hoveredId = newHoveredId;
        if (hoveredBall) {
          setHovered({ pr: hoveredBall.pr, x: hoveredBall.x, y: hoveredBall.y, label: hoveredBall.label });
          canvas.style.cursor = "pointer";
        } else {
          setHovered(null);
          canvas.style.cursor = "default";
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [initialized]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseLeave = () => {
    mouseRef.current = { x: -9999, y: -9999 };
    setHovered(null);
  };

  const isLoading = myLoad || tmLoad || reviewLoad;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar repo={repo} onRefresh={handleRefresh} isLoading={isLoading} lastFetchedAt={myPrs?.lastFetchedAt} />

      {/* Legend */}
      <div style={{ padding: "10px 24px", display: "flex", alignItems: "center", gap: 20, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {[
          { color: "#da3633", label: "needs your review (ring)" },
          { color: "#2ea043", label: "your active" },
          { color: "#5a5550", label: "your draft" },
          { color: "#2ea043", label: "teammate open" },
        ].map(({ color, label }, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: "0.6rem", color: "var(--text-faint)", marginLeft: "auto" }}>
          ball size = PR age · hover to inspect · mouse repels
        </span>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => {
            if (hovered) window.open(hovered.pr.htmlUrl, "_blank");
          }}
        />

        {/* Hover tooltip */}
        {hovered && (
          <div
            style={{
              position: "absolute",
              left: hovered.x + 20,
              top: hovered.y - 10,
              background: "var(--bg-card)",
              border: "1px solid var(--border-hover)",
              borderRadius: 6,
              padding: "10px 14px",
              maxWidth: 280,
              pointerEvents: "none",
              zIndex: 10,
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700 }}>
                #{hovered.pr.number}
              </span>
              <span
                style={{
                  fontSize: "0.6rem",
                  color: STATE_COLORS[hovered.pr.state],
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {hovered.pr.state}
              </span>
              {hovered.label === "review-req" && (
                <span style={{ fontSize: "0.6rem", color: "var(--accent)", fontWeight: 700 }}>
                  ← needs your review
                </span>
              )}
            </div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "0.75rem",
                color: "var(--text-primary)",
                lineHeight: 1.4,
              }}
            >
              {hovered.pr.title}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                @{hovered.pr.author.login}
              </span>
              <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                opened {formatDistanceToNow(new Date(hovered.pr.createdAt), { addSuffix: true })}
              </span>
              <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                updated {formatDistanceToNow(new Date(hovered.pr.updatedAt), { addSuffix: true })}
              </span>
              {hovered.pr.labels.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                  {hovered.pr.labels.map((l) => (
                    <span
                      key={l.id}
                      style={{
                        background: `#${l.color}`,
                        color: "#000",
                        borderRadius: 2,
                        padding: "0 5px",
                        fontSize: "0.58rem",
                        fontWeight: 600,
                      }}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "0.6rem", color: "var(--accent)", textDecoration: "underline" }}>
              click to open →
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
