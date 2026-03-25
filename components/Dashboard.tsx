"use client";

import useSWR from "swr";
import { useCallback } from "react";
import type { MyPrsResponse, TeammatePrsResponse } from "@/types/pr";
import DashboardSection from "./DashboardSection";
import RefreshButton from "./RefreshButton";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  refreshIntervalMs: number;
  myLogin: string;
  repo: string;
}

export default function Dashboard({ refreshIntervalMs, myLogin, repo }: Props) {
  const {
    data: myPrs,
    error: myPrsErr,
    isLoading: myPrsLoading,
    mutate: mutateMyPrs,
  } = useSWR<MyPrsResponse>("/api/my-prs", fetcher, {
    refreshInterval: refreshIntervalMs,
  });

  const {
    data: teammatePrs,
    error: tmErr,
    isLoading: tmLoading,
    mutate: mutateTm,
  } = useSWR<TeammatePrsResponse>("/api/teammate-prs", fetcher, {
    refreshInterval: refreshIntervalMs,
  });

  const handleRefresh = useCallback(() => {
    mutateMyPrs();
    mutateTm();
  }, [mutateMyPrs, mutateTm]);

  const isAnyLoading = myPrsLoading || tmLoading;
  const lastFetchedAt = myPrs?.lastFetchedAt;

  const [repoOwner, repoName] = repo.split("/");

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "0",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(15, 14, 13, 0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              color: "var(--accent)",
              letterSpacing: "0.05em",
            }}
          >
            gh-dash
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
            }}
          >
            /
          </span>
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              textDecoration: "none",
              letterSpacing: "0.04em",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.color =
                "var(--text-muted)")
            }
          >
            <span style={{ opacity: 0.6 }}>{repoOwner}/</span>
            {repoName}
          </a>
        </div>
        <RefreshButton
          onClick={handleRefresh}
          isLoading={isAnyLoading}
          lastFetchedAt={lastFetchedAt}
        />
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 64px" }}>
        {/* My PRs */}
        <div
          style={{
            marginBottom: 48,
            paddingBottom: 48,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <span
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              @{myLogin}
            </span>
          </div>

          <DashboardSection
            title="draft"
            prs={myPrs?.drafts}
            isLoading={myPrsLoading}
            error={myPrsErr ?? null}
            emptyMessage="no drafts in flight"
            accent={false}
          />
          <DashboardSection
            title="active"
            prs={myPrs?.active}
            isLoading={myPrsLoading}
            error={myPrsErr ?? null}
            emptyMessage="no active PRs"
            accent={true}
          />
          <DashboardSection
            title="recently closed"
            prs={myPrs?.recentlyClosed}
            isLoading={myPrsLoading}
            error={myPrsErr ?? null}
            emptyMessage="nothing closed recently"
          />
        </div>

        {/* Teammate PRs */}
        <div>
          <div style={{ marginBottom: 24 }}>
            <span
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              teammates
            </span>
          </div>

          {tmLoading && (
            <div>
              {[1, 2].map((i) => (
                <section key={i} style={{ marginBottom: 36 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        height: 10,
                        width: 80,
                        borderRadius: 2,
                        background: "var(--text-faint)",
                        animation: "pulse 1.5s ease-in-out infinite",
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: "var(--border)",
                        opacity: 0.5,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: 10,
                    }}
                  >
                    {[1, 2].map((j) => (
                      <div
                        key={j}
                        style={{
                          height: 90,
                          borderRadius: 6,
                          background: "var(--bg-card)",
                          border: "1px solid var(--border)",
                          animation: "pulse 1.5s ease-in-out infinite",
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tmErr && !tmLoading && (
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--state-closed)",
                fontStyle: "italic",
              }}
            >
              ✕ failed to load teammate PRs
            </p>
          )}

          {!tmLoading &&
            !tmErr &&
            teammatePrs &&
            Object.keys(teammatePrs.byTeammate).length === 0 && (
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-faint)",
                  fontStyle: "italic",
                }}
              >
                — no open PRs from teammates
              </p>
            )}

          {!tmLoading &&
            !tmErr &&
            teammatePrs &&
            Object.entries(teammatePrs.byTeammate).map(([login, prs]) => (
              <DashboardSection
                key={login}
                title={`@${login}`}
                prs={prs}
                isLoading={false}
                error={undefined}
              />
            ))}
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
