"use client";

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

function StatusBadge({ isComplete, label }: { isComplete: boolean; label: string }) {
  if (isComplete) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-100">
      {label}
    </span>
  );
}

export function ValidationBadges({ validation }: ValidationBadgesProps) {
  if (validation.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Status Kelengkapan
      </h3>
      <div className="space-y-2">
        {validation.map((v, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 text-sm p-3 bg-gray-50/50 rounded-lg border border-gray-100"
          >
            <span className="w-36 font-medium text-gray-700">
              {v.year} - Sem {v.semester}
            </span>
            <StatusBadge isComplete={v.status.subjectScores === "complete"} label="Nilai" />
            <StatusBadge isComplete={v.status.attendance === "complete"} label="Hadir" />
            <StatusBadge isComplete={v.status.healthRecord === "complete"} label="Kesehatan" />
          </div>
        ))}
      </div>
    </div>
  );
}
