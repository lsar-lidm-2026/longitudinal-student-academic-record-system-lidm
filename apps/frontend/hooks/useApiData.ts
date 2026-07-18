/**
 * Shared hook for consistent API data fetching across all pages.
 * Handles loading, error, and empty states uniformly.
 * Eliminates the "silent API error" anti-pattern.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

interface UseApiDataOptions {
  /** Dependencies that trigger a refetch (like route params) */
  deps?: React.DependencyList;
  /** Don't fetch on mount — wait for manual refresh() call */
  lazy?: boolean;
  /** Called when data is successfully loaded */
  onSuccess?: () => void;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setData: (data: T | null) => void;
}

export function useApiData<T>(
  fetcher: () => ReturnType<typeof api.get<T>>,
  options: UseApiDataOptions = {}
): UseApiDataResult<T> {
  const { deps = [], lazy = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!lazy);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);

  // Keep fetcher ref current without triggering re-renders
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    api.handleResponse(fetcherRef.current())
      .then((result) => {
        if (mountedRef.current) {
          setData(result);
          options.onSuccess?.();
        }
      })
      .catch((err: Error & { code?: string }) => {
        if (mountedRef.current) {
          setError(err.message || "Terjadi kesalahan");
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false);
        }
      });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lazy) {
      refresh();
    }
  }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refresh, setData };
}
