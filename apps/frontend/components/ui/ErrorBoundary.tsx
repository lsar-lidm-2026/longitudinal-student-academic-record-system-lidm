/**
 * ErrorBoundary — React Error Boundary component untuk menangkap error rendering.
 * ===============================================================================
 *
 * Cara Kerja:
 * 1. Class component yang mengimplementasi `getDerivedStateFromError` dan `componentDidCatch`.
 * 2. Ketika komponen child melempar error saat render:
 *    a. `getDerivedStateFromError` dipanggil → update state `hasError = true, error = error`
 *    b. `componentDidCatch` dipanggil → logging error ke console via logger
 *    c. Render fallback UI (custom atau default) dengan tombol "Coba Lagi"
 * 3. Tombol "Coba Lagi" memanggil `handleRetry` → reset state → render children kembali.
 * 4. Jika tidak ada error, render children normal.
 *
 * Alur Lengkap:
 *   <ErrorBoundary fallback={optional}>
 *       <ChildComponent />
 *   </ErrorBoundary>
 *       │
 *       ├─ Render normal → children dirender
 *       │
 *       ├─ [Child error] → getDerivedStateFromError(error)
 *       │       ├─ hasError = true, error = error
 *       │       ├─ componentDidCatch → logger.error
 *       │       └─ Render fallback UI
 *       │               ├─ [custom fallback] → props.fallback
 *       │               └─ [default] → Card error + tombol Coba Lagi
 *       │               └─ onClick handleRetry → resetState
 *       │
 *       └─ [Retry] → handleRetry() → hasError = false → render children
 */

"use client";

import { Component, type ReactNode } from "react";
import { logger } from "@/lib/logger";

const MODULE = "ErrorBoundary"; /** Nama module untuk logger */

/** Interface untuk props ErrorBoundary */
interface Props {
  children: ReactNode;         /** Komponen child yang dibungkus */
  fallback?: ReactNode;        /** Custom fallback UI (opsional) */
}

/** Interface untuk state ErrorBoundary */
interface State {
  hasError: boolean;           /** Apakah ada error yang terdeteksi */
  error: Error | null;         /** Object error yang ditangkap */
}

/**
 * ErrorBoundary — Class component untuk menangkap JavaScript error di component tree.
 * Mencegah seluruh halaman crash dengan menampilkan fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  /**
   * Constructor — inisialisasi state default.
   * @param props - Props dari parent component
   */
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    logger.debug(MODULE, "ErrorBoundary mounted");
  }

  /**
   * getDerivedStateFromError — Lifecycle method static.
   * Dipanggil saat child component melempar error saat render.
   * Update state agar fallback UI tampil.
   *
   * @param error - Error yang dilempar oleh child component
   * @returns State object baru { hasError: true, error }
   */
  static getDerivedStateFromError(error: Error): State {
    logger.error(MODULE, "Error caught oleh ErrorBoundary", { error: { message: error.message, name: error.name } });
    return { hasError: true, error };
  }

  /**
   * componentDidCatch — Lifecycle method untuk efek samping saat error.
   * Bisa digunakan untuk logging ke service eksternal.
   *
   * @param error - Error yang ditangkap
   * @param errorInfo - Informasi stack trace component tree
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(MODULE, "Detail error boundary", {
      error: { message: error.message, name: error.name, stack: error.stack },
      componentStack: errorInfo.componentStack,
    });
  }

  /**
   * handleRetry — Reset state error agar component tree di-render ulang.
   * Dipanggil saat user menekan tombol "Coba Lagi".
   */
  handleRetry = () => {
    logger.info(MODULE, "Retry — mereset error state");
    this.setState({ hasError: false, error: null });
  };

  /**
   * render — Menentukan UI yang ditampilkan.
   * Jika error → tampilkan fallback (custom atau default).
   * Jika tidak error → render children.
   *
   * @returns ReactNode (fallback UI atau children)
   */
  render() {
    if (this.state.hasError) {
      // Error state: render fallback UI
      return (
        this.props.fallback || (
          // Default fallback UI: card dengan icon warning, pesan error, dan tombol retry
          <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
            {/* Icon warning di lingkaran merah */}
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            {/* Judul error */}
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Terjadi Kesalahan</h3>
            {/* Pesan error detail */}
            <p className="text-xs text-gray-500 mb-4 max-w-md">
              {this.state.error?.message || "Terjadi kesalahan yang tidak terduga"}
            </p>
            {/* Tombol retry */}
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        )
      );
    }

    // Normal state: render children tanpa perubahan
    return this.props.children;
  }
}
