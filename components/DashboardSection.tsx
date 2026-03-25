"use client";

import type { PrCardData } from "@/types/pr";
import PrCard from "./PrCard";
import PrCardSkeleton from "./PrCardSkeleton";

interface Props {
  title: string;
  prs?: PrCardData[];
  isLoading: boolean;
  error?: Error | null;
  emptyMessage?: string;
  accent?: boolean;
}

export default function DashboardSection({
  title,
  prs,
  isLoading,
  error,
  emptyMessage = "no PRs here",
  accent = false,
}: Props) {
  const count = prs?.length ?? 0;

  return (
    <section style={{ marginBottom: 36 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: accent ? "var(--accent)" : "var(--text-muted)",
          }}
        >
          {title}
        </h2>
        {!isLoading && prs && (
          <span
            style={{
              fontSize: "0.65rem",
              color: "var(--text-faint)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              padding: "1px 6px",
              minWidth: 20,
              textAlign: "center",
            }}
          >
            {count}
          </span>
        )}
        <div
          style={{
            flex: 1,
            height: 1,
            background: "var(--border)",
            opacity: 0.5,
          }}
        />
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--state-closed)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          ✕ failed to load — check that `gh auth status` is working
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 10,
          }}
        >
          {[1, 2, 3].map((i) => (
            <PrCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && count === 0 && (
        <p
          style={{
            fontSize: "0.72rem",
            color: "var(--text-faint)",
            fontStyle: "italic",
            margin: 0,
            paddingLeft: 2,
          }}
        >
          — {emptyMessage}
        </p>
      )}

      {/* PR grid */}
      {!isLoading && !error && count > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 10,
          }}
        >
          {prs!.map((pr) => (
            <PrCard key={pr.number} pr={pr} />
          ))}
        </div>
      )}
    </section>
  );
}
