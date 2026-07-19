/**
 * AttendanceInput — Komponen input angka untuk data absensi siswa (Sakit, Izin, Alpha).
 * ======================================================================================
 *
 * Cara Kerja:
 * 1. Komponen menerima props `attendance` (object {sick, permission, absent}) dan `onChange` callback.
 * 2. Menampilkan tiga input number dalam layout flex wrap.
 * 3. Setiap perubahan nilai akan memanggil `onChange` dengan salinan objek attendance yang diperbarui.
 *
 * Alur:
 * - Parent menyediakan state attendance dan onChange handler.
 * - User mengubah nilai di salah satu input → onChange({...attendance, field: Number(e.target.value)}).
 * - Parent menerima data terbaru dan menyimpannya di state.
 *
 * @module AttendanceInput
 */

"use client";

import { logger } from "@/lib/logger";

/** Tipe data absensi: jumlah hari Sakit, Izin, dan Alpha (tanpa keterangan) */
interface AttendanceData {
  sick: number;
  permission: number;
  absent: number;
}

/** Props yang diterima komponen AttendanceInput */
interface AttendanceInputProps {
  /** Object data absensi saat ini */
  attendance: AttendanceData;
  /** Callback saat nilai absensi berubah — dipanggil dengan data terbaru */
  onChange: (attendance: AttendanceData) => void;
}

/**
 * AttendanceInput — render tiga input number untuk Sakit, Izin, Alpha.
 * @param {AttendanceInputProps} props - attendance data + onChange handler
 */
export function AttendanceInput({ attendance, onChange }: AttendanceInputProps) {
  /** Handler perubahan nilai — memperbarui field tertentu pada object attendance */
  function handleChange(field: keyof AttendanceData, value: string): void {
    // Konversi string ke number, fallback 0 jika kosong
    const numValue = value === "" ? 0 : Number(value);

    logger.info("AttendanceInput", `Nilai ${field} berubah`, {
      [field]: numValue,
      prevValue: attendance[field],
    });

    onChange({ ...attendance, [field]: numValue });
  }

  return (
    <div className="flex flex-wrap gap-4">
      {/* Input Sakit */}
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Sakit
        </label>
        <input
          type="number"
          min="0"
          value={attendance.sick || ""}
          onChange={(e) => handleChange("sick", e.target.value)}
          className="w-24 h-9 px-3 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
        />
      </div>

      {/* Input Izin */}
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Izin
        </label>
        <input
          type="number"
          min="0"
          value={attendance.permission || ""}
          onChange={(e) => handleChange("permission", e.target.value)}
          className="w-24 h-9 px-3 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
        />
      </div>

      {/* Input Alpha (tanpa keterangan) */}
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
          Alpha
        </label>
        <input
          type="number"
          min="0"
          value={attendance.absent || ""}
          onChange={(e) => handleChange("absent", e.target.value)}
          className="w-24 h-9 px-3 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
        />
      </div>
    </div>
  );
}
