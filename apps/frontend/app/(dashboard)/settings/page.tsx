"use client";

import { useEffect, useState } from "react";
import {
  User,
  Lock,
  Bell,
  Monitor,
  Shield,
  HelpCircle,
  LogOut,
  Camera,
  Trash2,
  ChevronRight,
  Save,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type SettingsTab = "profil" | "keamanan" | "notifikasi" | "preferensi" | "akses";

const settingsMenu = [
  { id: "profil" as SettingsTab, label: "Profil Pengguna", description: "Informasi pribadi dan biodata", icon: User },
  { id: "keamanan" as SettingsTab, label: "Keamanan & Sandi", description: "Ubah kata sandi dan autentikasi", icon: Lock },
  { id: "notifikasi" as SettingsTab, label: "Notifikasi", description: "Atur pemberitahuan sistem", icon: Bell },
  { id: "preferensi" as SettingsTab, label: "Preferensi Sistem", description: "Tampilan dan bahasa aplikasi", icon: Monitor },
  { id: "akses" as SettingsTab, label: "Hak Akses Peran", description: "Manajemen izin dan otorisasi", icon: Shield },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profil");
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");
  const [dbStatus, setDbStatus] = useState("");
  const [mlStatus, setMlStatus] = useState("");

  // Profile form state
  const [profileName, setProfileName] = useState("");
  const [profileNip, setProfileNip] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");

  useEffect(() => {
    checkHealth();
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await api.get<any>("/auth/me");
      if (res.success && res.data) {
        setProfileName(res.data.name || "");
      }
    } catch {}
  }

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

  function handleSaveProfile() {
    toast.success("Profil berhasil diperbarui");
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5">
        <span>Dashboard</span>
        <span>›</span>
        <span className="text-gray-700 font-medium">Pengaturan</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pengaturan Sistem</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Kelola informasi akun, preferensi notifikasi, dan konfigurasi platform LSAR.
        </p>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Menu */}
        <div className="space-y-1">
          {settingsMenu.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-blue-50 border border-blue-100"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-400"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? "text-blue-700" : "text-gray-700"}`}>
                    {item.label}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.description}</p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-400" : "text-gray-300"}`} />
              </button>
            );
          })}

          {/* Bantuan Section */}
          <div className="pt-4 mt-4 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Bantuan
            </p>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-gray-50 transition-all">
              <HelpCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Pusat Bantuan</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-red-50 transition-all">
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-500">Keluar Akun</span>
            </button>
          </div>
        </div>

        {/* Right: Content */}
        <div className="lg:col-span-2">
          {activeTab === "profil" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-900">Informasi Profil</h2>
                <p className="text-sm text-gray-400 mt-0.5">Perbarui detail pribadi Anda yang akan ditampilkan di platform.</p>

                {/* Photo */}
                <div className="mt-5 p-4 bg-gray-50 rounded-xl flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex gap-2">
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                      <Camera className="w-3 h-3" />
                      Ganti Foto
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-white transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 ml-2">Format JPG atau PNG. Maksimum 2MB.</span>
                </div>

                {/* Form */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">NIP / NUPTK</label>
                    <input
                      type="text"
                      value={profileNip}
                      onChange={(e) => setProfileNip(e.target.value)}
                      placeholder="Masukkan NIP"
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email Institusi</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="nama@sekolah.sch.id"
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">No. WhatsApp</label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+62 8xx xxxx xxxx"
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Alamat Domisili</label>
                    <input
                      type="text"
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      placeholder="Alamat lengkap"
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
                  <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    Batalkan
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Perubahan
                  </button>
                </div>
              </div>

              {/* System Info */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Status Sistem</h3>
                <div className="space-y-2">
                  <StatusRow label="API Status" value={apiStatus === "ok" ? "Online" : apiStatus === "error" ? "Offline" : "Memeriksa..."} status={apiStatus} />
                  <StatusRow label="Database" value={dbStatus || "Memeriksa..."} status={dbStatus === "Terhubung" ? "ok" : "error"} />
                  <StatusRow label="ML Model" value={mlStatus || "Memeriksa..."} status={mlStatus === "Model siap" ? "ok" : "checking"} />
                </div>
                <button
                  onClick={checkHealth}
                  className="mt-3 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  Periksa Ulang
                </button>
              </div>
            </div>
          )}

          {activeTab !== "profil" && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                {activeTab === "keamanan" && <Lock className="w-5 h-5 text-gray-400" />}
                {activeTab === "notifikasi" && <Bell className="w-5 h-5 text-gray-400" />}
                {activeTab === "preferensi" && <Monitor className="w-5 h-5 text-gray-400" />}
                {activeTab === "akses" && <Shield className="w-5 h-5 text-gray-400" />}
              </div>
              <h3 className="text-sm font-semibold text-gray-700">
                {settingsMenu.find(m => m.id === activeTab)?.label}
              </h3>
              <p className="text-xs text-gray-400 mt-1">Fitur ini akan segera tersedia.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-medium flex items-center gap-1.5 ${
        status === "ok" ? "text-green-600" : status === "error" ? "text-red-600" : "text-gray-400"
      }`}>
        <span className={`w-2 h-2 rounded-full ${
          status === "ok" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-gray-300 animate-pulse"
        }`} />
        {value}
      </span>
    </div>
  );
}
