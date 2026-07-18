"use client";

import { useState, useRef, DragEvent } from "react";
import { Upload, X, FileIcon, ImageIcon, Loader2 } from "lucide-react";

interface FileUploadProps {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  disabled?: boolean;
}

export function FileUpload({
  onUpload,
  accept = "image/*,.pdf",
  maxSizeMB = 10,
  label = "Upload File",
  disabled = false,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File terlalu besar. Maksimal ${maxSizeMB}MB.`);
      return;
    }

    setUploading(true);
    try {
      await onUpload(file);
    } catch (e: any) {
      setError(e.message || "Upload gagal");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed
          transition-all cursor-pointer
          ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}
          ${disabled || uploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {uploading ? (
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-gray-400" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            {uploading ? "Mengupload..." : label}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            atau klik untuk memilih file
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <X className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
