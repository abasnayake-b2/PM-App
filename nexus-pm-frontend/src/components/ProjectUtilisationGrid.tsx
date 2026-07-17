import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { AllocationBar } from '@/components/AllocationBar';
import type { Allocation } from '@/types';
import type { ProjectUtilisationRow } from '@/utils/allocationUi';

interface ProjectUtilisationGridProps {
  rows: ProjectUtilisationRow[];
  canEdit?: boolean;
  onEdit?: (allocation: Allocation) => void;
  onDelete?: (allocation: Allocation) => void;
}

export function ProjectUtilisationGrid({
  rows,
  canEdit = false,
  onEdit,
  onDelete,
}: ProjectUtilisationGridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
          <tr>
            <th className="px-4 py-3">Resource</th>
            <th className="px-4 py-3">Utilisation</th>
            <th className="px-4 py-3">Allocated issues</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employeeId} className="border-t border-border align-top hover:bg-bg2/50">
              <td className="px-4 py-3">
                <p className="font-medium">{row.employeeName}</p>
                <p className="text-xs text-text2">
                  {row.allocations.length} issue allocation{row.allocations.length !== 1 ? 's' : ''}
                </p>
              </td>
              <td className="min-w-[180px] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-[100px] flex-1">
                    <AllocationBar
                      percentage={row.totalPercentage}
                      overAllocated={row.overAllocated}
                      showLabel={false}
                    />
                  </div>
                  <span
                    className={`shrink-0 tabular-nums font-semibold ${
                      row.overAllocated ? 'text-danger' : row.totalPercentage >= 90 ? 'text-warning' : ''
                    }`}
                  >
                    {row.totalPercentage}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <ul className="space-y-1.5">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
