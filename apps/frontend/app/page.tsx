"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "../lib/api";
import type { DashboardSummary } from "../types";

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tahun Ajaran: {data.activeYear || "Belum diatur"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total Siswa</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{data.totalStudents}</p>
        </Card>

        {"totalClasses" in data && data.totalClasses !== undefined && (
          <Card>
            <p className="text-sm text-gray-500">Total Kelas</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data.totalClasses}</p>
          </Card>
        )}

        {data.pendingAiDrafts !== undefined && (
          <Card>
            <p className="text-sm text-gray-500">Draft AI Pending</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data.pendingAiDrafts}</p>
            <Badge variant={data.pendingAiDrafts > 0 ? "warning" : "success"}>
              {data.pendingAiDrafts > 0 ? "Perlu review" : "Semua selesai"}
            </Badge>
          </Card>
        )}
      </div>

      {"managedClasses" in data && data.managedClasses && data.managedClasses.length > 0 && (
        <Card title="Kelas yang Diampu">
          <div className="space-y-2">
            {data.managedClasses.map((cls) => (
              <div
                key={cls.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium text-gray-900">{cls.name}</span>
                <span className="text-sm text-gray-500">
                  {cls._count?.students || 0} siswa
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
