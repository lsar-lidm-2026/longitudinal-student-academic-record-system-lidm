/**
 * FileUpload — Komponen drag-and-drop file upload dengan validasi ukuran.
 * =======================================================================
 *
 * Cara Kerja:
 * 1. Komponen menerima `onUpload` callback, `accept` (tipe file), `maxSizeMB`, `label`, `disabled`.
 * 2. User bisa memilih file via:
 *    a. Klik area upload → membuka file dialog
 *    b. Drag & drop file ke area upload
 * 3. `handleFile(file)`:
 *    a. Validasi ukuran file ≤ maxSizeMB
 *    b. Set uploading = true
 *    c. Panggil `onUpload(file)` (async)
 *    d. Jika error → set pesan error
 *    e. Finally → uploading = false
 * 4. Tampilkan indikator loading (animasi spinner) saat upload berlangsung.
 * 5. Tampilkan pesan error jika validasi gagal atau upload gagal.
 *
 * Alur Lengkap:
 *   <FileUpload onUpload={handler} accept="image/*" maxSizeMB={10} />
 *       │
 *       ├─ [Klik area] → inputRef.current.click()
 *       │       └─ onChange event → handleFile(file)
 *       │
 *       ├─ [Drag & Drop]
 *       │       ├─ onDragOver → setDragOver(true)
 *       │       ├─ onDragLeave → setDragOver(false)
 *       │       └─ onDrop → handleDrop(e) → handleFile(file)
 *       │
 *       └─ handleFile(file)
 *              ├─ Validasi ukuran (> maxSizeMB → error, return)
 *              ├─ setUploading(true)
 *              ├─ await onUpload(file)
 *              │       ├─ sukses → selesai
 *              │       └─ error → setError(e.message)
 *              └─ finally setUploading(false)
 */

"use client";

import { useState, useRef, DragEvent } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const MODULE = "FileUpload"; /** Nama module untuk logger */

/** Interface untuk props komponen FileUpload */
interface FileUploadProps {
  /** Callback async yang dipanggil dengan file yang dipilih */
  onUpload: (file: File) => Promise<void>;
  /** Tipe file yang diizinkan (accept attribute) — default: "image/*,.pdf" */
  accept?: string;
  /** Maksimum ukuran file dalam MB — default: 10 */
  maxSizeMB?: number;
  /** Label yang ditampilkan di area upload — default: "Upload File" */
  label?: string;
  /** Disabled state — default: false */
  disabled?: boolean;
}

/**
 * FileUpload — Komponen upload file dengan drag-and-drop support.
 *
 * @param onUpload - Async callback yang menerima File object
 * @param accept - Filter tipe file (default: "image/*,.pdf")
 * @param maxSizeMB - Maksimum ukuran dalam MB (default: 10)
 * @param label - Teks label (default: "Upload File")
 * @param disabled - Nonaktifkan interaksi (default: false)
 */
export function FileUpload({
  onUpload,
  accept = "image/*,.pdf",
  maxSizeMB = 10,
  label = "Upload File",
  disabled = false,
}: FileUploadProps) {
  // State untuk visual drag-over (border biru)
  const [dragOver, setDragOver] = useState(false);
  // State status upload (sedang upload / tidak)
  const [uploading, setUploading] = useState(false);
  // State pesan error
  const [error, setError] = useState<string | null>(null);
  // Ref ke input file tersembunyi
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * handleFile — Memproses file yang dipilih user.
   * Validasi ukuran, lalu panggil callback onUpload.
   *
   * @param file - File object dari input atau drag-drop
   */
  async function handleFile(file: File) {
    // Reset error sebelumnya
    setError(null);
    logger.info(MODULE, "File dipilih", { name: file.name, size: file.size, type: file.type });

    // Validate file type
    if (accept && accept !== "*") {
      const allowedTypes = accept.split(",").map(t => t.trim().toLowerCase());
      const fileType = file.type.toLowerCase();
      const isValid = allowedTypes.some(t => {
        if (t.endsWith("/*")) {
          const category = t.replace("/*", "");
          return fileType.startsWith(category);
        }
        return fileType === t || file.name.endsWith(t.replace("*", ""));
      });
      if (!isValid) {
        const errMsg = `Tipe file tidak didukung. Gunakan: ${accept}`;
        logger.warn(MODULE, "Tipe file tidak valid", { fileName: file.name, fileType: file.type, accept });
        setError(errMsg);
        return;
      }
    }

    // Validasi ukuran file
    if (file.size > maxSizeMB * 1024 * 1024) {
      const errMsg = `File terlalu besar. Maksimal ${maxSizeMB}MB.`;
      logger.warn(MODULE, "File melebihi batas ukuran", { fileName: file.name, fileSize: file.size, maxMB: maxSizeMB });
      setError(errMsg);
      return;
    }

    logger.debug(MODULE, "Validasi ukuran lolos", { fileName: file.name, fileSize: file.size });

    // Mulai proses upload
    setUploading(true);
    try {
      await onUpload(file);
      logger.info(MODULE, "Upload sukses", { fileName: file.name });
    } catch (e: any) {
      // Tangkap error dari callback onUpload
      const errMsg = e.message || "Upload gagal";
      logger.error(MODULE, "Upload gagal", { err: e, fileName: file.name });
      setError(errMsg);
    } finally {
      // Selesai upload (sukses/gagal)
      setUploading(false);
    }
  }

  /**
   * handleDrop — Handler untuk event drop pada area upload.
   *
   * @param e - DragEvent dari elemen drop target
   */
  function handleDrop(e: DragEvent) {
    e.preventDefault(); // Mencegah browser membuka file
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      logger.debug(MODULE, "File di-drop", { fileName: file.name });
      handleFile(file);
    } else {
      logger.warn(MODULE, "Drop event tanpa file");
    }
  }

  return (
    <div className="space-y-2">
      {/* Area upload (drag & drop + klik) */}
      <div
        // Event drag & drop
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        // Klik untuk membuka file dialog (kecuali disabled/uploading)
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed
          transition-all cursor-pointer
          ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}
          ${disabled || uploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {/* Icon: spinner saat upload, upload icon saat idle */}
        {uploading ? (
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-gray-400" />
        )}
        <div className="text-center">
          {/* Label: berubah saat upload */}
          <p className="text-sm font-medium text-gray-700">
            {uploading ? "Mengupload..." : label}
          </p>
          {/* Hint text */}
          <p className="text-xs text-gray-400 mt-0.5">
            atau klik untuk memilih file
          </p>
        </div>
      </div>

      {/* Input file tersembunyi — dipicu oleh klik area upload */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset value agar event onChange bisa dipicu lagi untuk file yang sama
          e.target.value = "";
        }}
      />

      {/* Pesan error (jika ada) */}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <X className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
