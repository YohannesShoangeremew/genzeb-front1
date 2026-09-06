import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/store/auth";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Like useApi, but auto-refreshes on an interval WITHOUT the loading flicker:
 * the first load shows a spinner; every refresh after that swaps data in
 * silently and keeps the previous rows on screen. Exposes `updatedAt` (ms) so
 * the page can show a "live · updated Ns ago" indicator, and pauses polling
 * while the tab is hidden to avoid pointless traffic.
 *
 * A 401 logs the admin out, same as useApi.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  intervalMs = 8000,
) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const logout = useAuth((s) => s.logout);
  const firstRef = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps);

  const load = useCallback(
    (silent: boolean) => {
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      run()
        .then((data) => {
          setState({ data, loading: false, error: null });
          setUpdatedAt(Date.now());
        })
        .catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 401) {
            logout();
            return;
          }
          const msg = e instanceof Error ? e.message : "Something went wrong";
          // On a silent refresh keep the stale data; only surface the error on
          // the initial load so a transient blip doesn't blank the table.
          setState((s) => ({ data: s.data, loading: false, error: silent ? s.error : msg }));
        });
    },
    [run, logout],
  );

  useEffect(() => {
    firstRef.current = true;
    load(false);
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (!document.hidden) load(true);
      }, intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    const onVis = () => {
      if (document.hidden) stop();
      else {
        load(true);
        start();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, intervalMs]);

  return { ...state, updatedAt, reload: () => load(false) };
}
