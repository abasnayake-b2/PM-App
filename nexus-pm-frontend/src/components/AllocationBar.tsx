import clsx from 'clsx';

interface AllocationBarProps {
  percentage: number;
  overAllocated?: boolean;
  className?: string;
  showLabel?: boolean;
}

export function AllocationBar({
  percentage,
  overAllocated,
  className,
  showLabel = true,
}: AllocationBarProps) {
  const capped = Math.min(percentage, 100);
  const overflow = percentage > 100 ? percentage - 100 : 0;

  return (
    <div className={clsx('w-full', className)}>
      {showLabel && (
        <div className="mb-1 flex justify-between text-xs text-text2">
          <span>Utilisation</span>
          <span className={overAllocated ? 'font-semibold text-danger' : ''}>{percentage}%</span>
        </div>
      )}
      <div className="relative h-2.5 overflow-hidden rounded-full bg-bg3">
        <div
          className={clsx(
            'absolute inset-y-0 left-0 rounded-full transition-all',
            overAllocated ? 'bg-danger' : percentage >= 80 ? 'bg-warning' : 'bg-accent',
          )}
          style={{ width: `${capped}%` }}
        />
        {overflow > 0 && (
          <div
            className="absolute inset-y-0 rounded-full bg-danger/60"
            style={{ left: '100%', width: `${Math.min(overflow, 50)}%`, transform: 'translateX(-100%)' }}
          />
        )}
      </div>
    </div>
  );
}
