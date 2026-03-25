import type { CiState } from "@/types/pr";

const CONFIG: Record<CiState, { label: string; color: string; icon: string }> =
  {
    success: { label: "ci pass", color: "var(--ci-success)", icon: "◆" },
    failure: { label: "ci fail", color: "var(--ci-failure)", icon: "◆" },
    pending: { label: "ci pending", color: "var(--ci-pending)", icon: "◇" },
    unknown: { label: "no ci", color: "var(--ci-unknown)", icon: "◇" },
  };

export default function StatusBadge({ state }: { state: CiState }) {
  const { label, color, icon } = CONFIG[state];
  return (
    <span
      style={{
        color,
        fontSize: "0.65rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        opacity: state === "unknown" ? 0.4 : 1,
      }}
    >
      {icon} {label}
    </span>
  );
}
