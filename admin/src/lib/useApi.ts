import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/store/auth";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// useApi runs an async fetcher on mount (and when `deps` change) and exposes
// loading/error/data plus a reload(). A 401 logs the admin out automatically.
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const logout = useAuth((s) => s.logout);

  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          logout();
          return;
        }
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setState({ data: null, loading: false, error: msg });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  return { ...state, reload: run };
}
