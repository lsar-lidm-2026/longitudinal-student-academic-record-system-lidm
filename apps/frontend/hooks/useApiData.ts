/**
 * useApiData — Custom hook untuk fetching data API yang konsisten di semua halaman.
 * ================================================================================
 *
 * Cara Kerja:
 * 1. Hook ini menerima sebuah `fetcher` function (yang memanggil `api.get<T>`) dan `options`.
 * 2. Di mount, hook otomatis memanggil `refresh()` (kecuali `lazy: true`).
 * 3. `refresh()` akan:
 *    a. Set `loading = true`, `error = null`
 *    b. Eksekusi `api.handleResponse(fetcher())`
 *    c. Jika sukses → `setData(result)`, panggil `onSuccess` callback
 *    d. Jika gagal → `setError(err.message)`
 *    e. Finally → `setLoading(false)`
 * 4. MountedRef mencegah state update setelah komponen unmount (anti memory leak).
 * 5. FetcherRef menyimpan referensi fungsi fetcher tanpa trigger re-render.
 *
 * Alur Lengkap:
 *   Komponen memanggil useApiData(fetcher, { deps, lazy, onSuccess })
 *       │
 *       ├─ [mount] useEffect → jika !lazy → panggil refresh()
 *       │       │
 *       │       └─ refresh() → setLoading(true), setError(null)
 *       │               │
 *       │               ├─ api.handleResponse(fetcher())
 *       │               │       ├─ sukses → setData(result), onSuccess?.()
 *       │               │       └─ error → setError(err.message)
 *       │               └─ finally → setLoading(false)
 *       │
 *       └─ return { data, loading, error, refresh, setData }
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

const MODULE = "useApiData"; /** Nama module untuk logger — memudahkan tracing di console */

interface UseApiDataOptions {
  /** Dependencies yang memicu refetch (contoh: route params) */
  deps?: React.DependencyList;
  /** Jika true, skip fetch otomatis di mount — tunggu panggilan manual `refresh()` */
  lazy?: boolean;
  /** Callback ketika data berhasil di-load */
  onSuccess?: () => void;
}

interface UseApiDataResult<T> {
  /** Data hasil fetching, null sebelum sukses */
  data: T | null;
  /** Status loading — true saat fetch sedang berlangsung */
  loading: boolean;
  /** Pesan error jika fetch gagal, null jika tidak ada error */
  error: string | null;
  /** Method untuk memicu ulang fetching */
  refresh: () => void;
  /** Method untuk mengeset data secara manual (optimistic update) */
  setData: (data: T | null) => void;
}

/**
 * useApiData — generic hook untuk API fetching.
 *
 * @param fetcher - Function yang mengembalikan promise dari `api.get<T>()`
 * @param options - Konfigurasi: deps, lazy, onSuccess
 * @returns Object { data, loading, error, refresh, setData }
 */
export function useApiData<T>(
  fetcher: () => ReturnType<typeof api.get<T>>,
  options: UseApiDataOptions = {}
): UseApiDataResult<T> {
  // Destructure options dengan default values
  const { deps = [], lazy = false } = options;

  // State utama: data hasil fetch, status loading, dan pesan error
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!lazy);
  const [error, setError] = useState<string | null>(null);

  // Ref untuk mengecek apakah komponen masih ter-mount (cegah memory leak)
  const mountedRef = useRef(true);
  // Ref untuk menyimpan fetcher tanpa trigger re-render
  const fetcherRef = useRef(fetcher);

  // Inisialisasi mountedRef saat mount dan cleanup saat unmount
  useEffect(() => {
    mountedRef.current = true;
    logger.debug(MODULE, "Mounted", { lazy });
    return () => {
      mountedRef.current = false;
      logger.debug(MODULE, "Unmounted — cleanup dilakukan");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Memperbarui fetcherRef.current setiap kali fetcher berubah
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  /**
   * refresh — Function untuk memicu fetching ulang data dari API.
   * Menggunakan useCallback agar referensi stabil antar render.
   * Dependencies dari `deps` agar otomatis refetch saat parameter berubah.
   */
  const refresh = useCallback(() => {
    logger.debug(MODULE, "refresh() dipanggil", { lazy });
    setLoading(true);
    setError(null);

    api.handleResponse(fetcherRef.current())
      .then((result) => {
        // Hanya update state jika komponen masih ter-mount
        if (mountedRef.current) {
          logger.debug(MODULE, "Data berhasil di-fetch", { dataType: typeof result });
          setData(result);
          options.onSuccess?.();
        } else {
          logger.warn(MODULE, "Data diterima setelah unmount — diabaikan");
        }
      })
      .catch((err: Error & { code?: string }) => {
        if (mountedRef.current) {
          logger.error(MODULE, "Fetch gagal", { err, message: err.message, code: err.code });
          setError(err.message || "Terjadi kesalahan");
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false);
          logger.debug(MODULE, "Fetch selesai (loading = false)");
        }
      });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect mount: fetch data otomatis jika tidak lazy
  useEffect(() => {
    if (!lazy) {
      logger.debug(MODULE, "Auto-fetch di mount (lazy=false)");
      refresh();
    } else {
      logger.debug(MODULE, "Lazy mode — skip auto-fetch");
    }
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Return value yang siap dipakai komponen konsumen:
   * - data, loading, error: state utama
   * - refresh: trigger manual refetch
   * - setData: setter langsung untuk optimistic update
   */
  return { data, loading, error, refresh, setData };
}
