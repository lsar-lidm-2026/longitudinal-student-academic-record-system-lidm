"use client";

import { SemesterRecord } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface StudentTimelineProps {
  semesterRecords: SemesterRecord[];
}

export function StudentTimeline({ semesterRecords }: StudentTimelineProps) {
  if (semesterRecords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Belum ada data semester
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {semesterRecords.map((record, idx) => {
        const avgKnowledge =
          record.subjectScores.length > 0
            ? Math.round(
                record.subjectScores.reduce((sum, s) => sum + s.knowledgeScore, 0) /
                  record.subjectScores.length
              )
            : 0;
        const avgSkills =
          record.subjectScores.length > 0
            ? Math.round(
                record.subjectScores.reduce((sum, s) => sum + s.skillsScore, 0) /
                  record.subjectScores.length
              )
            : 0;
        const totalAbsence =
          (record.attendance?.sick || 0) +
          (record.attendance?.permission || 0) +
          (record.attendance?.absent || 0);

        return (
          <div key={record.id} className="relative pl-8">
            {idx < semesterRecords.length - 1 && (
              <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 to-blue-100" />
            )}
            <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Badge variant="info">
                    {record.academicYear?.year || "TA"}
                  </Badge>
                  <span className="text-sm font-semibold text-gray-900">
                    Semester {record.semester === 1 ? "Ganjil" : "Genap"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    P: {avgKnowledge}
                  </span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    K: {avgSkills}
                  </span>
                  <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    A: {totalAbsence}
                  </span>
                </div>
              </div>

              <Separator className="mb-3" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {record.subjectScores.slice(0, 4).map((sc) => (
                  <div
                    key={sc.id}
                    className="flex justify-between px-2 py-1 bg-gray-50/80 rounded-md text-xs"
                  >
                    <span className="text-gray-600 truncate mr-2">
                      {sc.subjectName}
                    </span>
                    <span className="font-semibold text-blue-700 whitespace-nowrap">
                      {sc.knowledgeScore}/{sc.skillsScore}
                    </span>
                  </div>
                ))}
                {record.subjectScores.length > 4 && (
                  <div className="flex items-center justify-center text-xs text-muted-foreground col-span-full">
                    +{record.subjectScores.length - 4} mata pelajaran lainnya
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
