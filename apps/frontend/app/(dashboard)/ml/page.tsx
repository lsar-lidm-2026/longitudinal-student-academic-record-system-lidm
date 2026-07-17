"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { RiskHeatmap } from "../../../components/ml/RiskHeatmap";
import { api } from "../../../lib/api";
import type { ClassItem } from "../../../types";

export default function MLDashboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Try classes endpoint, fallback to dashboard for guru
    api.get<ClassItem[]>("/classes").then((res) => {
      if (res.success && res.data) {
        setClasses(res.data as ClassItem[]);
        if ((res.data as ClassItem[]).length > 0) {
          setSelectedClass((res.data as ClassItem[])[0].id);
        }
      }
    });
    // Also try dashboard for guru managed classes
    api.get<any>("/dashboard/summary").then((res) => {
      if (res.success && res.data?.managedClasses?.length > 0) {
        const managed = res.data.managedClasses.map((c: any) => ({
          id: c.id,
          name: c.name,
          academicYearId: "",
        })) as ClassItem[];
        setClasses((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          const merged = [...prev, ...managed.filter((m: any) => !ids.has(m.id))];
          if (merged.length > 0 && !selectedClass) {
            setSelectedClass(merged[0].id);
          }
          return merged;
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    api.get(`/ml/risk/class/${selectedClass}`).then((res) => {
      if (res.success && res.data) {
        setRiskData(res.data as any);
      }
      setLoading(false);
    });
  }, [selectedClass]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ML Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analisis risiko dan prediksi akademik berbasis data longitudinal
          </p>
        </div>
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} - {c.academicYear?.year}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {riskData && !loading && (
        <Card>
          <RiskHeatmap results={riskData.results} summary={riskData.summary} />
        </Card>
      )}

      {!loading && !riskData && (
        <div className="text-center py-12 text-gray-500">
          Pilih kelas untuk melihat analisis risiko
        </div>
      )}
    </div>
  );
}
