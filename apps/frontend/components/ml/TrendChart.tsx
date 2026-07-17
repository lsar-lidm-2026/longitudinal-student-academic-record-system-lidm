"use client";

interface TrendChartProps {
  features: {
    avgKnowledge: number;
    avgSkills: number;
    scoreDelta: number;
    semesterCount: number;
    scoreVolatility: number;
    totalAbsence: number;
    achievementCount: number;
  };
  trend: {
    trend: "NAIK" | "STABIL" | "TURUN";
    description: string;
  };
}

export function TrendChart({ features, trend }: TrendChartProps) {
  const trendColor =
    trend.trend === "NAIK" ? "text-green-600" : trend.trend === "TURUN" ? "text-red-600" : "text-yellow-600";
  const trendBg =
    trend.trend === "NAIK" ? "bg-green-50 border-green-200" : trend.trend === "TURUN" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200";

  return (
    <div className="space-y-4">
      {/* Trend Banner */}
      <div className={`p-3 rounded-lg border ${trendBg}`}>
        <p className={`text-sm font-medium ${trendColor}`}>{trend.description}</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Rata-rata Pengetahuan</p>
          <p className="text-lg font-bold text-gray-900">{features.avgKnowledge}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Rata-rata Keterampilan</p>
          <p className="text-lg font-bold text-gray-900">{features.avgSkills}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Delta Semester</p>
          <p className={`text-lg font-bold ${features.scoreDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
            {features.scoreDelta >= 0 ? "+" : ""}{features.scoreDelta}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Volatilitas</p>
          <p className="text-lg font-bold text-gray-900">{features.scoreVolatility}</p>
        </div>
      </div>

      {/* Simple Bar Chart - Knowledge Score Progression */}
      {features.semesterCount > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Riwayat Nilai ({features.semesterCount} semester)</p>
          <div className="flex items-end gap-2 h-24">
            <div className="flex-1 flex flex-col items-center justify-end">
              <span className="text-xs font-medium text-blue-600 mb-1">{features.avgKnowledge}</span>
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.min(features.avgKnowledge, 100)}%` }}
              />
              <span className="text-xs text-gray-400 mt-1">Pengetahuan</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-end">
              <span className="text-xs font-medium text-green-600 mb-1">{features.avgSkills}</span>
              <div
                className="w-full bg-green-500 rounded-t"
                style={{ height: `${Math.min(features.avgSkills, 100)}%` }}
              />
              <span className="text-xs text-gray-400 mt-1">Keterampilan</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-end">
              <span className="text-xs font-medium text-gray-600 mb-1">{features.totalAbsence}</span>
              <div
                className="w-full bg-orange-400 rounded-t"
                style={{ height: `${Math.min(features.totalAbsence * 10, 100)}%` }}
              />
              <span className="text-xs text-gray-400 mt-1">Absensi</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-end">
              <span className="text-xs font-medium text-purple-600 mb-1">{features.achievementCount}</span>
              <div
                className="w-full bg-purple-500 rounded-t"
                style={{ height: `${Math.min(features.achievementCount * 25, 100)}%` }}
              />
              <span className="text-xs text-gray-400 mt-1">Prestasi</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
