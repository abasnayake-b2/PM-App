import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface StatusOption {
  id: string;
  name: string;
}

interface MultiStatusFilterProps {
  statuses: StatusOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function MultiStatusFilter({
  statuses,
  selectedIds,
  onChange,
  disabled = false,
  className = '',
}: MultiStatusFilterProps) {
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

  const toggleStatus = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  const label =
    selectedIds.length === 0
      ? 'All statuses'
      : selectedIds.length === 1
        ? statuses.find((status) => status.id === selectedIds[0])?.name ?? '1 status'
        : `${selectedIds.length} statuses`;

  return (
    <div ref={containerRef} className={`relative text-sm ${className}`}>
      <span className="text-text2">Status</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="mt-1 flex min-w-[180px] items-center justify-between gap-2 rounded-lg border border-border bg-bg3 px-3 py-2 text-left text-sm disabled:opacity-50"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={16} className="shrink-0 text-text2" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full min-w-[240px] overflow-auto rounded-lg border border-border bg-bg2 p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-border px-2 pb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text2">Statuses</span>
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
          {statuses.map((status) => (
            <label
              key={status.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-bg3"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(status.id)}
                onChange={() => toggleStatus(status.id)}
              />
              <span className="truncate">{status.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
