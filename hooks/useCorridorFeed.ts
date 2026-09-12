import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { fetchCorridorSnapshot } from '@/lib/db-api';
import { useCockpitStore } from '@/lib/store';

/** How often the Hamburg Hbf board is re-read. */
export const FEED_INTERVAL_MS = 45_000;

const FEED_KEY = ['corridor-board'] as const;

/**
 * Polls the live Hamburg Hbf board and pushes every reading into the cockpit
 * store, where new delays turn into incidents.
 */
export function useCorridorFeed() {
  const applyFeed = useCockpitStore((state) => state.applyFeed);
  const setFeedState = useCockpitStore((state) => state.setFeedState);

  const query = useQuery({
    queryKey: FEED_KEY,
    queryFn: fetchCorridorSnapshot,
    refetchInterval: FEED_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: FEED_INTERVAL_MS / 2,
  });

  const { data, error, isFetching } = query;

  useEffect(() => {
    if (data) applyFeed(data);
  }, [data, applyFeed]);

  useEffect(() => {
    if (error) {
      setFeedState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Live feed unreachable',
      });
      return;
    }
    if (!data && isFetching) setFeedState({ status: 'loading' });
  }, [error, data, isFetching, setFeedState]);

  return query;
}

/** Force an immediate re-read of the board, for the controller's refresh action. */
export function useFeedRefresh() {
  const client = useQueryClient();
  return useCallback(() => {
    void client.refetchQueries({ queryKey: FEED_KEY });
  }, [client]);
}

/** True while a board read is in flight. */
export function useFeedFetching() {
  return useIsFetching({ queryKey: FEED_KEY }) > 0;
}
