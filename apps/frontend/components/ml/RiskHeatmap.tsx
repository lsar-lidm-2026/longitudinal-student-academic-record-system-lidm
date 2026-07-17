"use client";

import Link from "next/link";
import { RiskBadge } from "./RiskBadge";

interface RiskItem {
  studentId: string;
  name: string;
  risk: {
    level: "AMAN" | "WASPADA" | "KRITIS";
    score: number;
    factors: string[];
    recommendations: string[];
  };
  trend: {
    trend: "NAIK" | "STABIL" | "TURUN";
    description: string;
  };
}

interface RiskHeatmapProps {
  results: RiskItem[];
  summary: {
    total: number;
    kritis: number;
    waspada: number;
    aman: number;
  };
}

const trendIcons = {
  NAIK: "📈",
  STABIL: "➡️",
  TURUN: "📉",
};

export function RiskHeatmap({ results, summary }: RiskHeatmapProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          <p className="text-xs text-gray-500">Total Siswa</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{summary.kritis}</p>
          <p className="text-xs text-red-500">Kritis</p>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{summary.waspada}</p>
          <p className="text-xs text-yellow-500">Waspada</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{summary.aman}</p>
          <p className="text-xs text-green-500">Aman</p>
        </div>
      </div>

      {/* Risk Distribution Bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
        {summary.kritis > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${(summary.kritis / summary.total) * 100}%` }}
            title={`Kritis: ${summary.kritis}`}
          />
        )}
        {summary.waspada > 0 && (
          <div
            className="bg-yellow-500 transition-all"
            style={{ width: `${(summary.waspada / summary.total) * 100}%` }}
            title={`Waspada: ${summary.waspada}`}
          />
        )}
        {summary.aman > 0 && (
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${(summary.aman / summary.total) * 100}%` }}
            title={`Aman: ${summary.aman}`}
          />
        )}
      </div>

      {/* Student List */}
      <div className="space-y-2">
        {results.map((item) => (
          <Link
            key={item.studentId}
            href={`/students/${item.studentId}`}
            className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">{item.name}</span>
              <div className="flex items-center gap-2">
                <span title={item.trend.description}>
                  {trendIcons[item.trend.trend]}
                </span>
                <RiskBadge level={item.risk.level} score={item.risk.score} />
              </div>
            </div>
            {item.risk.factors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.risk.factors.map((f, i) => (
                  <span key={i} className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
