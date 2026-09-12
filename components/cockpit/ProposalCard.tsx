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
  arbiter: 'Arbiter · Blended plan',
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
  onSelect: (id: string) => void;
}

export function ProposalCard({
  proposal,
  baseline,
  isRecommended,
  isSelected,
  onSelect,
}: ProposalCardProps) {
  const [success, warning] = useThemeColor(['success', 'warning']);

  return (
    <PressableFeedback
      onPress={() => onSelect(proposal.id)}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      className={cn(
        'bg-panel gap-3 rounded-2xl border p-3',
        isSelected ? 'border-accent bg-panel-raised' : 'border-border',
      )}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <OptionBadge id={proposal.id} author={proposal.author} />
        <View className="min-w-40 flex-1">
          <Typography type="body-sm" weight="semibold">
            {AUTHOR_LABEL[proposal.author]}
          </Typography>
          <Typography type="body-xs" color="muted">
            {AUTHOR_GOAL[proposal.author]}
          </Typography>
        </View>
        {isRecommended && (
          <Chip size="sm" variant="secondary" color="success">
            <Chip.Label>Recommended</Chip.Label>
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

      <ImpactMetricsRow metrics={proposal.metrics} baseline={baseline} />

      <View className="gap-1.5">
        <View className="flex-row gap-2">
          <Check size={14} color={success} style={{ marginTop: 3 }} />
          <Typography type="body-sm" className="flex-1">
            {proposal.reason}
          </Typography>
        </View>
        <View className="flex-row gap-2">
          <TriangleAlert size={14} color={warning} style={{ marginTop: 3 }} />
          <Typography type="body-sm" color="muted" className="flex-1">
            {proposal.tradeoff}
          </Typography>
        </View>
      </View>

      <View className="bg-panel-raised gap-1 rounded-xl px-3 py-2">
        <Typography type="body-xs" className="text-muted tracking-[2px]">
          DISPATCHER STEPS
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
