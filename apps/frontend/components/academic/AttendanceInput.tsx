"use client";

interface AttendanceData {
  sick: number;
  permission: number;
  absent: number;
}

interface AttendanceInputProps {
  attendance: AttendanceData;
  onChange: (attendance: AttendanceData) => void;
}

export function AttendanceInput({ attendance, onChange }: AttendanceInputProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Sakit</label>
        <input
          type="number"
          min="0"
          value={attendance.sick || ""}
          onChange={(e) => onChange({ ...attendance, sick: Number(e.target.value) })}
          className="w-24 h-9 px-3 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Izin</label>
        <input
          type="number"
          min="0"
          value={attendance.permission || ""}
          onChange={(e) => onChange({ ...attendance, permission: Number(e.target.value) })}
          className="w-24 h-9 px-3 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Alpha</label>
        <input
          type="number"
          min="0"
          value={attendance.absent || ""}
          onChange={(e) => onChange({ ...attendance, absent: Number(e.target.value) })}
          className="w-24 h-9 px-3 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-center"
        />
      </div>
    </div>
  );
}
