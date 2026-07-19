/**
 * sonner — Toaster component wrapper untuk library sonner (notifikasi toast).
 * ============================================================================
 *
 * Cara Kerja:
 * 1. Komponen ini membungkus <Toaster> dari library `sonner` dengan styling Tailwind.
 * 2. Menggunakan `useTheme` dari `next-themes` untuk mendeteksi tema (light/dark/system).
 * 3. Theme disinkronkan ke prop `theme` pada komponen Sonner.
 * 4. Icon untuk setiap tipe toast (success, info, warning, error, loading) diganti dengan
 *    ikon dari Lucide React untuk konsistensi visual dengan design system.
 * 5. CSS variables untuk styling di-passing via prop `style`.
 * 6. Props tambahan di-forward ke komponen Sonner asli via spread operator.
 *
 * Alur Lengkap:
 *   import { Toaster } from "@/components/ui/sonner"
 *   import { toast } from "sonner"
 *
 *   // Di layout/page:
 *   <Toaster position="top-right" richColors />
 *
 *   // Di komponen manapun:
 *   toast.success("Data tersimpan")
 *   toast.error("Gagal menyimpan")
 *   toast.info("Info")
 *   toast.warning("Peringatan")
 *   toast.loading("Memproses...")
 */

"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { logger } from "@/lib/logger"

const MODULE = "sonner/Toaster"; /** Nama module untuk logger */

/**
 * Toaster — Komponen wrapper untuk sonner Toaster dengan kustomisasi tema dan icon.
 * Menerima semua props dari ToasterProps sonner asli.
 *
 * @param props - Props tambahan yang di-forward ke Sonner (position, richColors, dll)
 * @returns ReactNode — Konfigurasi Toaster siap pakai
 */
const Toaster = ({ ...props }: ToasterProps) => {
  // Baca tema aktif dari next-themes (default: "system")
  const { theme = "system" } = useTheme()

  logger.debug(MODULE, "Toaster dirender", { theme });

  return (
    <Sonner
      // Sinkronisasi tema
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Icon kustom untuk setiap tipe toast
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      // Styling via CSS variables untuk integrasi dengan design system
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      // Opsi styling tambahan untuk toast
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      // Forward props tambahan (position, richColors, dll)
      {...props}
    />
  )
}

export { Toaster }
