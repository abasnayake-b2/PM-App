import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { AllocationBar } from '@/components/AllocationBar';
import type { Allocation } from '@/types';
import type { ProjectUtilisationRow } from '@/utils/allocationUi';

interface ProjectUtilisationCardProps {
  row: ProjectUtilisationRow;
  canEdit?: boolean;
  onEdit?: (allocation: Allocation) => void;
  onDelete?: (allocation: Allocation) => void;
}

export function ProjectUtilisationCard({
  row,
  canEdit = false,
  onEdit,
  onDelete,
}: ProjectUtilisationCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{row.employeeName}</h3>
          <p className="text-sm text-text2">
            {row.allocations.length} issue allocation{row.allocations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span
          className={`text-lg font-bold tabular-nums ${
            row.overAllocated ? 'text-danger' : row.totalPercentage >= 90 ? 'text-warning' : ''
          }`}
        >
          {row.totalPercentage}%
        </span>
      </div>
      <div className="mt-4">
        <AllocationBar percentage={row.totalPercentage} overAllocated={row.overAllocated} />
      </div>
      <ul className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
        {row.allocations.map((allocation) => (
          <li key={allocation.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link to={`/issues/${allocation.issueId}`} className="text-accent hover:underline">
                {allocation.issueTitle}
              </Link>
              <p className="text-xs text-text2">
                {allocation.fromDate}
                {allocation.toDate ? ` → ${allocation.toDate}` : ' → ongoing'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="tabular-nums text-text2">{allocation.percentage}%</span>
              {canEdit && onEdit && onDelete && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(allocation)}
                    className="rounded p-1 text-text2 hover:bg-bg3 hover:text-accent"
                    title="Edit allocation"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(allocation)}
                    className="rounded p-1 text-text2 hover:bg-danger/10 hover:text-danger"
                    title="Remove allocation"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
