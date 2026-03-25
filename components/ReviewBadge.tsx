import type { ReviewState } from "@/types/pr";

const CONFIG: Record<ReviewState, { label: string; color: string; icon: string }> = {
  approved: { label: "approved", color: "var(--review-approved)", icon: "✓" },
  changes_requested: {
    label: "changes",
    color: "var(--review-changes)",
    icon: "✗",
  },
  pending: { label: "review", color: "var(--review-pending)", icon: "?" },
};

export default function ReviewBadge({ state }: { state: ReviewState }) {
  const { label, color, icon } = CONFIG[state];
  return (
    <span
      style={{
        color,
        fontSize: "0.65rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        opacity: state === "pending" ? 0.5 : 1,
      }}
    >
      {icon} {label}
    </span>
  );
}
