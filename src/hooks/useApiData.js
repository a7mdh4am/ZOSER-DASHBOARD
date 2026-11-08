import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads data for a component: on mount, whenever `deps` change, and on
 * `reload()`. Call it like useEffect —
 *   useApiData(() => ordersApi.list({ status, page }), [status, page])
 * — and ESLint checks the deps the same way (additionalHooks in eslint.config.js).
 *
 * - An answer that arrives after a newer request started is dropped, so a
 *   quick filter or page change can't show the previous request's data.
 * - While reloading, the last data stays on screen; `loading` is true.
 * - `error` is the last failure's message; it's cleared when a request starts.
 * - The loader may return a plain value instead of a promise (e.g. from a
 *   cache); it's applied straight away, without a loading state.
 * - `reload()` returns a promise, so an action can wait for fresh data.
 */
export function useApiData(load, deps) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const latest = useRef(0);

  // reload() always runs the loader from the latest render.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(() => {
    const request = ++latest.current;
    const result = loadRef.current();

    if (typeof result?.then !== "function") {
      setState({ data: result, error: "", loading: false });
      return Promise.resolve();
    }

    setState((s) =>
      s.loading && !s.error ? s : { ...s, loading: true, error: "" },
    );
    return result.then(
      (data) => {
        if (request === latest.current)
          setState({ data, error: "", loading: false });
      },
      (err) => {
        if (request === latest.current)
          setState((s) => ({ ...s, error: err.message, loading: false }));
      },
    );
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller's deps, checked at the call site
  }, deps);

  return { ...state, reload };
}
