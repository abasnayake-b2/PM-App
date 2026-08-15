import type { Capacity } from '@/types';
import { availabilityLabel, capacityPeriodView } from '@/utils/allocationUi';

interface ResourceAllocationGridProps {
  rows: Capacity[];
  rangeFrom: string;
  rangeTo: string;
  onSelect?: (row: Capacity) => void;
}

export function ResourceAllocationGrid({ rows, rangeFrom, rangeTo, onSelect }: ResourceAllocationGridProps) {
  const cellClass = 'whitespace-nowrap px-4 py-2';

  return (
    <div className="rounded-xl border border-border">
      <div className="max-h-[min(70vh,720px)] overflow-auto">
        <table className="w-max min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
            <tr className="whitespace-nowrap">
              <th className="w-12 px-3 py-2 text-center">#</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Designation</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">VP</th>
              <th className="px-4 py-2">EM</th>
              <th className="px-4 py-2 text-right">Allocated</th>
              <th className="px-4 py-2 text-right">Available</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const { totalPercentage, availablePercentage, overAllocated } = capacityPeriodView(
                row,
                rangeFrom,
                rangeTo,
              );
              const inactive = (row.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE';
              return (
                <tr
                  key={row.employeeId}
                  className={`border-t border-border hover:bg-bg2/50 ${
                    inactive ? 'bg-bg2/40 text-text3' : ''
                  }`}
                >
                  <td className={`${cellClass} text-center text-xs tabular-nums text-text2`}>{index + 1}</td>
                  <td className={cellClass}>
                    <button
                      type="button"
                      onClick={() => onSelect?.(row)}
                      className={`max-w-[220px] truncate font-medium hover:underline ${
                        inactive ? 'text-text3' : 'text-accent'
                      }`}
                      title={row.employeeName}
                    >
                      {row.employeeName}
                      {inactive ? ' (Inactive)' : ''}
                    </button>
                  </td>
                  <td className={`${cellClass} text-text2`}>{row.designationName ?? '—'}</td>
                  <td className={`${cellClass} text-text2`}>{row.departmentName ?? '—'}</td>
                  <td className={`${cellClass} text-text2`}>{row.vpName ?? '—'}</td>
                  <td className={`${cellClass} text-text2`}>{row.engineeringManagerName ?? '—'}</td>
                  <td
                    className={`${cellClass} text-right font-semibold tabular-nums ${
                      inactive
                        ? 'text-text3'
                        : overAllocated
                          ? 'text-danger'
                          : totalPercentage >= 90
                            ? 'text-warning'
                            : 'text-text'
                    }`}
                  >
                    {totalPercentage}%
                  </td>
                  <td
                    className={`${cellClass} text-right font-semibold tabular-nums ${
                      inactive ? 'text-text3' : 'text-accent'
                    }`}
                  >
                    {availablePercentage}%
                  </td>
                  <td className={`${cellClass} text-text2`}>
                    {inactive
                      ? 'Inactive'
                      : row.benchStatus === 'BENCH' && totalPercentage === 0
                        ? 'On bench'
                        : availabilityLabel(totalPercentage)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-text2">
        {rows.length} team member{rows.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
