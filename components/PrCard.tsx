"use client";

import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import type { PrCardData, PrDetails } from "@/types/pr";
import PrStateBadge from "./PrStateBadge";
import ReviewBadge from "./ReviewBadge";
import StatusBadge from "./StatusBadge";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getLabelTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export default function PrCard({ pr }: { pr: PrCardData }) {
  const { data: details } = useSWR<PrDetails>(
    `/api/pr-details?number=${pr.number}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const relativeTime = formatDistanceToNow(new Date(pr.updatedAt), {
    addSuffix: true,
  });

  return (
    <a
      href={pr.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        textDecoration: "none",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "14px 16px",
        background: "var(--bg-card)",
        transition: "border-color 0.15s, background 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = "var(--accent-dim)";
        el.style.background = "var(--bg-card-hover)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = "var(--border)";
        el.style.background = "var(--bg-card)";
      }}
    >
      {/* Header: number + title + state */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              color: "var(--accent)",
              fontSize: "0.7rem",
              fontWeight: 700,
              marginRight: 6,
              letterSpacing: "0.04em",
            }}
          >
            #{pr.number}
          </span>
          <span
            style={{
              color: "var(--text-primary)",
              fontSize: "0.8rem",
              fontWeight: 500,
              lineHeight: 1.4,
              wordBreak: "break-word",
            }}
          >
            {pr.title}
          </span>
        </div>
        <PrStateBadge state={pr.state} />
      </div>

      {/* Author */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: pr.labels.length > 0 ? 8 : 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pr.author.avatarUrl}
          alt={pr.author.login}
          width={14}
          height={14}
          style={{ borderRadius: "50%", opacity: 0.8 }}
        />
        <span
          style={{
            fontSize: "0.68rem",
            color: "var(--text-muted)",
            letterSpacing: "0.02em",
          }}
        >
          {pr.author.login}
        </span>
      </div>

      {/* Labels */}
      {pr.labels.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: 10,
          }}
        >
          {pr.labels.map((label) => (
            <span
              key={label.id}
              style={{
                backgroundColor: `#${label.color}`,
                color: getLabelTextColor(label.color),
                borderRadius: 3,
                padding: "1px 6px",
                fontSize: "0.6rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                opacity: 0.9,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: time + review + CI */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 4,
          paddingTop: 8,
          borderTop: "1px solid var(--text-faint)",
        }}
      >
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
          {relativeTime}
        </span>
        {details ? (
          <>
            <ReviewBadge state={details.reviewState} />
            <StatusBadge state={details.ciState} />
          </>
        ) : (
          <span
            style={{
              fontSize: "0.65rem",
              color: "var(--text-faint)",
              fontStyle: "italic",
            }}
          >
            loading...
          </span>
        )}
      </div>
    </a>
  );
}
