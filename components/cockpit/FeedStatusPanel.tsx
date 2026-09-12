import { Button, Typography, useThemeColor } from 'heroui-native';
import { RefreshCw, Radio, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { useFeedFetching, useFeedRefresh, FEED_INTERVAL_MS } from '@/hooks/useCorridorFeed';
import { berlinSecondsSinceMidnight } from '@/lib/db-api';
import { useCockpitStore } from '@/lib/store';
import { formatClock } from '@/lib/utils';

import { Panel } from './Panel';

/**
 * Live feed state: which DB source answered, when it was last read, and a
 * manual re-read. This replaces the old disruption injector — incidents now
 * come from real delays on the board.
 */
export function FeedStatusPanel() {
  const feed = useCockpitStore((state) => state.feed);
  const trainCount = useCockpitStore((state) => state.trains.length);
  const nowSeconds = useCockpitStore((state) => state.nowSeconds);
  const refresh = useFeedRefresh();
  const isFetching = useFeedFetching();
  const [success, danger, muted] = useThemeColor(['success', 'danger', 'muted']);

  const isError = feed.status === 'error';
  const readAt =
    feed.fetchedAt === undefined
      ? undefined
      : formatClock(berlinSecondsSinceMidnight(new Date(feed.fetchedAt)));
  const ageSeconds =
    feed.fetchedAt === undefined
      ? undefined
      : Math.max(0, nowSeconds - berlinSecondsSinceMidnight(new Date(feed.fetchedAt)));

  return (
    <Panel
      title="Live feed"
      className={isError ? 'border-danger' : undefined}
      hint={
        isError
          ? 'No live board — the cockpit is holding the last state it had'
          : `Deutsche Bahn board at Hamburg Hbf · re-read every ${Math.round(FEED_INTERVAL_MS / 1000)} s`
      }
      right={
        <Button size="sm" variant="ghost" onPress={refresh} isDisabled={isFetching}>
          <RefreshCw size={14} color={muted} />
          <Button.Label>{isFetching ? 'Reading' : 'Refresh'}</Button.Label>
        </Button>
      }
    >
      <View className="gap-2">
        <View className="flex-row items-start gap-2">
          <View className="mt-0.5 shrink-0">
            {isError ? (
              <WifiOff size={14} color={danger} />
            ) : (
              <Radio size={14} color={feed.status === 'live' ? success : muted} />
            )}
          </View>
          <Typography
            type="body-sm"
            weight="semibold"
            className={`flex-1 ${
              isError ? 'text-danger' : feed.status === 'live' ? 'text-success' : ''
            }`}
          >
            {isError
              ? 'Feed unreachable'
              : feed.status === 'live'
                ? (feed.sourceLabel ?? 'Live')
                : 'Connecting to the live board'}
          </Typography>
        </View>

        {feed.status === 'live' && (
          <Typography type="body-xs" color="muted">
            Read {readAt}
            {ageSeconds !== undefined ? ` · ${ageSeconds} s ago` : ''} · {feed.boardSize ?? 0}{' '}
            arrivals on the board, {trainCount} eligible at Hamburg Hbf
          </Typography>
        )}

        {isError && (
          <Typography type="body-xs" className="text-danger">
            {feed.error ?? 'The DB boards did not answer.'}
          </Typography>
        )}

        <Typography type="body-xs" color="muted">
          Services, times, delay minutes, platforms and delay causes are live from DB. Passenger
          numbers and transfer sizes are estimated from service class and time of day — DB does not
          publish live loadings.
        </Typography>
      </View>
    </Panel>
  );
}
