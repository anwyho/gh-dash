"use client";

export default function PrCardSkeleton() {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "14px 16px",
        background: "var(--bg-card)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div
          style={{
            height: 14,
            borderRadius: 3,
            background: "var(--text-faint)",
            width: "65%",
          }}
        />
        <div
          style={{
            height: 14,
            borderRadius: 3,
            background: "var(--text-faint)",
            width: "15%",
          }}
        />
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 3,
          background: "var(--text-faint)",
          width: "40%",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <div
          style={{
            height: 10,
            borderRadius: 2,
            background: "var(--text-faint)",
            width: 60,
          }}
        />
        <div
          style={{
            height: 10,
            borderRadius: 2,
            background: "var(--text-faint)",
            width: 60,
          }}
        />
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
