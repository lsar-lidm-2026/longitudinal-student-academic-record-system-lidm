"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { MagicCard } from "@/components/ui/magic-card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BorderBeam } from "@/components/ui/border-beam";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { Separator } from "@/components/ui/separator";
import { AdministrativeStatus } from "@/components/dashboard/AdministrativeStatus";
import { api } from "@/lib/api";
import type { DashboardSummary } from "@/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardSummary>("/dashboard/summary").then((res) => {
      if (res.success && res.data) {
        setData(res.data as DashboardSummary);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        Gagal memuat data dashboard
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={8} />
        <div className="relative p-6 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 rounded-2xl border border-blue-100/50">
          <AnimatedShinyText className="inline-flex text-2xl font-bold text-gray-900">
            Dashboard
          </AnimatedShinyText>
          <p className="text-sm text-muted-foreground mt-1">
            Tahun Ajaran: {data.activeYear || "Belum diatur"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MagicCard className="p-6" gradientSize={200}>
          <p className="text-sm text-muted-foreground">Total Siswa</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            <NumberTicker value={data.totalStudents} />
          </p>
          <div className="mt-2 h-1 w-12 bg-blue-500 rounded-full" />
        </MagicCard>

        {"totalClasses" in data && data.totalClasses !== undefined && (
          <MagicCard className="p-6" gradientSize={200}>
            <p className="text-sm text-muted-foreground">Total Kelas</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              <NumberTicker value={data.totalClasses} />
            </p>
            <div className="mt-2 h-1 w-12 bg-green-500 rounded-full" />
          </MagicCard>
        )}

        {data.pendingAiDrafts !== undefined && (
          <MagicCard className="p-6" gradientSize={200}>
            <p className="text-sm text-muted-foreground">Draft AI Pending</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              <NumberTicker value={data.pendingAiDrafts} />
            </p>
            <div className="mt-3">
              <Badge variant={data.pendingAiDrafts > 0 ? "warning" : "success"}>
                {data.pendingAiDrafts > 0 ? "Perlu review" : "Semua selesai"}
              </Badge>
            </div>
          </MagicCard>
        )}
      </div>

      {"managedClasses" in data && data.managedClasses && data.managedClasses.length > 0 && (
        <MagicCard className="p-6" gradientSize={250}>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Kelas yang Diampu</h3>
          <Separator className="mb-4" />
          <div className="space-y-2">
            {data.managedClasses.map((cls) => (
              <div
                key={cls.id}
                className="flex items-center justify-between p-3 bg-gray-50/80 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">{cls.name}</span>
                <span className="text-sm text-muted-foreground">
                  {cls._count?.students || 0} siswa
                </span>
              </div>
            ))}
          </div>
        </MagicCard>
      )}

      <AdministrativeStatus />
    </div>
  );
}
