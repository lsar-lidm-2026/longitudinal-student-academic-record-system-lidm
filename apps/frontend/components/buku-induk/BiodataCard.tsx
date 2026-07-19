/**
 * BiodataCard — Komponen kartu biodata siswa pada halaman Buku Induk.
 * ===================================================================
 *
 * Cara Kerja:
 * 1. Menerima props `biodata` (object Biodata), `studentId` (opsional), dan `onPhotoUpdate` (opsional).
 * 2. Menampilkan foto profil siswa (atau placeholder Camera icon) beserta detail biodata.
 * 3. Jika `studentId` tersedia, user dapat mengunggah/mengganti foto melalui input file.
 * 4. Unggahan dilakukan via POST fetch ke endpoint `/upload/students/{id}/photo` dengan FormData.
 * 5. State `uploading` mengontrol tampilan spinner overlay saat upload berlangsung.
 *
 * Alur:
 * - Komponen di-mount dengan data biodata dari parent.
 * - User klik "Tambah Foto" / "Ganti Foto" → pilih file → handlePhotoUpload(file).
 * - handlePhotoUpload: setUploading(true) → POST FormData → parse response →
 *   onPhotoUpdate?(url) → setUploading(false).
 * - onError pada <img> menyembunyikan gambar jika URL foto rusak.
 *
 * @module BiodataCard
 */

"use client";

import { useState } from "react";
import { FileUpload } from "@/components/ui/FileUpload";
import { api, API_BASE_URL } from "@/lib/api";
import { Camera, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

/** Tipe data biodata siswa yang ditampilkan di kartu */
interface Biodata {
  /** Nomor Induk Siswa */
  nis: string;
  /** Nomor Induk Siswa Nasional */
  nisn: string;
  /** Nama lengkap siswa */
  name: string;
  /** Jenis kelamin (L/P) */
  gender: string;
  /** Nama kelas saat ini */
  className: string;
  /** URL foto profil siswa (nullable) */
  photoUrl?: string | null;
}

/** Props yang diterima komponen BiodataCard */
interface BiodataCardProps {
  /** Data biodata siswa */
  biodata: Biodata;
  /** ID unik siswa — diperlukan untuk upload foto */
  studentId?: string;
  /** Callback setelah foto berhasil diupload — menerima URL foto baru */
  onPhotoUpdate?: (url: string) => void;
}

/**
 * BiodataCard — menampilkan foto profil dan detail biodata siswa.
 * @param {BiodataCardProps} props - biodata, studentId (opsional), onPhotoUpdate (opsional)
 */
export function BiodataCard({ biodata, studentId, onPhotoUpdate }: BiodataCardProps) {
  /** State indikator proses upload foto — true saat upload berlangsung */
  const [uploading, setUploading] = useState(false);

  /**
   * Menangani upload foto siswa ke server.
   * @param file - File gambar yang dipilih user
   */
  async function handlePhotoUpload(file: File): Promise<void> {
    // Validasi: jika tidak ada studentId, batalkan upload
    if (!studentId) {
      logger.warn("BiodataCard", "Upload dibatalkan — studentId tidak tersedia");
      return;
    }

    setUploading(true);
    logger.info("BiodataCard", "Mulai upload foto", {
      studentId,
      fileName: file.name,
      fileSize: file.size,
    });

    try {
      // Siapkan FormData dengan file gambar
      const formData = new FormData();
      formData.append("file", file);

      // Ambil base URL API dari env, fallback ke localhost
      const API_URL = API_BASE_URL;
      // Ambil token JWT dari localStorage untuk authorization
      const token = localStorage.getItem("accessToken");

      // Kirim POST request ke endpoint upload foto
      const res = await fetch(`${API_URL}/upload/students/${studentId}/photo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();

      // Jika sukses dan ada URL, panggil callback onPhotoUpdate
      if (data.success && data.data?.url) {
        logger.info("BiodataCard", "Foto berhasil diupload", {
          url: data.data.url,
        });
        onPhotoUpdate?.(data.data.url);
      } else {
        logger.warn("BiodataCard", "Upload foto gagal — response tidak mengandung URL", {
          response: data,
        });
      }
    } catch (err) {
      logger.error("BiodataCard", "Error saat upload foto", { err, studentId });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-4">Biodata</h3>
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Bagian Foto Profil */}
        <div className="flex flex-col items-center gap-2">
          {/* Container foto dengan gradient background */}
          <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-200/60 flex items-center justify-center">
            {/* Jika ada URL foto, tampilkan gambar; jika tidak, tampilkan icon Camera */}
            {biodata.photoUrl ? (
              <img
                src={biodata.photoUrl}
                alt={biodata.name}
                className="w-full h-full object-cover"
                // Sembunyikan gambar jika URL rusak (onError)
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Camera className="w-8 h-8 text-blue-400" />
            )}

            {/* Overlay loading spinner saat upload */}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Tombol upload foto — hanya tampil jika studentId ada */}
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
                  // Reset value agar file yang sama bisa dipilih ulang
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {/* Bagian Data Biodata */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {/* Nama siswa */}
          <div className="p-3 bg-gray-50/50 rounded-lg">
            <span className="text-muted-foreground">Nama: </span>
            <span className="font-medium text-gray-900">{biodata.name}</span>
          </div>

          {/* NIS */}
          <div className="p-3 bg-gray-50/50 rounded-lg">
            <span className="text-muted-foreground">NIS: </span>
            <span className="font-medium text-gray-900">{biodata.nis}</span>
          </div>

          {/* NISN */}
          <div className="p-3 bg-gray-50/50 rounded-lg">
            <span className="text-muted-foreground">NISN: </span>
            <span className="font-medium text-gray-900">{biodata.nisn}</span>
          </div>

          {/* Kelas */}
          <div className="p-3 bg-gray-50/50 rounded-lg">
            <span className="text-muted-foreground">Kelas: </span>
            <span className="font-medium text-gray-900">{biodata.className}</span>
          </div>

          {/* Jenis kelamin — hanya tampil jika ada */}
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
