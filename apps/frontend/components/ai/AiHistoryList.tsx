"use client";

import { AiSummary } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AiHistoryListProps {
  summaries: AiSummary[];
  onSelect: (summary: AiSummary) => void;
  selectedId?: string;
}

export function AiHistoryList({ summaries, onSelect, selectedId }: AiHistoryListProps) {
  if (summaries.length === 0) return null;

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Riwayat AI Summary
      </h3>
      <Separator className="mb-4" />
      <div className="space-y-3">
        {summaries.map((s) => (
          <div
            key={s.id}
            className={`p-4 rounded-xl cursor-pointer transition-all hover:shadow-sm ${
              selectedId === s.id
                ? "bg-blue-50/80 border border-blue-100"
                : "bg-gray-50/80 hover:bg-gray-100/80"
            }`}
            onClick={() => onSelect(s)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">
                {s.summaryType === "STUDENT_SUMMARY"
                  ? "Student Summary"
                  : s.summaryType === "DRAFT_DESCRIPTION"
                  ? "Draft Deskripsi"
                  : "Transition Summary"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">v{s.version}</span>
                <Badge variant={s.isFinal ? "success" : "warning"}>
                  {s.isFinal ? "Final" : "Draft"}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
