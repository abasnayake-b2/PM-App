import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchEmCapacityPlan,
  updateEmAdditionalResources,
  type EmCapacityMetricCell,
} from '@/api/emCapacityPlan.api';

const WEEK_OPTIONS = [
  { weeks: 4, label: '4 weeks' },
  { weeks: 8, label: '8 weeks' },
  { weeks: 12, label: '12 weeks' },
  { weeks: 26, label: '26 weeks' },
] as const;

function formatCell(cell?: EmCapacityMetricCell, key?: string) {
  if (!cell || cell.blank || cell.value == null) return '—';
  const value = cell.value;
  if (typeof value === 'number' && (key?.toLowerCase().includes('effort') || key === 'totalManDays')) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(value);
}

function AdditionalResourcesInput({
  emId,
  value,
  onSaved,
}: {
  emId: string;
  value: number;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  const mutation = useMutation({
    mutationFn: (next: number) => updateEmAdditionalResources(emId, next),
    onSuccess: () => onSaved(),
  });

  return (
    <input
      type="number"
      min={0}
      max={9999}
      value={draft}
      disabled={mutation.isPending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = Number.parseInt(draft, 10);
        const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        setDraft(String(next));
        if (next !== value) {
          mutation.mutate(next);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-16 rounded border border-border bg-bg px-1.5 py-1 text-right text-sm tabular-nums"
      title="Enter additional resources (manual)"
    />
  );
}

export function EmCapacityPlanSection() {
  const [weeks, setWeeks] = useState(12);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['em-capacity-plan', weeks],
    queryFn: () => fetchEmCapacityPlan(weeks),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const data = query.data;
  const ems = data?.engineeringManagers ?? [];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['em-capacity-plan'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">EM-wise summary</h2>
          <p className="mt-1 text-sm text-text2">
            Capacity window · {data?.windowFrom ?? '…'} → {data?.windowTo ?? '…'}
          </p>
          <p className="mt-1 text-xs text-text2">
            CR Type <span className="font-medium text-text">CR</span> = chargeable ·{' '}
            <span className="font-medium text-text">AMC</span> = not chargeable. Excludes Cancelled,
            In Production, Completed, On Hold, and empty status. Effort = Man-days Planned.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text2">Duration</span>
          <div className="flex rounded-lg border border-border p-0.5">
            {WEEK_OPTIONS.map((option) => (
              <button
                key={option.weeks}
                type="button"
                onClick={() => setWeeks(option.weeks)}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  weeks === option.weeks ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="card overflow-hidden p-0">
        <div className="max-h-[40rem] overflow-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-[1]">
              <tr>
                <th className="sticky left-0 z-[2] min-w-[14rem] border-b border-border bg-bg2 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-text2">
                  Metric
                </th>
                {ems.map((em) => (
                  <th
                    key={em.emId}
                    className="border-b border-border bg-success/15 px-3 py-3 text-center text-xs font-semibold text-text"
                    title={em.emName}
                  >
                    {em.shortName || em.emName}
                  </th>
                ))}
                <th className="border-b border-border bg-accent/15 px-3 py-3 text-center text-xs font-semibold text-text">
                  Totals
                </th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && (
                <tr>
                  <td colSpan={Math.max(ems.length + 2, 2)} className="px-4 py-8 text-text2">
                    Loading capacity planning…
                  </td>
                </tr>
              )}
              {query.error && (
                <tr>
                  <td colSpan={Math.max(ems.length + 2, 2)} className="px-4 py-8 text-danger">
                    Failed to load EM capacity plan.
                  </td>
                </tr>
              )}
              {!query.isLoading && !query.error && ems.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-text2">
                    No engineering managers found in the management roster.
                  </td>
                </tr>
              )}
              {data?.rows.map((row) => (
                <tr
                  key={row.key}
                  className={`border-t border-border ${row.summary ? 'bg-accent/10 font-semibold' : 'hover:bg-bg2/40'}`}
                >
                  <td className="sticky left-0 z-[1] bg-bg2 px-3 py-2.5 text-text">{row.label}</td>
                  {row.values.map((cell) => (
                    <td key={`${row.key}-${cell.emId}`} className="px-3 py-2.5 text-center tabular-nums">
                      {row.editable && cell.emId ? (
                        <AdditionalResourcesInput
                          emId={cell.emId}
                          value={typeof cell.value === 'number' ? cell.value : 0}
                          onSaved={refresh}
                        />
                      ) : (
                        formatCell(cell, row.key)
                      )}
                    </td>
                  ))}
                  <td
                    className={`px-3 py-2.5 text-center tabular-nums ${
                      row.summary ? 'bg-accent/10' : 'bg-accent/5'
                    }`}
                  >
                    {formatCell(row.total, row.key)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-text2">
        Tip: set <span className="font-medium text-text">CR Type</span> on each Change Request (CR or
        AMC), <span className="font-medium text-text">Man-days Planned</span> for effort, and{' '}
        <span className="font-medium text-text">Covered in Existing Resources</span> (Yes/No) to
        split chargeable CRs. Additional resources are entered manually per EM.
      </p>
    </div>
  );
}
