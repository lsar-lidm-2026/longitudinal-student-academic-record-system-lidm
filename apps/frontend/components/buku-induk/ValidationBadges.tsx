"use client";

import { Badge } from "@/components/ui/badge";

interface ValidationStatus {
  year: string;
  semester: number;
  status: {
    subjectScores: string;
    attendance: string;
    healthRecord: string;
  };
}

interface ValidationBadgesProps {
  validation: ValidationStatus[];
}

export function ValidationBadges({ validation }: ValidationBadgesProps) {
  if (validation.length === 0) return null;

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Status Kelengkapan
      </h3>
      <div className="space-y-2">
        {validation.map((v, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 text-sm p-3 bg-gray-50/50 rounded-lg"
          >
            <span className="w-36 font-medium text-gray-700">
              {v.year} - Sem {v.semester}
            </span>
            <Badge variant={v.status.subjectScores === "complete" ? "success" : "danger"}>
              Nilai
            </Badge>
            <Badge variant={v.status.attendance === "complete" ? "success" : "danger"}>
              Hadir
            </Badge>
            <Badge variant={v.status.healthRecord === "complete" ? "success" : "danger"}>
              Kesehatan
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
