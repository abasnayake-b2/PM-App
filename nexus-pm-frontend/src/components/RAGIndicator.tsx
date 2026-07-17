import clsx from 'clsx';

const styles: Record<string, string> = {
  GREEN: 'bg-green/15 text-green border-green/30',
  AMBER: 'bg-warning/15 text-warning border-warning/30',
  RED: 'bg-danger/15 text-danger border-danger/30',
};

interface RAGIndicatorProps {
  status: string;
  className?: string;
}

export function RAGIndicator({ status, className }: RAGIndicatorProps) {
  const key = status?.toUpperCase() ?? 'GREEN';
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles[key] ?? styles.GREEN,
        className,
      )}
    >
      {key}
    </span>
  );
}
