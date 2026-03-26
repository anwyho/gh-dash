"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const VIEWS = [
  { href: "/control", label: "control", title: "Control Panel" },
  { href: "/physics", label: "physics", title: "Physics Sim" },
  { href: "/zen", label: "zen", title: "Zen Orbital" },
];

interface Props {
  repo: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  lastFetchedAt?: string;
}

export default function NavBar({ repo, onRefresh, isLoading, lastFetchedAt }: Props) {
  const pathname = usePathname();
  const [, repoName] = repo.split("/");

  const timeLabel = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(15, 14, 13, 0.95)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 44,
        gap: 16,
      }}
    >
      {/* Left: brand + repo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "var(--accent)",
            letterSpacing: "0.06em",
          }}
        >
          gh-dash
        </span>
        <span style={{ color: "var(--text-faint)", fontSize: "0.7rem" }}>/</span>
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "0.68rem",
            color: "var(--text-muted)",
            textDecoration: "none",
            letterSpacing: "0.03em",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")
          }
        >
          {repoName}
        </a>
      </div>

      {/* Center: view switcher */}
      <nav style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {VIEWS.map(({ href, label }) => {
          const active = pathname === href || (pathname === "/" && href === "/control");
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: "0.65rem",
                fontWeight: active ? 700 : 400,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: active ? "var(--accent)" : "var(--text-muted)",
                textDecoration: "none",
                padding: "4px 10px",
                borderRadius: 3,
                background: active ? "rgba(240, 165, 0, 0.08)" : "transparent",
                border: active ? "1px solid rgba(240, 165, 0, 0.2)" : "1px solid transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
                }
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right: sync info + refresh */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {timeLabel && (
          <span style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>
            synced {timeLabel}
          </span>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 3,
              color: isLoading ? "var(--accent)" : "var(--text-muted)",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "0.62rem",
              fontFamily: "inherit",
              letterSpacing: "0.08em",
              padding: "3px 8px",
              textTransform: "uppercase",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }
            }}
          >
            {isLoading ? "↻" : "↻ sync"}
          </button>
        )}
      </div>
    </header>
  );
}
