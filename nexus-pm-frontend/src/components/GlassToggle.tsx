import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';

interface GlassToggleProps {
  className?: string;
  compact?: boolean;
}

/** Toggle frosted glass surfaces. Default is solid. */
export function GlassToggle({ className, compact = false }: GlassToggleProps) {
  const glassEnabled = useUIStore((s) => s.glassEnabled);
  const toggleGlass = useUIStore((s) => s.toggleGlass);

  return (
    <button
      type="button"
      onClick={toggleGlass}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
        glassEnabled
          ? 'border-accent/40 bg-accent/15 text-accent'
          : 'border-border bg-bg3 text-text2 hover:bg-bg hover:text-text',
        className,
      )}
      aria-pressed={glassEnabled}
      title={glassEnabled ? 'Glass view on — click for solid' : 'Solid view — click for glass'}
    >
      <Sparkles size={14} />
      {!compact && (glassEnabled ? 'Glass' : 'Solid')}
    </button>
  );
}
