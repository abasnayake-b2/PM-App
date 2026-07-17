import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface SlideOverPanelProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Wider panel for denser forms. Default max-w-md. */
  wide?: boolean;
  /** Panel width. `third` ≈ 33vw; overrides `wide` when set. */
  size?: 'default' | 'wide' | 'half' | 'third';
  /** Soft accent header strip (RD panels). */
  accent?: boolean;
}

/**
 * Right-side sliding edit/create panel (matches detail panel pattern).
 */
export function SlideOverPanel({
  title,
  subtitle,
  onClose,
  children,
  wide,
  size,
  accent,
}: SlideOverPanelProps) {
  const resolvedSize = size ?? (wide ? 'wide' : 'default');
  const widthClass =
    resolvedSize === 'third'
      ? 'w-full sm:w-1/3 sm:max-w-none'
      : resolvedSize === 'half'
        ? 'w-full sm:w-1/2 sm:max-w-none'
        : resolvedSize === 'wide'
          ? 'max-w-xl'
          : 'max-w-md';

  const compactChrome = resolvedSize === 'half' || resolvedSize === 'third';

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-bg shadow-2xl ${widthClass}`}
      >
        {accent && (
          <div
            className="h-1 w-full shrink-0 bg-gradient-to-r from-accent via-[color:var(--accent-hover)] to-[color:var(--accent-muted)]"
            aria-hidden
          />
        )}
        <div
          className={`flex items-start justify-between gap-3 border-b border-border ${
            accent
              ? 'bg-gradient-to-r from-[color:var(--accent-muted)]/40 to-bg2'
              : 'bg-bg2'
          } ${compactChrome ? 'px-3 py-2.5' : 'p-5'}`}
        >
          <div className="min-w-0">
            <h2
              className={`truncate font-bold text-text ${compactChrome ? 'text-base' : 'text-lg'}`}
            >
              {title}
            </h2>
            {subtitle ? (
              <p className={`mt-0.5 truncate text-text2 ${compactChrome ? 'text-xs' : 'text-sm'}`}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text2 transition hover:bg-bg3 hover:text-text"
          >
            <X size={20} />
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto bg-bg ${compactChrome ? 'p-3' : 'p-5'}`}>
          {children}
        </div>
      </aside>
    </>
  );
}
