import type { Allocation } from '@/types';
import { projectColor } from '@/utils/allocationUi';

interface StackedAllocationBarProps {
  allocations: Allocation[];
  totalPercentage: number;
  overAllocated?: boolean;
  height?: number;
}

export function StackedAllocationBar({
  allocations,
  totalPercentage,
  overAllocated,
  height = 10,
}: StackedAllocationBarProps) {
  const segments = allocations.map((a) => ({
    id: a.id,
    width: a.percentage,
    color: projectColor(a.projectId, a.projectName),
    label: a.issueTitle,
    title: `${a.issueTitle} · ${a.projectName}`,
  }));

  const free = Math.max(0, 100 - totalPercentage);
  const displayTotal = Math.min(totalPercentage, 100);

  return (
    <div
      className="relative w-full overflow-hidden rounded-full bg-bg3"
      style={{ height }}
      title={segments.map((s) => `${s.title} ${s.width}%`).join(', ')}
    >
      <div className="flex h-full" style={{ width: `${displayTotal}%` }}>
        {segments.map((s) => (
          <div
            key={s.id}
            style={{
              width: totalPercentage > 0 ? `${(s.width / totalPercentage) * 100}%` : '0%',
              backgroundColor: s.color,
            }}
          />
        ))}
      </div>
      {overAllocated && (
        <div
          className="absolute inset-y-0 right-0 bg-danger/70"
          style={{ width: `${Math.min(totalPercentage - 100, 30)}%` }}
        />
      )}
      {free > 0 && totalPercentage < 100 && (
        <div className="absolute inset-y-0 right-0 w-full opacity-0" aria-hidden />
      )}
    </div>
  );
}
