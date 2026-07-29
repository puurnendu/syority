'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { use_areas: false }));

/**
 * Client-side hook for hierarchy settings (use_areas toggle).
 * Fetches once and caches via SWR.
 */
export function useHierarchySettings() {
  const { data, error, isLoading } = useSWR<{ use_areas: boolean }>(
    '/api/hierarchy/settings',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  return {
    useAreas: data?.use_areas ?? false,
    isLoading,
    error,
  };
}
