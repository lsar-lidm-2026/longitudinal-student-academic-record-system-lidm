"use client";

import { useState, useEffect } from "react";
import { MagicCard } from "@/components/ui/magic-card";
import { Separator } from "@/components/ui/separator";
import { FileUpload } from "@/components/ui/FileUpload";
import { api } from "@/lib/api";
import type { StudentDocument } from "@/types";
import { FileText, Trash2, ExternalLink, Loader2 } from "lucide-react";

interface Props {
  studentId: string;
}

export function StudentDocuments({ studentId }: Props) {
  const [docs, setDocs] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  function loadDocs() {
    setLoading(true);
    api.handleResponse(api.get<StudentDocument[]>(`/upload/students/${studentId}/documents`))
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadDocs(); }, [studentId]);

  async function handleUpload(file: File) {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    const token = localStorage.getItem("accessToken");
    const formData = new FormData();
    formData.append("file", file);

    // Prompt for document name
    const name = prompt("Nama dokumen (misal: Akte Kelahiran, Kartu Keluarga):");
    if (!name) return;
    formData.append("name", name);

    setUploading(true);
    try {
      const res = await fetch(`${API_URL}/upload/students/${studentId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        loadDocs();
      } else {
        throw new Error(data.error?.message || "Upload gagal");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Hapus dokumen ini?")) return;
    await api.handleResponse(api.delete(`/upload/documents/${docId}`));
    loadDocs();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <MagicCard className="p-6" gradientSize={250}>
      <h3 className="text-base font-semibold text-gray-900 mb-1">Dokumen Siswa</h3>
      <p className="text-xs text-muted-foreground mb-4">Akte, Kartu Keluarga, dan dokumen pendukung lainnya</p>
      <Separator className="mb-4" />

      <div className="mb-4">
        <FileUpload
          onUpload={handleUpload}
          accept="image/*,.pdf,.doc,.docx"
          label={uploading ? "Mengupload..." : "Tambah Dokumen"}
          disabled={uploading}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Belum ada dokumen
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50/80 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(doc.fileSize)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </MagicCard>
  );
}
