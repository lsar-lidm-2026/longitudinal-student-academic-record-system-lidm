"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BorderBeam } from "@/components/ui/border-beam";
import { MagicCard } from "@/components/ui/magic-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState("");
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");
  const [dbStatus, setDbStatus] = useState<string>("");
  const [mlStatus, setMlStatus] = useState<string>("");

  useEffect(() => {
    setApiUrl(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api");
    checkHealth();
  }, []);

  async function checkHealth() {
    setApiStatus("checking");
    try {
      const res = await api.get<any>("/health");
      if (res.success && res.data) {
        const data = res.data as any;
        setApiStatus("ok");
        setDbStatus(data.database?.ok ? "Terhubung" : "Error");
        setMlStatus(data.analytics?.trained ? "Model siap" : "Belum dilatih");
      } else {
        setApiStatus("error");
      }
    } catch {
      setApiStatus("error");
      setDbStatus("Tidak terdeteksi");
      setMlStatus("Tidak terdeteksi");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="relative">
        <BorderBeam className="absolute inset-0 rounded-2xl" duration={8} />
        <div className="relative p-6 bg-gradient-to-br from-white via-gray-50/30 rounded-2xl border border-gray-100/50">
          <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
          <p className="text-sm text-muted-foreground mt-1">Informasi sistem dan koneksi</p>
        </div>
      </div>

      <MagicCard className="p-6" gradientSize={200}>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Status Koneksi</h3>
        <p className="text-xs text-muted-foreground mb-4">Informasi layanan backend</p>
        <Separator className="mb-4" />

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg">
            <span className="text-gray-600">API URL</span>
            <span className="font-mono text-gray-900">{apiUrl}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg">
            <span className="text-gray-600">Status API</span>
            <span
              className={`font-medium flex items-center gap-1.5 ${
                apiStatus === "ok"
                  ? "text-green-600"
                  : apiStatus === "error"
                  ? "text-red-600"
                  : "text-gray-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  apiStatus === "ok"
                    ? "bg-green-500"
                    : apiStatus === "error"
                    ? "bg-red-500"
                    : "bg-gray-300 animate-pulse"
                }`}
              />
              {apiStatus === "ok"
                ? "Online"
                : apiStatus === "error"
                ? "Offline"
                : "Memeriksa..."}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg">
            <span className="text-gray-600">Database</span>
            <span
              className={`font-medium ${
                dbStatus === "Terhubung" ? "text-green-600" : "text-red-600"
              }`}
            >
              {dbStatus}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg">
            <span className="text-gray-600">ML Model</span>
            <span className="font-medium text-gray-700">{mlStatus}</span>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={checkHealth}
          loading={apiStatus === "checking"}
        >
          Periksa Ulang
        </Button>
      </MagicCard>

      <MagicCard className="p-6" gradientSize={200}>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Aplikasi</h3>
        <p className="text-xs text-muted-foreground mb-4">Informasi versi aplikasi</p>
        <Separator className="mb-4" />

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg">
            <span className="text-gray-600">Aplikasi</span>
            <span className="font-medium text-gray-900">
              LSAR - Longitudinal Student Academic Record
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg">
            <span className="text-gray-600">Tujuan</span>
            <span className="text-gray-600 text-right max-w-sm">
              Sistem bantu administrasi Buku Induk berbasis AI untuk guru SD
            </span>
          </div>
        </div>
      </MagicCard>
    </div>
  );
}
