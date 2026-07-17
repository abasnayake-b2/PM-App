import { LayoutGrid, Network, Table } from 'lucide-react';

export type OrganisationViewMode = 'cards' | 'grid' | 'tree';

interface OrganisationViewToggleProps {
  view: OrganisationViewMode;
  onChange: (view: OrganisationViewMode) => void;
  className?: string;
}

export function OrganisationViewToggle({ view, onChange, className = '' }: OrganisationViewToggleProps) {
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
      <button
        type="button"
        onClick={() => onChange('tree')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
          view === 'tree' ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
        }`}
      >
        <Network size={14} />
        Tree
      </button>
    </div>
  );
}
