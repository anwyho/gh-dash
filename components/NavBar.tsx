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
    <header role="banner" className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo" aria-hidden="true">gh-dash</span>
        <span className="navbar-sep" aria-hidden="true">/</span>
        <a
          href={`https://github.com/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${repo} on GitHub (opens in new tab)`}
          className="navbar-repo"
        >
          {repoName}
        </a>
      </div>

      <nav aria-label="Dashboard views" className="navbar-nav">
        {VIEWS.map(({ href, label }) => {
          const active = pathname === href || (pathname === "/" && href === "/control");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`navbar-link${active ? " navbar-link--active" : ""}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div role="status" aria-live="polite" aria-atomic="true" className="navbar-right">
        {timeLabel && (
          <time dateTime={lastFetchedAt} aria-label={`Last synced at ${timeLabel}`} className="navbar-time">
            {timeLabel}
          </time>
        )}
        {isLoading ? (
          <div role="status" aria-label="Syncing…" className="navbar-spinner" />
        ) : (
          onRefresh && (
            <button type="button" onClick={onRefresh} aria-label="Sync dashboard data" className="navbar-sync">
              Sync
            </button>
          )
        )}
      </div>

      <style>{`
        .navbar { position:sticky; top:0; z-index:100; background:var(--bg-overlay); backdrop-filter:blur(12px); border-bottom:1px solid var(--border); padding:0 20px; display:flex; align-items:center; height:44px; gap:0; }
        .navbar-brand { display:flex; align-items:center; gap:8px; padding-right:20px; border-right:1px solid var(--border); margin-right:20px; flex-shrink:0; }
        .navbar-logo { font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:700; color:var(--accent); letter-spacing:.02em; }
        .navbar-sep { font-size:11px; color:var(--text-muted); }
        .navbar-repo { font-size:12px; font-weight:500; color:var(--text-secondary); text-decoration:none; border-radius:3px; transition:color .1s; }
        .navbar-repo:hover { color:var(--text-primary); }
        .navbar-nav { display:flex; gap:2px; flex:1; }
        .navbar-link { font-size:12px; font-weight:400; color:var(--text-secondary); text-decoration:none; padding:4px 10px; border-radius:5px; background:transparent; border:1px solid transparent; transition:color .1s; }
        .navbar-link:hover { color:var(--text-primary); }
        .navbar-link--active { font-weight:600; color:var(--text-primary); background:var(--bg-card); border-color:var(--border); }
        .navbar-right { display:flex; align-items:center; gap:12px; }
        .navbar-time { font-size:11px; color:var(--text-muted); font-family:'JetBrains Mono',monospace; }
        .navbar-spinner { width:14px; height:14px; border-radius:50%; border:2px solid var(--border-strong); border-top-color:var(--accent); animation:spin .7s linear infinite; }
        .navbar-sync { background:transparent; border:1px solid var(--border); border-radius:5px; color:var(--text-secondary); cursor:pointer; font-size:11px; font-family:inherit; font-weight:500; padding:3px 9px; transition:color .1s,border-color .1s; }
        .navbar-sync:hover { border-color:var(--border-strong); color:var(--text-primary); }
      `}</style>
    </header>
  );
}
