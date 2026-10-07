import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export type MenuSelectOption = {
  value: string;
  label: string;
};

interface MenuSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: MenuSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const MENU_MAX_HEIGHT = 240;

/**
 * In-page select. Native &lt;select&gt; option clicks fail inside glass/overflow slide-overs.
 */
export function MenuSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  required = false,
  className = '',
}: MenuSelectProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );

  const selected = options.find((option) => option.value === value);
  const display = selected?.label || placeholder;

  const updateCoords = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, Math.max(120, openUp ? spaceAbove : spaceBelow));
    setCoords({
      top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onReposition = () => updateCoords();
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    buttonRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={`flex w-full items-center justify-between gap-2 text-left disabled:opacity-50 ${className}`}
      >
        <span className={`min-w-0 truncate ${selected ? '' : 'text-text2'}`}>{display}</span>
        <ChevronDown size={16} className="shrink-0 text-text2" />
      </button>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          className="hidden"
          value={value}
          onChange={() => {}}
          required
        />
      )}
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
            className="fixed z-[80] overflow-auto rounded-lg border border-border bg-bg2 py-1 shadow-lg"
          >
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-text2">{placeholder}</p>
            ) : (
              options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value || '__empty'}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-bg3 ${
                      active ? 'bg-bg3 font-medium' : ''
                    }`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      pick(option.value);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
