import clsx from 'clsx';
import { Coffee, Droplets, Moon, Sun } from 'lucide-react';
import { useUIStore, type Theme } from '@/store/useUIStore';

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

/** Bean icon for dark-brown (espresso) — coffee cup is the light mocha theme. */
function BeanIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="12" rx="7" ry="10" />
      <path d="M12 2c-1.5 3.5-1.5 16.5 0 20" />
    </svg>
  );
}

const OPTIONS: { id: Theme; label: string; icon: typeof Sun | typeof BeanIcon }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'blue', label: 'Blue', icon: Droplets },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'espresso', label: 'Espresso', icon: BeanIcon },
];

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useUIStore();

  return (
    <div className={clsx('theme-switch', className)} role="group" aria-label="Theme">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTheme(id)}
          className={clsx('theme-switch-btn', theme === id && 'theme-switch-btn-active')}
          aria-pressed={theme === id}
          title={`${label} theme`}
        >
          <Icon size={14} />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}
