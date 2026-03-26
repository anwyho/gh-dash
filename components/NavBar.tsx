"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const VIEWS = [
  { href: "/control", label: "Control" },
  { href: "/physics", label: "Physics" },
  { href: "/zen", label: "Zen" },
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
    ? new Date(lastFetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <header
      role="banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "var(--bg-overlay)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        height: 44,
        gap: 0,
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingRight: 20,
          borderRight: "1px solid var(--border)",
          marginRight: 20,
          flexShrink: 0,
        }}
        aria-label="gh-dash"
      >
        <span
          aria-hidden="true"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--accent)",
            letterSpacing: "0.02em",
          }}
        >
          gh-dash
        </span>
        <span aria-hidden="true" style={{ fontSize: 11, color: "var(--text-muted)" }}>/</span>
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${repo} on GitHub (opens in new tab)`}
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-secondary)",
            textDecoration: "none",
            transition: "color 0.1s",
            borderRadius: 3,
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")
          }
        >
          {repoName}
        </a>
      </div>

      {/* View switcher */}
      <nav aria-label="Dashboard views" style={{ display: "flex", gap: 2, flex: 1 }}>
        {VIEWS.map(({ href, label }) => {
          const active = pathname === href || (pathname === "/" && href === "/control");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              style={{
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                textDecoration: "none",
                padding: "4px 10px",
                borderRadius: 5,
                background: active ? "var(--bg-card)" : "transparent",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
                transition: "all 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right: sync status */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        {timeLabel && (
          <time
            dateTime={lastFetchedAt}
            aria-label={`Last synced at ${timeLabel}`}
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {timeLabel}
          </time>
        )}

        {isLoading ? (
          <div
            role="status"
            aria-label="Syncing data…"
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid var(--border-strong)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.7s linear infinite",
            }}
          />
        ) : (
          onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Sync dashboard data"
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 5,
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "inherit",
                fontWeight: 500,
                padding: "3px 9px",
                transition: "all 0.1s",
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = "var(--border-strong)";
                b.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = "var(--border)";
                b.style.color = "var(--text-secondary)";
              }}
            >
              Sync
            </button>
          )
        )}
      </div>
    </header>
  );
}
