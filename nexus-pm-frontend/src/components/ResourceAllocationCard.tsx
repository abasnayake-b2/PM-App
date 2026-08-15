import type { Capacity } from '@/types';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { StackedAllocationBar } from '@/components/StackedAllocationBar';
import {
  availabilityLabel,
  allocationIssueTooltip,
  capacityPeriodView,
  durationWeightedAllocations,
  formatAllocationCardLabel,
  projectColor,
} from '@/utils/allocationUi';

interface ResourceAllocationCardProps {
  row: Capacity;
  rangeFrom: string;
  rangeTo: string;
  onSelect?: (row: Capacity) => void;
}

function isInactive(row: Capacity) {
  return (row.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE';
}

export function ResourceAllocationCard({ row, rangeFrom, rangeTo, onSelect }: ResourceAllocationCardProps) {
  const { allocations, totalPercentage, availablePercentage, overAllocated } = capacityPeriodView(
    row,
    rangeFrom,
    rangeTo,
  );
  const barAllocations = durationWeightedAllocations(allocations, rangeFrom, rangeTo);
  const subtitle = [row.designationName, row.departmentName].filter(Boolean).join(' · ');
  const orgLine = [
    row.vpName ? `VP: ${row.vpName}` : null,
    row.engineeringManagerName ? `EM: ${row.engineeringManagerName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const inactive = isInactive(row);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(row)}
      className={`card w-full p-5 text-left transition-colors hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        inactive ? 'opacity-60 grayscale' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ResourceAvatar name={row.employeeName} imageUrl={row.profilePictureUrl} />
          <div>
            <span className={`font-semibold ${inactive ? 'text-text2' : ''}`}>{row.employeeName}</span>
            {inactive && <p className="text-xs font-medium text-text3">Inactive</p>}
            {subtitle && <p className="text-xs text-text2">{subtitle}</p>}
            {orgLine && <p className="text-xs text-text3">{orgLine}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-lg font-bold tabular-nums ${
              inactive
                ? 'text-text3'
                : overAllocated
                  ? 'text-danger'
                  : totalPercentage >= 90
                    ? 'text-warning'
                    : 'text-text'
            }`}
          >
            {totalPercentage}%
          </p>
          <p className="text-xs text-text2">allocated</p>
          <p
            className={`mt-1 text-sm font-semibold tabular-nums ${
              inactive ? 'text-text3' : 'text-accent'
            }`}
          >
            {availablePercentage}%
          </p>
          <p className="text-xs text-text2">available</p>
        </div>
      </div>

      <div className={`mt-4 ${inactive ? 'opacity-70' : ''}`}>
        <StackedAllocationBar
          allocations={barAllocations}
          totalPercentage={totalPercentage}
          overAllocated={overAllocated}
        />
      </div>

      {allocations.length > 0 ? (
        <ul className={`mt-3 space-y-1 text-sm ${inactive ? 'text-text3' : 'text-text2'}`}>
          {allocations.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: projectColor(a.projectId, a.projectName) }}
              />
              <span className="truncate" title={allocationIssueTooltip(a)}>
                {formatAllocationCardLabel(a)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-text2">— on bench —</p>
      )}

      <p
        className={`mt-4 text-xs font-medium ${
          inactive
            ? 'text-text3'
            : totalPercentage >= 100
              ? 'text-danger'
              : totalPercentage >= 90
                ? 'text-warning'
                : 'text-text2'
        }`}
      >
        {inactive
          ? 'Inactive — allocations retained'
          : row.benchStatus === 'BENCH' && totalPercentage === 0
            ? 'On bench'
            : availabilityLabel(totalPercentage)}
      </p>
    </button>
  );
}
