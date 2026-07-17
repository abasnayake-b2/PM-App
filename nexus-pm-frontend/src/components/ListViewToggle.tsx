import { LayoutGrid, Table } from 'lucide-react';

export type ListViewMode = 'cards' | 'grid';

interface ListViewToggleProps {
  view: ListViewMode;
  onChange: (view: ListViewMode) => void;
  className?: string;
}

export function ListViewToggle({ view, onChange, className = '' }: ListViewToggleProps) {
  return (
    <div className={`flex rounded-lg border border-border p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => onChange('cards')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
          view === 'cards' ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
        }`}
      >
        <LayoutGrid size={14} />
        Cards
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
          view === 'grid' ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
        }`}
      >
        <Table size={14} />
        Grid
      </button>
    </div>
  );
}
