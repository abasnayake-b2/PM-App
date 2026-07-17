import clsx from 'clsx';

interface PriorityBadgeProps {
  label: string;
  colour?: string;
  className?: string;
}

export function PriorityBadge({ label, colour, className }: PriorityBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        className,
      )}
      style={
        colour
          ? { backgroundColor: `${colour}22`, color: colour, border: `1px solid ${colour}44` }
          : { backgroundColor: 'var(--bg3)', color: 'var(--text2)' }
      }
    >
      {label}
    </span>
  );
}
