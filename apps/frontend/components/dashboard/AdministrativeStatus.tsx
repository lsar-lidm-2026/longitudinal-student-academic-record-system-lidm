"use client";

import { useEffect, useState } from "react";
import { MagicCard } from "@/components/ui/magic-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

interface ClassStatus {
  classId: string;
  className: string;
  academicYear: string;
  homeroomTeacher: string;
  totalStudents: number;
  totalRecords: number;
  totalScores: number;
  pendingAiDrafts: number;
  completeness: number;
}

export function AdministrativeStatus() {
  const [data, setData] = useState<ClassStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ClassStatus[]>("/dashboard/administrative-status").then((res) => {
      if (res.success && res.data) {
        setData(res.data as ClassStatus[]);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <MagicCard className="p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Status Kelengkapan Data per Kelas
        </h3>
        <Separator className="mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </MagicCard>
    );
  }

  if (data.length === 0) return null;

  return (
    <MagicCard className="p-6" gradientSize={250}>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        Status Kelengkapan Data per Kelas
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Progress pengisian data akademik setiap kelas
      </p>
      <Separator className="mb-4" />

      <div className="space-y-3">
        {data.map((item) => (
          <div
            key={item.classId}
            className="p-3 bg-gray-50/50 rounded-lg hover:bg-gray-100/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">
                  {item.className}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.academicYear}
                </span>
              </div>
              <Badge
                variant={
                  item.completeness >= 80
                    ? "success"
                    : item.completeness >= 40
                    ? "warning"
                    : "danger"
                }
              >
                {item.completeness}%
              </Badge>
            </div>

            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  item.completeness >= 80
                    ? "bg-green-500"
                    : item.completeness >= 40
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${item.completeness}%` }}
              />
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>{item.totalStudents} siswa</span>
              <span>{item.totalRecords} record</span>
              {item.pendingAiDrafts > 0 && (
                <span className="text-amber-600 font-medium">
                  {item.pendingAiDrafts} draft AI pending
                </span>
              )}
              {item.homeroomTeacher && (
                <span className="text-gray-500">Wali: {item.homeroomTeacher}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </MagicCard>
  );
}
