"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { CardContainer, CardBody, CardItem } from "@/components/ui/3d-card";
import { RiskHeatmap } from "@/components/ml/RiskHeatmap";
import { api } from "@/lib/api";
import type { ClassItem, RiskData } from "@/types";

export default function MLDashboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    setSelectedClass("");
    setRiskData(null);
    api.get<ClassItem[]>("/classes")
      .then((res) => {
        if (res.success && res.data) {
          const items = res.data;
          setClasses(items);
          if (items.length > 0) setSelectedClass(items[0].id);
        }
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
      });
    api.get<{ managedClasses?: { id: string; name: string }[] }>("/dashboard/summary")
      .then((res) => {
        if (res.success && res.data) {
          const managed = res.data.managedClasses;
          if (managed && managed.length > 0) {
            const mapped = managed.map((c) => ({
              id: c.id, name: c.name, academicYearId: "", homeroomTeacherId: null,
            })) as ClassItem[];
            setClasses((prev) => {
              const ids = new Set(prev.map((c) => c.id));
              const merged = [...prev, ...mapped.filter((m) => !ids.has(m.id))];
              if (merged.length > 0 && !selectedClass) setSelectedClass(merged[0].id);
              return merged;
            });
          }
        }
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
      });
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    setError(null);
    api.get<RiskData>(`/ml/risk/class/${selectedClass}`)
      .then((res) => {
        if (res.success && res.data) setRiskData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data risiko");
        setLoading(false);
      });
  }, [selectedClass]);

  return (
    <AuthGuard roles={["ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH"]}>
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={8} />
        <div className="relative p-6 bg-gradient-to-br from-white via-fuchsia-50/30 to-purple-50/30 rounded-2xl border border-fuchsia-100/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ML Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Analisis risiko dan prediksi akademik
              </p>
            </div>
            <select
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name} - {c.academicYear?.year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {riskData && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CardContainer className="w-full">
              <CardBody className="bg-white rounded-xl border border-gray-200 p-4 text-center w-full">
                <CardItem translateZ="30">
                  <p className="text-xs text-muted-foreground">Total Siswa</p>
                  <p className="text-2xl font-bold text-gray-900">
                    <NumberTicker value={riskData.summary.total} />
                  </p>
                </CardItem>
              </CardBody>
            </CardContainer>
            <MagicCard className="p-4 text-center" gradientSize={150}>
              <p className="text-xs text-muted-foreground">Kritis</p>
              <p className="text-2xl font-bold text-red-600">
                <NumberTicker value={riskData.summary.kritis} />
              </p>
            </MagicCard>
            <MagicCard className="p-4 text-center" gradientSize={150}>
              <p className="text-xs text-muted-foreground">Waspada</p>
              <p className="text-2xl font-bold text-yellow-600">
                <NumberTicker value={riskData.summary.waspada} />
              </p>
            </MagicCard>
            <MagicCard className="p-4 text-center" gradientSize={150}>
              <p className="text-xs text-muted-foreground">Aman</p>
              <p className="text-2xl font-bold text-green-600">
                <NumberTicker value={riskData.summary.aman} />
              </p>
            </MagicCard>
          </div>

          {/* Risk Heatmap */}
          <MagicCard className="p-6">
            <RiskHeatmap results={riskData.results} summary={riskData.summary} />
          </MagicCard>
        </>
      )}

      {!loading && error && (
        <div className="text-center py-12 text-red-500">
          <p>{error}</p>
          <button
            onClick={refresh}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {!loading && !error && !riskData && (
        <div className="text-center py-12 text-muted-foreground">
          Pilih kelas untuk melihat analisis risiko
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
