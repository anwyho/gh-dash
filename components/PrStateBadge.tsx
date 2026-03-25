import type { PrState } from "@/types/pr";

const CONFIG: Record<PrState, { label: string; color: string; dot: string }> = {
  draft: { label: "draft", color: "var(--state-draft)", dot: "○" },
  open: { label: "open", color: "var(--state-open)", dot: "●" },
  merged: { label: "merged", color: "var(--state-merged)", dot: "⬡" },
  closed: { label: "closed", color: "var(--state-closed)", dot: "✕" },
};

export default function PrStateBadge({ state }: { state: PrState }) {
  const { label, color, dot } = CONFIG[state];
  return (
    <span
      style={{
        color,
        fontSize: "0.65rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {dot} {label}
    </span>
  );
}
