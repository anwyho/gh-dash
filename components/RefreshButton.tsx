"use client";

import { useState } from "react";

interface Props {
  onClick: () => void;
  isLoading: boolean;
  lastFetchedAt?: string;
}

export default function RefreshButton({ onClick, isLoading, lastFetchedAt }: Props) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = () => {
    setSpinning(true);
    onClick();
    setTimeout(() => setSpinning(false), 1000);
  };

  const timeLabel = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {timeLabel && (
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
          last sync {timeLabel}
        </span>
      )}
      <button
        onClick={handleClick}
        disabled={isLoading}
        style={{
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: spinning || isLoading ? "var(--accent)" : "var(--text-muted)",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontSize: "0.7rem",
          fontFamily: "inherit",
          letterSpacing: "0.08em",
          padding: "5px 12px",
          textTransform: "uppercase",
          transition: "color 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--accent)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading && !spinning) {
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-muted)";
          }
        }}
      >
        {spinning || isLoading ? "↻ syncing..." : "↻ refresh"}
      </button>
    </div>
  );
}
