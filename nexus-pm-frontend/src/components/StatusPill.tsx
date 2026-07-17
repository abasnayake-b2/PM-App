import clsx from 'clsx';

interface StatusPillProps {
  label: string;
  colour?: string;
  className?: string;
}

export function StatusPill({ label, colour, className }: StatusPillProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        !colour && 'border-border bg-bg3 text-text2',
        className,
      )}
      style={
        colour
          ? { borderColor: `${colour}55`, backgroundColor: `${colour}22`, color: colour }
          : undefined
      }
    >
      {label}
    </span>
  );
}
