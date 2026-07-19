"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { RiskHeatmap } from "@/components/ml/RiskHeatmap";
import { api } from "@/lib/api";
import { BarChart3, TrendingDown, TrendingUp, AlertTriangle, Users, Target } from "lucide-react";
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
    api.handleResponse(api.get<ClassItem[]>("/classes"))
      .then((items) => {
        setClasses(items);
        if (items.length > 0) setSelectedClass(items[0].id);
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
      });
    api.handleResponse(api.get<{ managedClasses?: { id: string; name: string }[] }>("/dashboard/summary"))
      .then((data) => {
        const managed = data.managedClasses;
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
    api.handleResponse(api.get<RiskData>(`/ml/risk/class/${selectedClass}`))
      .then(setRiskData)
      .catch((err) => setError(err.message || "Gagal memuat data risiko"))
      .finally(() => setLoading(false));
  }, [selectedClass]);

  return (
    <AuthGuard roles={["ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH"]}>
      <div className="space-y-6 max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Machine Learning Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Analisis prediksi akademik dan heatmap risiko siswa berdasarkan histori nilai.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Pilih Kelas
            </label>
            <div className="relative">
              <select
                className="w-full h-10 px-3 pr-8 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-900 appearance-none"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.academicYear?.year ? `- ${c.academicYear.year}` : ""}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <p className="text-sm text-gray-500">Menganalisis data kelas...</p>
          </div>
        )}

        {riskData && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Siswa</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{riskData.summary.total}</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col justify-center border-b-4 border-b-red-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kritis</p>
                </div>
                <p className="text-3xl font-bold text-red-600">{riskData.summary.kritis}</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col justify-center border-b-4 border-b-amber-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Waspada</p>
                </div>
                <p className="text-3xl font-bold text-amber-600">{riskData.summary.waspada}</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col justify-center border-b-4 border-b-emerald-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Target className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aman</p>
                </div>
                <p className="text-3xl font-bold text-emerald-600">{riskData.summary.aman}</p>
              </div>

            </div>

            {/* Risk Heatmap */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900">Distribusi Risiko Siswa (Heatmap)</h3>
              </div>
              <div className="p-5">
                <RiskHeatmap results={riskData.results} summary={riskData.summary} />
              </div>
            </div>
          </>
        )}

        {!loading && error && (
          <div className="text-center py-12 bg-white rounded-xl border border-red-100 text-red-500">
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
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600">Pilih kelas di atas</p>
            <p className="text-xs text-gray-400 mt-1">Data prediksi akademik akan ditampilkan setelah Anda memilih kelas.</p>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
