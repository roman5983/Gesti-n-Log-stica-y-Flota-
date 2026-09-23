import { useCallback, useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '@/api/axios';

export interface PaginatedFetchResult<T> {
  items: T[];
  total: number;
}

export interface PageParams {
  page: number;
  limit: number;
}

/**
 * Generic paginated-list state used by every listing screen.
 * `fetchFn` should be memoized (useCallback) by the caller and include any
 * active filters via closure; changing its identity triggers a reload.
 */
export function usePaginatedList<T>(
  fetchFn: (params: PageParams) => Promise<PaginatedFetchResult<T>>,
  initialLimit = 10,
) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Each request gets a number; only the latest one may write the state. With
  // search-as-you-type, an older (slower) response could otherwise arrive
  // last and overwrite the list with results for a text no longer typed.
  const lastRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++lastRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn({ page, limit });
      if (request !== lastRequest.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      if (request !== lastRequest.current) return;
      setError(apiErrorMessage(err));
    } finally {
      if (request === lastRequest.current) setLoading(false);
    }
  }, [fetchFn, page, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, total, page, setPage, limit, setLimit, loading, error, reload: load };
}
