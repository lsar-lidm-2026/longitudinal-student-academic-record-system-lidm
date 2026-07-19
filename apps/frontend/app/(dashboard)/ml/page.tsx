"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman ML Dashboard menampilkan analisis prediksi akademik dan heatmap
 * risiko siswa berdasarkan histori nilai. Menggunakan komponen RiskHeatmap.
 *
 * Alur lengkap:
 * 1. useEffect memanggil refresh() saat mount:
 *    - GET /classes → daftar kelas.
 *    - GET /dashboard/summary → mengambil managedClasses (kelas yang dibimbing
 *      user guru) dan menggabungkannya dengan daftar kelas dari endpoint classes.
 * 2. Setelah kelas dipilih (selectedClass), useEffect kedua fetch data risiko
 *    dari /ml/risk/class/:id.
 * 3. RiskData berisi summary (total, kritis, waspada, aman) dan results array.
 * 4. Summary cards menampilkan statistik dengan warna border sesuai risiko.
 * 5. Komponen RiskHeatmap menampilkan distribusi risiko siswa secara visual.
 * 6. Loading/error/empty state di-handle dengan pesan masing-masing.
 * 7. Hanya role ADMINISTRATOR, GURU, KEPALA_SEKOLAH yang bisa mengakses.
 */

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { RiskHeatmap } from "@/components/ml/RiskHeatmap";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Users,
  Target,
  Activity,
  Layers,
  LineChart,
  Database,
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { ClassItem, RiskData, EvaluationReport, Role } from "@/types";

export default function MLDashboardPage() {
  /** Daftar kelas (dari /classes + managedClasses dari dashboard) */
  const [classes, setClasses] = useState<ClassItem[]>([]);
  /** ID kelas yang dipilih */
  const [selectedClass, setSelectedClass] = useState("");
  /** Data risiko untuk kelas yang dipilih */
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  /** Indikator loading data risiko */
  const [loading, setLoading] = useState(false);
  /** State error */
  const [error, setError] = useState<string | null>(null);

  // ── Evaluasi Model (khusus ADMINISTRATOR) ────────────────────────────
  /** Data evaluasi model dari GET /ml/eval — hanya untuk ADMINISTRATOR */
  const [evalData, setEvalData] = useState<EvaluationReport | null>(null);
  /** Loading state untuk fetch evaluasi */
  const [evalLoading, setEvalLoading] = useState(false);
  /** Error state untuk fetch evaluasi */
  const [evalError, setEvalError] = useState<string | null>(null);
  /** Role user yang login — untuk menentukan visibilitas section evaluasi */
  const [userRole, setUserRole] = useState<Role | null>(null);

  /**
   * refresh — Mengambil daftar kelas dan managed classes.
   * Juga mengambil user role untuk menentukan visibilitas section evaluasi,
   * dan data evaluasi model jika user adalah ADMINISTRATOR.
   */
  function refresh() {
    setError(null);
    setSelectedClass("");
    setRiskData(null);
    logger.info("MLDashboardPage", "Memuat data kelas");
    api.handleResponse(api.get<ClassItem[]>("/classes"))
      .then((items) => {
        setClasses(items);
        if (items.length > 0) setSelectedClass(items[0].id);
        logger.info("MLDashboardPage", "Kelas berhasil dimuat", { count: items.length });
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
        logger.error("MLDashboardPage", "Gagal memuat kelas", { err });
      });
    // Ambil managed classes dari dashboard summary (untuk guru)
    api.handleResponse(api.get<{ managedClasses?: { id: string; name: string }[] }>("/dashboard/summary"))
      .then((data) => {
        const managed = data.managedClasses;
        if (managed && managed.length > 0) {
          // Map ke format ClassItem (dengan field minimal)
          const mapped = managed.map((c) => ({
            id: c.id, name: c.name, academicYearId: "", homeroomTeacherId: null,
          })) as ClassItem[];
          // Gabungkan dengan kelas yang sudah ada, hindari duplikasi
          setClasses((prev) => {
            const ids = new Set(prev.map((c) => c.id));
            const merged = [...prev, ...mapped.filter((m) => !ids.has(m.id))];
            if (merged.length > 0 && !selectedClass) setSelectedClass(merged[0].id);
            return merged;
          });
          logger.info("MLDashboardPage", "Managed classes dimuat", { count: managed.length });
        }
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data");
        logger.error("MLDashboardPage", "Gagal memuat managed classes", { err });
      });

    // Ambil role user dari /auth/me — untuk kontrol akses evaluasi
    api.handleResponse(api.get<{ userId: string; role: Role }>("/auth/me"))
      .then((data) => {
        setUserRole(data.role);
        logger.info("MLDashboardPage", "User role fetched", { role: data.role });

        // Jika ADMINISTRATOR, ambil juga data evaluasi model
        if (data.role === "ADMINISTRATOR") {
          fetchEvalData();
        }
      })
      .catch((err) => {
        logger.warn("MLDashboardPage", "Gagal mengambil user role", { err });
      });
  }

  /**
   * fetchEvalData — Mengambil data evaluasi model dari GET /ml/eval.
   * Hanya dipanggil untuk role ADMINISTRATOR.
   * Menampilkan: feature analysis, risk distribution, cluster evaluation, trend evaluation.
   */
  function fetchEvalData() {
    setEvalLoading(true);
    setEvalError(null);
    logger.info("MLDashboardPage", "Mengambil data evaluasi model");
    api.handleResponse(api.get<EvaluationReport>("/ml/eval"))
      .then((data) => {
        setEvalData(data);
        logger.info("MLDashboardPage", "Data evaluasi model berhasil dimuat", {
          nStudents: data.nStudents,
          featureCount: data.featureStats.length,
        });
      })
      .catch((err) => {
        const msg = err.message || "Gagal memuat data evaluasi";
        setEvalError(msg);
        logger.error("MLDashboardPage", "Gagal memuat evaluasi model", { err });
        toast.error("Gagal memuat data evaluasi model");
      })
      .finally(() => {
        setEvalLoading(false);
      });
  }

  /** Trigger refresh saat mount */
  useEffect(() => { refresh(); }, []);

  /** Fetch data risiko saat selectedClass berubah */
  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    setError(null);
    logger.info("MLDashboardPage", "Mengambil data risiko", { classId: selectedClass });
    api.handleResponse(api.get<RiskData>(`/ml/risk/class/${selectedClass}`))
      .then((data) => {
        setRiskData(data);
        logger.info("MLDashboardPage", "Data risiko berhasil dimuat", {
          total: data.summary.total,
          kritis: data.summary.kritis,
          waspada: data.summary.waspada,
          aman: data.summary.aman,
        });
      })
      .catch((err) => {
        setError(err.message || "Gagal memuat data risiko");
        logger.error("MLDashboardPage", "Gagal memuat data risiko", { err });
      })
      .finally(() => setLoading(false));
  }, [selectedClass]);

  return (
    /* AuthGuard: hanya role tertentu yang bisa melihat ML dashboard */
    <AuthGuard roles={["ADMINISTRATOR", "GURU", "KEPALA_SEKOLAH"]}>
      <div className="space-y-6 max-w-6xl mx-auto">

        {/* ── Header + Class Selector ────────────────────────────────── */}
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
          {/* Dropdown pilih kelas */}
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
              {/* Custom dropdown arrow */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── Loading State ───────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
            <p className="text-sm text-gray-500">Menganalisis data kelas...</p>
          </div>
        )}

        {/* ── Risk Data Loaded ────────────────────────────────────────── */}
        {riskData && !loading && (
          <>
            {/* Summary Cards — 4 kartu statistik */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Total Siswa */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Siswa</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{riskData.summary.total}</p>
              </div>

              {/* Kritis — border merah */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col justify-center border-b-4 border-b-red-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kritis</p>
                </div>
                <p className="text-3xl font-bold text-red-600">{riskData.summary.kritis}</p>
              </div>

              {/* Waspada — border amber */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col justify-center border-b-4 border-b-amber-500">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Waspada</p>
                </div>
                <p className="text-3xl font-bold text-amber-600">{riskData.summary.waspada}</p>
              </div>

              {/* Aman — border hijau */}
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

            {/* ── Risk Heatmap ────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900">Distribusi Risiko Siswa (Heatmap)</h3>
              </div>
              <div className="p-5">
                {/* Komponen RiskHeatmap — render visual distribusi risiko */}
                <RiskHeatmap results={riskData.results} summary={riskData.summary} />
              </div>
            </div>
          </>
        )}

        {/* ── Evaluasi Model (khusus ADMINISTRATOR) ─────────────────────── */}
        {/* Section ini hanya ditampilkan untuk user dengan role ADMINISTRATOR */}
        {userRole === "ADMINISTRATOR" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-500" />
                Evaluasi Model ML
              </h3>
              <button
                onClick={fetchEvalData}
                disabled={evalLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 hover:text-gray-700 transition-colors disabled:opacity-50"
                title="Refresh evaluasi"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${evalLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="p-5">
              {/* Loading State Evaluasi */}
              {evalLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-3" />
                  <p className="text-sm text-gray-500">Mengevaluasi model...</p>
                </div>
              )}

              {/* Error State Evaluasi */}
              {!evalLoading && evalError && (
                <div className="text-center py-6">
                  <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-500 mb-3">{evalError}</p>
                  <button
                    onClick={fetchEvalData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Coba Lagi
                  </button>
                </div>
              )}

              {/* Data Evaluasi */}
              {!evalLoading && !evalError && evalData && (
                <div className="space-y-6">

                  {/* ── Ringkasan Evaluasi ────────────────────────────── */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                      <p className="text-xs text-purple-600 font-medium">Siswa Dianalisis</p>
                      <p className="text-lg font-bold text-purple-700">{evalData.nStudents}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-blue-600 font-medium">Missing Data</p>
                      <p className="text-lg font-bold text-blue-700">{evalData.dataQuality.missingDataPct}%</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-xs text-amber-600 font-medium">Peringatan</p>
                      <p className="text-lg font-bold text-amber-700">{evalData.dataQuality.warnings.length}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-green-600 font-medium">Generated</p>
                      <p className="text-xs font-bold text-green-700 mt-1">
                        {new Date(evalData.generatedAt).toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>

                  {/* Data Quality Warnings — daftar peringatan jika ada */}
                  {evalData.dataQuality.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-yellow-700 mb-1">Peringatan Kualitas Data:</p>
                      <ul className="space-y-0.5">
                        {evalData.dataQuality.warnings.map((w, i) => (
                          <li key={i} className="text-xs text-yellow-600 flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── Feature Analysis ────────────────────────────────── */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                      <Database className="w-4 h-4 text-blue-500" />
                      Analisis Fitur
                    </h4>
                    {/* Tabel statistik fitur: mean, std, min, max */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left py-2 px-3 font-semibold text-gray-600">Fitur</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Mean</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Std</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Min</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Max</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-600">Outlier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evalData.featureStats.map((f) => (
                            <tr key={f.name} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="py-2 px-3 font-medium text-gray-700">{f.name}</td>
                              <td className="py-2 px-3 text-right text-gray-600">{f.mean}</td>
                              <td className="py-2 px-3 text-right text-gray-600">{f.std}</td>
                              <td className="py-2 px-3 text-right text-gray-600">{f.min}</td>
                              <td className="py-2 px-3 text-right text-gray-600">{f.max}</td>
                              <td className="py-2 px-3 text-right">
                                <span className={`inline-flex items-center gap-1 ${
                                  f.outlierCount > 0 ? "text-amber-600" : "text-green-600"
                                }`}>
                                  {f.outlierCount > 0 ? (
                                    <AlertTriangle className="w-3 h-3" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  {f.outlierCount}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Risk Distribution ──────────────────────────────── */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-red-500" />
                      Distribusi Risiko
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-lg font-bold text-gray-800">{evalData.riskDistribution.total}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs text-green-600">Aman</p>
                        <p className="text-lg font-bold text-green-700">{evalData.riskDistribution.aman}</p>
                        <p className="text-[10px] text-green-500">{evalData.riskDistribution.pctAman}%</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                        <p className="text-xs text-amber-600">Waspada</p>
                        <p className="text-lg font-bold text-amber-700">{evalData.riskDistribution.waspada}</p>
                        <p className="text-[10px] text-amber-500">{evalData.riskDistribution.pctWaspada}%</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                        <p className="text-xs text-red-600">Kritis</p>
                        <p className="text-lg font-bold text-red-700">{evalData.riskDistribution.kritis}</p>
                        <p className="text-[10px] text-red-500">{evalData.riskDistribution.pctKritis}%</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-xs text-gray-500">Rata-rata Skor</p>
                        <p className="text-lg font-bold text-gray-800">{evalData.riskDistribution.avgScore}</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Cluster Evaluation ─────────────────────────────── */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Evaluasi Clustering
                    </h4>
                    {evalData.clusterEvaluation ? (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                          <p className="text-xs text-indigo-600">Jumlah Cluster</p>
                          <p className="text-lg font-bold text-indigo-700">{evalData.clusterEvaluation.nClusters}</p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                          <p className="text-xs text-indigo-600">Sampel</p>
                          <p className="text-lg font-bold text-indigo-700">{evalData.clusterEvaluation.nSamples}</p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                          <p className="text-xs text-indigo-600">Inertia</p>
                          <p className="text-lg font-bold text-indigo-700">{evalData.clusterEvaluation.inertia}</p>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                          <p className="text-xs text-indigo-600">Silhouette Score</p>
                          <p className="text-lg font-bold text-indigo-700">
                            {evalData.clusterEvaluation.silhouetteScore !== null
                              ? evalData.clusterEvaluation.silhouetteScore
                              : "N/A"}
                          </p>
                        </div>
                        {/* Detail ukuran per cluster */}
                        {evalData.clusterEvaluation.clusterSizes.map((size, idx) => (
                          <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-xs text-gray-500">Cluster {idx + 1}</p>
                            <p className="text-lg font-bold text-gray-700">{size} siswa</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                        <XCircle className="w-4 h-4" />
                        Model cluster belum di-train — tidak ada data evaluasi clustering.
                      </div>
                    )}
                  </div>

                  {/* ── Trend Evaluation ─────────────────────────────────── */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                      <LineChart className="w-4 h-4 text-emerald-500" />
                      Evaluasi Tren
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                        <p className="text-xs text-emerald-600">Dengan Tren</p>
                        <p className="text-lg font-bold text-emerald-700">{evalData.trendEvaluation.studentsWithTrend}</p>
                        <p className="text-[10px] text-emerald-500">
                          dari {evalData.trendEvaluation.totalStudents} siswa
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs text-green-600">Rata-rata Slope</p>
                        <p className="text-lg font-bold text-green-700">{evalData.trendEvaluation.avgSlope}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-xs text-blue-600">Rata-rata R²</p>
                        <p className="text-lg font-bold text-blue-700">{evalData.trendEvaluation.avgRSquared}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                        <p className="text-xs text-emerald-600">
                          <TrendingUp className="w-3 h-3 inline" /> Meningkat
                        </p>
                        <p className="text-lg font-bold text-emerald-700">{evalData.trendEvaluation.improving}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                        <p className="text-xs text-red-600">
                          <TrendingDown className="w-3 h-3 inline" /> Menurun
                        </p>
                        <p className="text-lg font-bold text-red-700">{evalData.trendEvaluation.declining}</p>
                      </div>
                    </div>

                    {/* Quality Warnings untuk trend */}
                    {evalData.trendEvaluation.qualityWarnings.length > 0 && (
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-yellow-700 mb-1">Peringatan Tren:</p>
                        <ul className="space-y-0.5">
                          {evalData.trendEvaluation.qualityWarnings.map((w, i) => (
                            <li key={i} className="text-xs text-yellow-600 flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Empty state evaluasi — jika data tidak tersedia */}
              {!evalLoading && !evalError && !evalData && (
                <div className="text-center py-8">
                  <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Data evaluasi belum tersedia</p>
                  <p className="text-xs text-gray-400 mt-1">Klik Refresh untuk memuat data evaluasi model.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Error State ─────────────────────────────────────────────── */}
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

        {/* ── Empty State (belum pilih kelas) ──────────────────────────── */}
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
