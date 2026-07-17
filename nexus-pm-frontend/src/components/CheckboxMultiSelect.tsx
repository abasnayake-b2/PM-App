import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  name: string;
}

interface CheckboxMultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function CheckboxMultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = 'Select…',
  emptyMessage = 'No options available',
  disabled = false,
  className = '',
}: CheckboxMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  const selectedNames = options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.name);

  const display = selectedNames.length === 0 ? placeholder : selectedNames.join(', ');

  return (
    <div ref={containerRef} className={`relative text-sm ${className}`}>
      <span className="text-text2">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg3 px-3 py-2 text-left text-sm disabled:opacity-50"
        title={selectedNames.length > 0 ? selectedNames.join(', ') : undefined}
      >
        <span className={`truncate ${selectedNames.length === 0 ? 'text-text2' : ''}`}>{display}</span>
        <ChevronDown size={16} className="shrink-0 text-text2" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-bg2 p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-border px-2 pb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text2">{label}</span>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-accent hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-text2">{emptyMessage}</p>
          ) : (
            options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-bg3"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(option.id)}
                  onChange={() => toggle(option.id)}
                />
                <span className="truncate">{option.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
