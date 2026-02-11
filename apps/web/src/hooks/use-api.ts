"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Generic hook for fetching data from Brain API with graceful fallback.
 * If the API is unreachable, returns the fallback data instead of crashing.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  fallback: T
): {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => setData(result))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "API unavailable");
        setData(fallback);
      })
      .finally(() => setLoading(false));
  }, [fetcher, fallback]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

/**
 * Polling variant — refetches at a fixed interval.
 */
export function useApiPolling<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  intervalMs: number = 10000
): {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const result = useApi(fetcher, fallback);

  useEffect(() => {
    const id = setInterval(() => result.refetch(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, result.refetch]);

  return result;
}
