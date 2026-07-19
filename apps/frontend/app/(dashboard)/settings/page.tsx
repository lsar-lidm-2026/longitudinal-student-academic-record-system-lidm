"use client";

/**
 * Cara kerja file (How this file works):
 * =======================================
 * Halaman Pengaturan Sistem (Settings) dengan menu navigasi tab di sebelah
 * kiri. Saat ini hanya tab "Profil" yang berfungsi penuh; tab lain
 * (Keamanan, Notifikasi, Preferensi, Akses) masih placeholder "coming soon".
 *
 * Alur lengkap:
 * 1. useEffect memanggil checkHealth() dan loadProfile() saat mount.
 * 2. loadProfile() mengambil data user dari /auth/me → mengisi nama user.
 * 3. checkHealth() mengambil status sistem dari /health:
 *    - API status (online/offline)
 *    - Database status (Terhubung/Error)
 *    - ML Model status (Model siap/Belum dilatih)
 * 4. Tab kiri menampilkan 5 menu settings + Bantuan + Keluar Akun.
 *    Saat tab diklik, konten kanan berubah sesuai activeTab.
 * 5. Tab "Profil" menampilkan:
 *    - Foto profile (upload placeholder)
 *    - Form: nama, NIP, email, no WA, alamat
 *    - Tombol Simpan — PUT /users/:id dengan field name.
 * 6. Tab lainnya menampilkan placeholder "Fitur ini akan segera tersedia."
 */

import { useEffect, useState, useRef } from "react";
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
  Sun,
  Moon,
  Check,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { api, API_BASE_URL } from "@/lib/api";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

/** Tipe tab yang tersedia di halaman settings */
type SettingsTab = "profil" | "keamanan" | "notifikasi" | "preferensi" | "akses";

/** Konfigurasi menu sidebar settings */
const settingsMenu = [
  { id: "profil" as SettingsTab, label: "Profil Pengguna", description: "Informasi pribadi dan biodata", icon: User },
  { id: "keamanan" as SettingsTab, label: "Keamanan & Sandi", description: "Ubah kata sandi dan autentikasi", icon: Lock },
  { id: "notifikasi" as SettingsTab, label: "Notifikasi", description: "Atur pemberitahuan sistem", icon: Bell },
  { id: "preferensi" as SettingsTab, label: "Preferensi Sistem", description: "Tampilan dan bahasa aplikasi", icon: Monitor },
  { id: "akses" as SettingsTab, label: "Hak Akses Peran", description: "Manajemen izin dan otorisasi", icon: Shield },
];

export default function SettingsPage() {
  /** Tab aktif yang sedang ditampilkan */
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profil");
  /** Status koneksi API (checking/ok/error) */
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");
  /** Status database (dari /health) */
  const [dbStatus, setDbStatus] = useState("");
  /** Status ML model (dari /health) */
  const [mlStatus, setMlStatus] = useState("");

  // ── Profile form state ─────────────────────────────────────────────
  const [profileName, setProfileName] = useState("");
  const [profileNip, setProfileNip] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");

  /** Indikator sedang menyimpan profil */
  const [savingProfile, setSavingProfile] = useState(false);
  /** ID user yang sedang login (dari /auth/me) */
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  /** Role user yang sedang login (dari /auth/me) */
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  // ── Password form state ────────────────────────────────────────────
  /** Password saat ini — input user */
  const [currentPassword, setCurrentPassword] = useState("");
  /** Password baru — input user */
  const [newPassword, setNewPassword] = useState("");
  /** Konfirmasi password baru — input user */
  const [confirmPassword, setConfirmPassword] = useState("");
  /** Indikator sedang mengirim request ubah password */
  const [changingPassword, setChangingPassword] = useState(false);
  /** Pesan error validasi form (inline) */
  const [passwordError, setPasswordError] = useState("");

  /** Toggle show/hide untuk masing-masing field password */
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  // ── Notification toggle state ──────────────────────────────────────
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifApp, setNotifApp] = useState(true);
  const [notifAiSummary, setNotifAiSummary] = useState(true);
  const [notifInputReminder, setNotifInputReminder] = useState(true);

  /** Toggle theme (Terang/Gelap) — default Terang */
  const [darkMode, setDarkMode] = useState(false);
  /** Ref ke hidden file input untuk upload foto profil */
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Loading state saat upload foto */
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  /** Load notifikasi & preferensi dari localStorage saat mount */
  useEffect(() => {
    if (typeof window !== "undefined") {
      setNotifEmail(localStorage.getItem("notif_email") !== "false");
      setNotifApp(localStorage.getItem("notif_app") !== "false");
      setNotifAiSummary(localStorage.getItem("notif_ai_summary") !== "false");
      setNotifInputReminder(localStorage.getItem("notif_input_reminder") !== "false");
      const saved = localStorage.getItem("dark_mode");
      if (saved === "true") {
        setDarkMode(true);
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  /** Persist toggle notifikasi ke localStorage */
  function toggleNotif(key: string, value: boolean, setter: (v: boolean) => void) {
    setter(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(key, String(value));
    }
  }

  /** Toggle tema gelap/terang — juga menerapkan .dark class pada <html> */
  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("dark_mode", String(next));
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }

  /** Inisialisasi: cek kesehatan sistem + muat data profil */
  useEffect(() => {
    checkHealth();
    loadProfile();
  }, []);

  /**
   * loadProfile — Mengambil data user yang login dari /auth/me.
   * Mengisi form nama dan menyimpan ID user.
   */
  async function loadProfile() {
    logger.info("SettingsPage", "Memuat profil user");
    try {
      const res = await api.get<{ id: string; username: string; name: string; role: string; isActive: boolean }>("/auth/me");
      if (res.success && res.data) {
        setProfileName(res.data.name || "");
        setCurrentUserId(res.data.id);
        setCurrentUserRole(res.data.role);
        logger.info("SettingsPage", "Profil user berhasil dimuat", { userId: res.data.id, name: res.data.name, role: res.data.role });
      }
    } catch (err) {
      logger.error("SettingsPage", "Gagal memuat profil user", { err });
    }
  }

  /**
   * checkHealth — Mengecek status kesehatan sistem dari endpoint /health.
   * Memperbarui status API, database, dan ML model.
   */
  async function checkHealth() {
    setApiStatus("checking");
    logger.info("SettingsPage", "Memeriksa kesehatan sistem");
    try {
      const res = await api.get<any>("/health");
      if (res.success && res.data) {
        const data = res.data as any;
        setApiStatus("ok");
        // Backend response: { status, database: { ok, latency }, analytics: { trained, hasClusterModel } }
        setDbStatus(data.database?.ok ? "Terhubung" : "Error");
        setMlStatus(data.analytics?.trained ? "Model siap" : "Belum dilatih");
        logger.info("SettingsPage", "Sistem sehat", { db: data.database?.ok, ml: data.analytics?.trained });
      } else {
        setApiStatus("error");
        logger.error("SettingsPage", "Health check gagal (response)", {});
      }
    } catch (err) {
      setApiStatus("error");
      setDbStatus("Tidak terdeteksi");
      setMlStatus("Tidak terdeteksi");
      logger.error("SettingsPage", "Health check error", { err });
    }
  }

  /**
   * handleSaveProfile — Menyimpan perubahan profil ke backend.
   * Mengirim name via PUT /users/:id.
   */
  async function handleSaveProfile() {
    if (!currentUserId) {
      toast.error("Gagal mendapatkan ID pengguna");
      logger.error("SettingsPage", "Tidak ada currentUserId saat save profil");
      return;
    }
    setSavingProfile(true);
    logger.info("SettingsPage", "Menyimpan profil", { userId: currentUserId });
    try {
      // Backend PUT /users/:id menerima { name, role, isActive }
      await api.handleResponse(
        api.put(`/users/${currentUserId}`, { name: profileName })
      );
      toast.success("Profil berhasil diperbarui");
      logger.info("SettingsPage", "Profil berhasil disimpan");
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui profil");
      logger.error("SettingsPage", "Gagal menyimpan profil", { err });
    } finally {
      setSavingProfile(false);
    }
  }

  /**
   * handleChangePassword — Mengubah password user via PUT /users/:id.
   *
   * Alur:
   * 1. Validasi client-side: password baru ≥6 karakter, konfirmasi cocok.
   * 2. Kirim PUT /users/:id dengan body { password: newPassword }.
   * 3. Jika sukses → tampilkan toast, reset form, log event.
   * 4. Jika gagal → tampilkan toast error.
   *
   * Catatan: currentPassword dikumpulkan di UI untuk UX (kesan verifikasi),
   * tetapi TIDAK dikirim ke backend karena endpoint PUT /users/:id
   * (auth.service.updateUser) hanya menerima field `password` tanpa verifikasi
   * password lama. Backend belum memiliki endpoint PATCH /users/:id/password
   * yang menerima { currentPassword, newPassword }.
   * Jika keamanan perlu ditingkatkan di masa depan, buat endpoint baru
   * di auth controller yang memverifikasi currentPassword sebelum update.
   */
  async function handleChangePassword(e: React.FormEvent) {
    // Mencegah reload halaman saat submit form
    e.preventDefault();
    logger.info("SettingsPage", "Mengubah password");

    // ── Client-side validation ─────────────────────────────────────────
    // Reset error state sebelum validasi ulang
    setPasswordError("");

    // Validasi 1: Password baru minimal 6 karakter
    if (newPassword.length < 6) {
      const msg = "Password baru minimal 6 karakter";
      setPasswordError(msg);
      logger.warn("SettingsPage", "Validasi gagal — password baru terlalu pendek", { length: newPassword.length });
      return;
    }

    // Validasi 2: Konfirmasi password harus cocok dengan password baru
    if (newPassword !== confirmPassword) {
      const msg = "Konfirmasi password tidak cocok";
      setPasswordError(msg);
      logger.warn("SettingsPage", "Validasi gagal — konfirmasi password tidak cocok");
      return;
    }

    // Pastikan currentUserId tersedia sebelum request
    if (!currentUserId) {
      toast.error("Gagal mendapatkan ID pengguna");
      logger.error("SettingsPage", "Tidak ada currentUserId saat ubah password");
      return;
    }

    setChangingPassword(true);
    try {
      // Kirim password baru ke backend — auth.service.updateUser() menerima field password
      logger.info("SettingsPage", "Mengirim request ubah password", { userId: currentUserId });
      await api.handleResponse(
        api.put(`/users/${currentUserId}`, { password: newPassword })
      );

      // Sukses — tampilkan toast, reset form, log event
      toast.success("Password berhasil diperbarui");
      logger.info("SettingsPage", "Password berhasil diubah", { userId: currentUserId });

      // Reset semua field form password
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
    } catch (err: any) {
      // Error dari backend — tampilkan pesan error dari server
      toast.error(err.message || "Gagal memperbarui password");
      logger.error("SettingsPage", "Gagal mengubah password", { err, userId: currentUserId });
    } finally {
      setChangingPassword(false);
    }
  }

  function handleLogout() {
    api.setToken(null);
    router.replace("/login");
  }

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <div className="text-sm text-gray-400 flex items-center gap-1.5">
        <span>Dashboard</span>
        <span>›</span>
        <span className="text-gray-700 font-medium">Pengaturan</span>
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pengaturan Sistem</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Kelola informasi akun, preferensi notifikasi, dan konfigurasi platform LSAR.
        </p>
      </div>

      {/* ── Content: 2-column layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ====== Left: Menu ====== */}
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
                {/* Ikon menu — berubah warna saat aktif */}
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

          {/* ── Bantuan Section ────────────────────────────────────────── */}
          <div className="pt-4 mt-4 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Akun
            </p>
            {/* Tombol Pusat Bantuan (placeholder) */}
            <button className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-gray-50 transition-all">
              <HelpCircle className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Pusat Bantuan</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-500 font-medium">Keluar Akun</span>
            </button>
          </div>
        </div>

        {/* ====== Right: Content ====== */}
        <div className="lg:col-span-2">
          {/* ── Tab: Profil ──────────────────────────────────────────────── */}
          {activeTab === "profil" && (
            <div className="space-y-6">
              {/* Form Informasi Profil */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-900">Informasi Profil</h2>
                <p className="text-sm text-gray-400 mt-0.5">Perbarui detail pribadi Anda yang akan ditampilkan di platform.</p>

                {/* ── Photo Upload ────────────────────────────────────── */}
                <div className="mt-5 p-4 bg-gray-50 rounded-xl flex items-center gap-4">
                  {/* Avatar placeholder */}
                  <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingPhoto(true);
                        try {
                          const formData = new FormData();
                          formData.append("photo", file);
                          const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
                           const API_URL = API_BASE_URL;
                          const res = await fetch(`${API_URL}/upload/profile/photo`, {
                            method: "POST",
                            headers: token ? { Authorization: `Bearer ${token}` } : {},
                            body: formData,
                          });
                          const data = await res.json();
                          if (!res.ok || !data.success) {
                            throw new Error(data.error?.message || "Gagal upload foto");
                          }
                          toast.success("Foto profil berhasil diperbarui");
                          logger.info("SettingsPage", "Profile photo updated");
                        } catch (err: any) {
                          toast.error(err.message || "Gagal mengupload foto");
                        } finally {
                          setUploadingPhoto(false);
                        }
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Camera className="w-3 h-3" />
                      {uploadingPhoto ? "Mengupload..." : "Ganti Foto"}
                    </button>
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-white transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 ml-2">Format JPG atau PNG. Maksimum 2MB.</span>
                </div>

                {/* ── Form Fields ─────────────────────────────────────── */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nama Lengkap — field ini yang benar-benar disimpan ke backend */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  {/* NIP / NUPTK (belum di-save ke backend) */}
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
                  {/* Email Institusi (belum di-save ke backend) */}
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
                  {/* No. WhatsApp (belum di-save ke backend) */}
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
                  {/* Alamat Domisili (belum di-save ke backend) */}
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

                {/* ── Form Actions ────────────────────────────────────── */}
                <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savingProfile ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </div>

              {/* ── System Info ────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Status Sistem</h3>
                <div className="space-y-2">
                  {/* Status API */}
                  <StatusRow label="API Status" value={apiStatus === "ok" ? "Online" : apiStatus === "error" ? "Offline" : "Memeriksa..."} status={apiStatus} />
                  {/* Status Database */}
                  <StatusRow label="Database" value={dbStatus || "Memeriksa..."} status={dbStatus === "Terhubung" ? "ok" : "error"} />
                  {/* Status ML Model */}
                  <StatusRow label="ML Model" value={mlStatus || "Memeriksa..."} status={mlStatus === "Model siap" ? "ok" : "checking"} />
                </div>
                {/* Tombol refresh status */}
                <button
                  onClick={checkHealth}
                  className="mt-3 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                >
                  Periksa Ulang
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Keamanan & Sandi ──────────────────────────────────── */}
          {activeTab === "keamanan" && (
            <div className="space-y-6">
              {/* Form Ubah Password */}
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-900">Keamanan & Sandi</h2>
                <p className="text-sm text-gray-400 mt-0.5">Ubah kata sandi akun Anda.</p>

                <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                  {/* Current Password */}
                  <div>
                    <label htmlFor="currentPassword" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Password Saat Ini
                    </label>
                    <div className="relative">
                      <input
                        id="currentPassword"
                        type={showPw.current ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(""); }}
                        required
                        placeholder="Masukkan password saat ini"
                        className="w-full h-10 pl-3 pr-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw({...showPw, current: !showPw.current})}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPw.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label htmlFor="newPassword" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Password Baru
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showPw.new ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPasswordError(""); }}
                        required
                        minLength={6}
                        placeholder="Minimal 6 karakter"
                        className="w-full h-10 pl-3 pr-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw({...showPw, new: !showPw.new})}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPw.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Konfirmasi Password Baru
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showPw.confirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                        required
                        placeholder="Ketik ulang password baru"
                        className="w-full h-10 pl-3 pr-10 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw({...showPw, confirm: !showPw.confirm})}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPw.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Inline validation error — muncul jika validasi client-side gagal */}
                  {passwordError && (
                    <p className="text-sm text-red-500">{passwordError}</p>
                  )}

                  {/* Form Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordError(""); }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Batalkan
                    </button>
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {changingPassword ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {changingPassword ? "Menyimpan..." : "Perbarui Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Tab: Notifikasi ──────────────────────────────────────────── */}
          {activeTab === "notifikasi" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-900">Notifikasi</h2>
                <p className="text-sm text-gray-400 mt-0.5">Atur pemberitahuan yang ingin Anda terima.</p>
                <div className="mt-5 space-y-1">
                  <ToggleRow
                    label="Pemberitahuan Email"
                    description="Terima notifikasi melalui email institusi"
                    enabled={notifEmail}
                    onChange={(v) => toggleNotif("notif_email", v, setNotifEmail)}
                  />
                  <ToggleRow
                    label="Pemberitahuan Aplikasi"
                    description="Terima notifikasi di dalam aplikasi"
                    enabled={notifApp}
                    onChange={(v) => toggleNotif("notif_app", v, setNotifApp)}
                  />
                  <ToggleRow
                    label="Ringkasan AI Baru"
                    description="Dapatkan pemberitahuan saat ringkasan AI selesai dibuat"
                    enabled={notifAiSummary}
                    onChange={(v) => toggleNotif("notif_ai_summary", v, setNotifAiSummary)}
                  />
                  <ToggleRow
                    label="Pengingat Input Nilai"
                    description="Ingatan untuk mengisi atau melengkapi nilai semester"
                    enabled={notifInputReminder}
                    onChange={(v) => toggleNotif("notif_input_reminder", v, setNotifInputReminder)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Preferensi Sistem ────────────────────────────────────── */}
          {activeTab === "preferensi" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-900">Preferensi Sistem</h2>
                <p className="text-sm text-gray-400 mt-0.5">Sesuaikan tampilan dan bahasa aplikasi.</p>
                <div className="mt-5 space-y-4">
                  <PreferenceRow label="Bahasa" value="Bahasa Indonesia" />
                  <PreferenceRow label="Format Tanggal" value="DD/MM/YYYY" />
                  <PreferenceRow label="Zona Waktu" value="Asia/Jakarta (WIB)" />
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Tampilan</p>
                      <p className="text-xs text-gray-400 mt-0.5">Beralih antara tema terang dan gelap</p>
                    </div>
                    <button
                      onClick={toggleDarkMode}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        darkMode ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform ${
                          darkMode ? "translate-x-6" : "translate-x-1"
                        }`}
                      >
                        {darkMode ? (
                          <Moon className="w-2.5 h-2.5 text-blue-600" />
                        ) : (
                          <Sun className="w-2.5 h-2.5 text-amber-500" />
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Hak Akses Peran ─────────────────────────────────────── */}
          {activeTab === "akses" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-900">Hak Akses Peran</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Matriks izin akses setiap peran pengguna. Peran Anda saat ini: <span className="font-semibold text-gray-700">{currentUserRole || "—"}</span>
                </p>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2.5 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Modul</th>
                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Operator</th>
                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Guru</th>
                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kepsek</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <PermissionRow module="Manajemen Pengguna" admin operator={false} guru={false} kepsek={false} />
                      <PermissionRow module="Tahun Ajaran" admin operator={false} guru={false} kepsek={false} />
                      <PermissionRow module="Kelas & Assignment" admin operator guru kepsek />
                      <PermissionRow module="Data Siswa" admin={false} operator guru kepsek />
                      <PermissionRow module="Nilai & Semester" admin={false} operator={false} guru kepsek />
                      <PermissionRow module="Profil Longitudinal" admin={false} operator={false} guru kepsek />
                      <PermissionRow module="Buku Induk" admin={false} operator={false} guru kepsek />
                      <PermissionRow module="Fitur AI" admin={false} operator={false} guru kepsek />
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * StatusRow — Baris status sistem dengan bullet point warna.
 * @param label - Nama komponen (e.g. "API Status")
 * @param value - Nilai status (e.g. "Online")
 * @param status - Kategori status: "ok" (hijau), "error" (merah), lainnya (abu-abu)
 */
function StatusRow({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-medium flex items-center gap-1.5 ${
        status === "ok" ? "text-green-600" : status === "error" ? "text-red-600" : "text-gray-400"
      }`}>
        {/* Bullet point — hijau/merah/abu-abu dengan animasi pulse untuk checking */}
        <span className={`w-2 h-2 rounded-full ${
          status === "ok" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-gray-300 animate-pulse"
        }`} />
        {value}
      </span>
    </div>
  );
}

/**
 * ToggleRow — Baris toggle switch dengan label dan deskripsi.
 */
function ToggleRow({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          enabled ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-flex h-4 w-4 items-center justify-center rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        >
          {enabled ? (
            <Check className="w-2.5 h-2.5 text-blue-600" />
          ) : (
            <X className="w-2.5 h-2.5 text-gray-400" />
          )}
        </span>
      </button>
    </div>
  );
}

/**
 * PreferenceRow — Baris informasi preferensi readonly.
 */
function PreferenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span className="text-sm text-gray-500">{value}</span>
    </div>
  );
}

/**
 * PermissionRow — Baris matriks hak akses per modul.
 */
function PermissionRow({
  module,
  admin,
  operator,
  guru,
  kepsek,
}: {
  module: string;
  admin?: boolean;
  operator?: boolean;
  guru?: boolean;
  kepsek?: boolean;
}) {
  const Cell = ({ hasAccess }: { hasAccess?: boolean }) => (
    <td className="text-center py-3 px-3">
      {hasAccess ? (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
          <Check className="w-3.5 h-3.5 text-green-600" />
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
          <X className="w-3 h-3 text-gray-300" />
        </span>
      )}
    </td>
  );

  return (
    <tr>
      <td className="py-3 pr-4 text-sm font-medium text-gray-700">{module}</td>
      <Cell hasAccess={admin} />
      <Cell hasAccess={operator} />
      <Cell hasAccess={guru} />
      <Cell hasAccess={kepsek} />
    </tr>
  );
}
