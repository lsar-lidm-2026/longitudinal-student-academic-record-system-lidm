"use client";

import { Input } from "@/components/ui/input";

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
      <Input
        label="Sakit"
        type="number"
        min="0"
        value={attendance.sick}
        onChange={(e) => onChange({ ...attendance, sick: Number(e.target.value) })}
        className="w-28"
      />
      <Input
        label="Izin"
        type="number"
        min="0"
        value={attendance.permission}
        onChange={(e) => onChange({ ...attendance, permission: Number(e.target.value) })}
        className="w-28"
      />
      <Input
        label="Alpha"
        type="number"
        min="0"
        value={attendance.absent}
        onChange={(e) => onChange({ ...attendance, absent: Number(e.target.value) })}
        className="w-28"
      />
    </div>
  );
}
