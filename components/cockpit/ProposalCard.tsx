import { Chip, PressableFeedback, Typography, useThemeColor } from 'heroui-native';
import { Check, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import type { ImpactMetrics, Proposal, ProposalAuthor } from '@/lib/types';
import { cn } from '@/lib/utils';

import { ImpactMetricsRow } from './ImpactMetricsRow';
import { OptionBadge } from './badges';

const AUTHOR_LABEL: Record<ProposalAuthor, string> = {
  network: 'Agent A · Network flow',
  passenger: 'Agent B · Passenger impact',
  arbiter: 'Orchestrator · Blended plan',
};

const AUTHOR_COMPACT_LABEL: Record<ProposalAuthor, string> = {
  network: 'Network',
  passenger: 'Passenger',
  arbiter: 'Orchestrator',
};

const AUTHOR_GOAL: Record<ProposalAuthor, string> = {
  network: 'Minimise total delay minutes',
  passenger: 'Minimise broken journeys',
  arbiter: 'Best of both, weighed up',
};

interface ProposalCardProps {
  proposal: Proposal;
  baseline: ImpactMetrics;
  isRecommended: boolean;
  isSelected: boolean;
  compact?: boolean;
  onSelect: (id: string) => void;
}

export function ProposalCard({
  proposal,
  baseline,
  isRecommended,
  isSelected,
  compact = false,
  onSelect,
}: ProposalCardProps) {
  const [success, warning] = useThemeColor(['success', 'warning']);

  return (
    <PressableFeedback
      onPress={() => onSelect(proposal.id)}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      className={cn(
        'bg-panel rounded-2xl border',
        compact ? 'gap-2 p-2.5' : 'gap-3 p-3',
        isSelected ? 'border-accent bg-panel-raised' : 'border-border',
      )}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <OptionBadge id={proposal.id} author={proposal.author} />
        <View className={cn('flex-1', compact ? 'min-w-16' : 'min-w-40')}>
          <Typography type="body-sm" weight="semibold">
            {compact ? AUTHOR_COMPACT_LABEL[proposal.author] : AUTHOR_LABEL[proposal.author]}
          </Typography>
          {!compact && (
            <Typography type="body-xs" color="muted">
              {AUTHOR_GOAL[proposal.author]}
            </Typography>
          )}
        </View>
        {isRecommended && (
          <Chip size="sm" variant="secondary" color="success">
            <Chip.Label>{compact ? 'AI pick' : 'Recommended'}</Chip.Label>
          </Chip>
        )}
        <View
          className={cn(
            'size-5 items-center justify-center rounded-full border',
            isSelected ? 'border-accent bg-accent' : 'border-border',
          )}
        >
          {isSelected && <View className="bg-background size-2 rounded-full" />}
        </View>
      </View>

      <Typography type="body" weight="semibold">
        {proposal.title}
      </Typography>

      <ImpactMetricsRow metrics={proposal.metrics} baseline={baseline} compact={compact} />

      <View className="gap-1.5">
        <View className="flex-row gap-2">
          <Check size={14} color={success} style={{ marginTop: 3 }} />
          <Typography type={compact ? 'body-xs' : 'body-sm'} className="flex-1">
            {proposal.reason}
          </Typography>
        </View>
        <View className="flex-row gap-2">
          <TriangleAlert size={14} color={warning} style={{ marginTop: 3 }} />
          <Typography type={compact ? 'body-xs' : 'body-sm'} color="muted" className="flex-1">
            {proposal.tradeoff}
          </Typography>
        </View>
      </View>

      <View
        className={cn('bg-panel-raised gap-1 rounded-xl', compact ? 'px-2 py-1.5' : 'px-3 py-2')}
      >
        <Typography type="body-xs" className="text-muted tracking-[2px]">
          {compact ? 'STEPS' : 'DISPATCHER STEPS'}
        </Typography>
        {proposal.actions.map((action) => (
          <Typography key={action} type="body-xs" color="muted">
            · {action}
          </Typography>
        ))}
      </View>
    </PressableFeedback>
  );
}
