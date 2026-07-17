"use client";

interface RiskBadgeProps {
  level: "AMAN" | "WASPADA" | "KRITIS";
  score?: number;
}

export function RiskBadge({ level, score }: RiskBadgeProps) {
  const colors = {
    AMAN: "bg-green-100 text-green-700 border-green-200",
    WASPADA: "bg-yellow-100 text-yellow-700 border-yellow-200",
    KRITIS: "bg-red-100 text-red-700 border-red-200",
  };

  const labels = {
    AMAN: "Aman",
    WASPADA: "Waspada",
    KRITIS: "Kritis",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[level]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          level === "AMAN" ? "bg-green-500" : level === "WASPADA" ? "bg-yellow-500" : "bg-red-500"
        }`}
      />
      {labels[level]}
      {score !== undefined && ` (${score})`}
    </span>
  );
}
