import { Briefcase, Users } from 'lucide-react';

export type DashboardViewMode = 'resource' | 'pmo';

interface DashboardViewToggleProps {
  view: DashboardViewMode;
  onChange: (view: DashboardViewMode) => void;
  className?: string;
}

export function DashboardViewToggle({ view, onChange, className = '' }: DashboardViewToggleProps) {
  return (
    <div className={`flex rounded-lg border border-border p-0.5 ${className}`}>
      <button
        type="button"
        onClick={() => onChange('resource')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
          view === 'resource' ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
        }`}
      >
        <Users size={14} />
        Resource
      </button>
      <button
        type="button"
        onClick={() => onChange('pmo')}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
          view === 'pmo' ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
        }`}
      >
        <Briefcase size={14} />
        PMO
      </button>
    </div>
  );
}
