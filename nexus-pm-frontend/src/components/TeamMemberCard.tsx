import type { Capacity } from '@/types';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { roleLabel, teamProjectSummary, capacityPeriodView } from '@/utils/allocationUi';

interface TeamMemberCardProps {
  row: Capacity;
  selected?: boolean;
  onSelect: () => void;
}

export function TeamMemberCard({ row, selected, onSelect }: TeamMemberCardProps) {
  const { totalPercentage, overAllocated } = capacityPeriodView(row);
  const pctClass =
    overAllocated || totalPercentage >= 100
      ? 'text-danger'
      : totalPercentage >= 90
        ? 'text-warning'
        : totalPercentage === 0
          ? 'text-text2'
          : 'text-text';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`card w-full p-5 text-left transition hover:border-accent/50 ${
        selected ? 'border-accent ring-1 ring-accent/30' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <ResourceAvatar name={row.employeeName} imageUrl={row.profilePictureUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{row.employeeName}</p>
          <p className="truncate text-xs text-text2">{roleLabel(row)}</p>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${pctClass}`}>{totalPercentage}%</span>
      </div>
      <p className="mt-4 truncate text-sm text-text2">{teamProjectSummary(row)}</p>
    </button>
  );
}
