"use client";

import { useState } from "react";
import { FileUpload } from "@/components/ui/FileUpload";
import { api } from "@/lib/api";
import { Camera, Loader2 } from "lucide-react";

interface Biodata {
  nis: string;
  nisn: string;
  name: string;
  gender: string;
  className: string;
  photoUrl?: string | null;
}

interface BiodataCardProps {
  biodata: Biodata;
  studentId?: string;
  onPhotoUpdate?: (url: string) => void;
}

export function BiodataCard({ biodata, studentId, onPhotoUpdate }: BiodataCardProps) {
  const [uploading, setUploading] = useState(false);

  async function handlePhotoUpload(file: File) {
    if (!studentId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${API_URL}/upload/students/${studentId}/photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        onPhotoUpdate?.(data.data.url);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Biodata</h3>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Photo */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-200/60 flex items-center justify-center">
            {biodata.photoUrl ? (
              <img
                src={biodata.photoUrl}
                alt={biodata.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Camera className="w-8 h-8 text-blue-400" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          {studentId && (
            <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer font-medium">
              {biodata.photoUrl ? "Ganti Foto" : "Tambah Foto"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await handlePhotoUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {/* Data */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-gray-50/50 rounded-lg">
            <span className="text-muted-foreground">Nama: </span>
            <span className="font-medium text-gray-900">{biodata.name}</span>
          </div>
          <div className="p-3 bg-gray-50/50 rounded-lg">
            <span className="text-muted-foreground">NIS: </span>
            <span className="font-medium text-gray-900">{biodata.nis}</span>
          </div>
          <div className="p-3 bg-gray-50/50 rounded-lg">
            <span className="text-muted-foreground">NISN: </span>
            <span className="font-medium text-gray-900">{biodata.nisn}</span>
          </div>
          <div className="p-3 bg-gray-50/50 rounded-lg">
            <span className="text-muted-foreground">Kelas: </span>
            <span className="font-medium text-gray-900">{biodata.className}</span>
          </div>
          {biodata.gender && (
            <div className="p-3 bg-gray-50/50 rounded-lg">
              <span className="text-muted-foreground">Jenis Kelamin: </span>
              <span className="font-medium text-gray-900">{biodata.gender}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
