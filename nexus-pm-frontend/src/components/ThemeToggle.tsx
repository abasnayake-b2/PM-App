import clsx from 'clsx';
import { Droplets, Moon, Sun } from 'lucide-react';
import { useUIStore, type Theme } from '@/store/useUIStore';

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

const OPTIONS: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'blue', label: 'Blue', icon: Droplets },
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
