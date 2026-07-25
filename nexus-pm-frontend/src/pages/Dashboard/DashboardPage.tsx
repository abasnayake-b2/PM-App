import { Link } from 'react-router-dom';
import { useState } from 'react';
import { AlertTriangle, Bell, RefreshCw } from 'lucide-react';
import { SlideOverListPanel } from '@/components/SlideOverListPanel';
import {
  groupBreakdownProjects,
  groupEngineersByDesignation,
  type SlideOverEntry,
  type SlideOverGroup,
} from '@/utils/breakdownProjects';
import { useDashboardOverview, useCapacityUtilisationDashboard } from '@/hooks/useDashboard';
import { useAuthStore } from '@/store/useAuthStore';
import {
  CapacityUtilisationSection,
  EmUtilisationWithHeatmap,
  GroupBarsChart,
} from '@/components/CapacityUtilisationSection';
import { DashboardViewToggle, type DashboardViewMode } from '@/components/DashboardViewToggle';
import { PmoDashboardSection } from '@/components/PmoDashboardSection';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { canViewOrgDashboard, isPortfolioWideRole } from '@/utils/orgRoles';

const CAPACITY_WEEK_OPTIONS = [
  { weeks: 4, label: '4 weeks' },
  { weeks: 8, label: '8 weeks' },
  { weeks: 12, label: '12 weeks' },
  { weeks: 26, label: '26 weeks' },
] as const;

const DASHBOARD_VIEW_KEY = 'dfnpm-dashboard-view';

function readDashboardView(): DashboardViewMode {
  try {
    const stored = sessionStorage.getItem(DASHBOARD_VIEW_KEY);
    return stored === 'pmo' ? 'pmo' : 'resource';
  } catch {
    return 'resource';
  }
}

function formatRelativeTime(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return new Date(iso).toLocaleTimeString();
}

type BreakdownPanel = {
  title: string;
  subtitle: string;
  items?: SlideOverEntry[];
  groups?: SlideOverGroup[];
};

function CountPanelTrigger({
  count,
  items,
  groups,
  label,
  subtitle,
  onOpen,
}: {
  count: number;
  items?: SlideOverEntry[];
  groups?: SlideOverGroup[];
  label: string;
  subtitle: string;
  onOpen: (panel: BreakdownPanel) => void;
}) {
  if (count === 0) {
    return <span className="font-semibold">{count}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen({ title: label, subtitle, items, groups })}
      className="font-semibold text-accent hover:underline"
      title={`View ${label.toLowerCase()}`}
    >
      {count}
    </button>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const showOrgOverview = canViewOrgDashboard(role, user?.orgWideVisibility);
  const isManager = role === 'MANAGER' || role === 'ADMIN' || isPortfolioWideRole(role);
  const { can } = usePermissions();
  const showCapacityUtilisation = can(P.REPORTS_VIEW) && can(P.ALLOCATIONS_VIEW);
  const showPmoDashboard = can(P.PMO_VIEW);
  const [dashboardView, setDashboardView] = useState<DashboardViewMode>(readDashboardView);
  const [capacityWeeks, setCapacityWeeks] = useState(12);
  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useDashboardOverview();
  const capacityQuery = useCapacityUtilisationDashboard(showCapacityUtilisation, capacityWeeks);
  const [breakdownPanel, setBreakdownPanel] = useState<BreakdownPanel | null>(null);

  const summary = data?.summary;
  const capacityRangeLabel = `${capacityWeeks} weeks`;
  const effectiveView: DashboardViewMode =
    showPmoDashboard && dashboardView === 'pmo' ? 'pmo' : 'resource';
  const isPmoView = effectiveView === 'pmo';

  const handleDashboardViewChange = (view: DashboardViewMode) => {
    if (view === 'pmo' && !showPmoDashboard) return;
    setDashboardView(view);
    try {
      sessionStorage.setItem(DASHBOARD_VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  };

  const capacityDurationControl = showCapacityUtilisation && !isPmoView ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-text2">
        Capacity window · {capacityQuery.data?.heatmapFrom ?? '…'} →{' '}
        {capacityQuery.data?.heatmapTo ?? '…'}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text2">Duration</span>
        <div className="flex rounded-lg border border-border p-0.5">
          {CAPACITY_WEEK_OPTIONS.map((option) => (
            <button
              key={option.weeks}
              type="button"
              onClick={() => setCapacityWeeks(option.weeks)}
              className={`rounded-md px-2.5 py-1 text-sm ${
                capacityWeeks === option.weeks
                  ? 'bg-bg3 text-accent'
                  : 'text-text2 hover:text-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="brand-mark mt-1 hidden h-12 w-12 text-base sm:flex">DF</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-text2">
              Welcome back, <span className="font-medium text-text">{user?.name}</span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-text2">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  isFetching ? 'animate-pulse bg-accent' : 'bg-success'
                }`}
              />
              Live data · updated{' '}
              {formatRelativeTime(data?.generatedAt ?? new Date(dataUpdatedAt).toISOString())}
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1 text-accent hover:underline"
                title="Refresh now"
              >
                <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                Refresh
              </button>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(summary?.unreadNotifications ?? 0) > 0 && (
            <Link
              to="/notifications"
              className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-muted px-4 py-2 text-sm font-medium text-accent"
            >
              <Bell size={16} />
              {summary?.unreadNotifications} unread
            </Link>
          )}
          {showPmoDashboard && (
            <DashboardViewToggle view={effectiveView} onChange={handleDashboardViewChange} />
          )}
        </div>
      </div>

      {isPmoView ? (
        <PmoDashboardSection summary={summary} summaryLoading={isLoading} />
      ) : (
        <>
      {showOrgOverview && (
        <>
          {capacityDurationControl}

          <div className="grid min-h-[22rem] gap-4 xl:grid-cols-[minmax(14rem,0.75fr)_minmax(16rem,1fr)_minmax(20rem,1.5fr)] xl:items-stretch">
            <section className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
              <div className="shrink-0 border-b border-border px-5 py-4">
                <h2 className="font-semibold">Organisation overview</h2>
                <p className="mt-1 text-sm text-text2">Workforce and project totals</p>
              </div>
              <dl className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-5 py-5">
                <div className="flex items-center justify-between gap-4 border-b border-border pb-2.5">
                  <dt className="text-sm text-text2"># Engineers</dt>
                  <dd className="text-xl tabular-nums">
                    {isLoading ? (
                      '…'
                    ) : (
                      <CountPanelTrigger
                        count={data?.orgWorkforce?.employeeCount ?? 0}
                        groups={groupEngineersByDesignation(data?.orgWorkforce?.employees ?? [])}
                        label="Engineers"
                        subtitle="Organisation overview"
                        onOpen={setBreakdownPanel}
                      />
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border pb-2.5">
                  <dt className="text-sm text-text2"># CXO</dt>
                  <dd className="text-xl tabular-nums">
                    {isLoading ? (
                      '…'
                    ) : (
                      <CountPanelTrigger
                        count={data?.orgWorkforce?.cxoCount ?? 0}
                        groups={groupEngineersByDesignation(data?.orgWorkforce?.cxos ?? [])}
                        label="CXO"
                        subtitle="Organisation overview"
                        onOpen={setBreakdownPanel}
                      />
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border pb-2.5">
                  <dt className="text-sm text-text2"># VP</dt>
                  <dd className="text-xl tabular-nums">
                    {isLoading ? (
                      '…'
                    ) : (
                      <CountPanelTrigger
                        count={data?.orgWorkforce?.vpCount ?? 0}
                        groups={groupEngineersByDesignation(data?.orgWorkforce?.vps ?? [])}
                        label="VP"
                        subtitle="Organisation overview"
                        onOpen={setBreakdownPanel}
                      />
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border pb-2.5">
                  <dt className="text-sm text-text2"># of Engineering Manager</dt>
                  <dd className="text-xl tabular-nums">
                    {isLoading ? (
                      '…'
                    ) : (
                      <CountPanelTrigger
                        count={data?.orgWorkforce?.engineeringManagerCount ?? 0}
                        groups={groupEngineersByDesignation(
                          data?.orgWorkforce?.engineeringManagers ?? [],
                        )}
                        label="Engineering managers"
                        subtitle="Organisation overview"
                        onOpen={setBreakdownPanel}
                      />
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-sm text-text2"># Projects</dt>
                  <dd className="text-xl tabular-nums">
                    {isLoading ? (
                      '…'
                    ) : (
                      <CountPanelTrigger
                        count={data?.orgWorkforce?.projectCount ?? 0}
                        groups={groupBreakdownProjects(data?.orgWorkforce?.projects ?? [])}
                        label="Projects"
                        subtitle="Organisation overview"
                        onOpen={setBreakdownPanel}
                      />
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
              <div className="shrink-0 border-b border-border px-5 py-4">
                <h2 className="font-semibold">By VP</h2>
                <p className="mt-1 text-sm text-text2">EMs, engineers, and projects by VP</p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-9" />
                    <col />
                    <col className="w-14" />
                    <col className="w-14" />
                    <col className="w-14" />
                  </colgroup>
                  <thead className="sticky top-0 z-[1] bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
                    <tr>
                      <th className="px-2 py-3">#</th>
                      <th className="px-2 py-3">VP</th>
                      <th className="px-2 py-3 text-right">EMs</th>
                      <th className="px-2 py-3 text-right">Eng</th>
                      <th className="px-2 py-3 text-right">Proj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-text2">
                          Loading organisation data…
                        </td>
                      </tr>
                    )}
                    {!isLoading && (data?.vpBreakdown?.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-text2">
                          No VPs found. Import management roster with VP roles under Admin →
                          Management.
                        </td>
                      </tr>
                    )}
                    {data?.vpBreakdown?.map((row, index) => (
                      <tr key={row.vpId} className="border-t border-border hover:bg-bg2/50">
                        <td className="px-2 py-2.5 tabular-nums text-text2">{index + 1}</td>
                        <td className="max-w-0 truncate px-2 py-2.5 font-medium" title={row.vpName}>
                          {row.vpName}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          <CountPanelTrigger
                            count={row.engineeringManagerCount}
                            groups={groupEngineersByDesignation(row.engineeringManagers ?? [])}
                            label="Engineering managers"
                            subtitle={row.vpName}
                            onOpen={setBreakdownPanel}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          <CountPanelTrigger
                            count={row.engineerCount}
                            groups={groupEngineersByDesignation(row.engineers ?? [])}
                            label="Engineers"
                            subtitle={row.vpName}
                            onOpen={setBreakdownPanel}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          <CountPanelTrigger
                            count={row.projectCount}
                            groups={groupBreakdownProjects(row.projects ?? [])}
                            label="Projects"
                            subtitle={row.vpName}
                            onOpen={setBreakdownPanel}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {showCapacityUtilisation ? (
              <GroupBarsChart
                title="Utilisation by team"
                subtitle={`Average allocation % over the next ${capacityRangeLabel} — click a bar for allocated vs free`}
                rows={capacityQuery.data?.byTeam ?? []}
              />
            ) : (
              <section className="card flex h-full items-center justify-center p-5 text-sm text-text2">
                Utilisation by team unavailable
              </section>
            )}
          </div>

          {showCapacityUtilisation && (
            <EmUtilisationWithHeatmap
              utilRows={capacityQuery.data?.byEngineeringManager ?? []}
              emBreakdown={data?.emBreakdown}
              heatmap={capacityQuery.data?.heatmap}
              onOpenBreakdown={setBreakdownPanel}
              weeksLabel={capacityRangeLabel}
            />
          )}
        </>
      )}

      {!showOrgOverview && showCapacityUtilisation && (
        <div className="space-y-3">
          {capacityDurationControl}
          <EmUtilisationWithHeatmap
            utilRows={capacityQuery.data?.byEngineeringManager ?? []}
            emBreakdown={data?.emBreakdown}
            heatmap={capacityQuery.data?.heatmap}
            onOpenBreakdown={setBreakdownPanel}
            weeksLabel={capacityRangeLabel}
          />
        </div>
      )}

      {isManager && (summary?.overAllocatedEmployees ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          <p>
            <strong>{summary?.overAllocatedEmployees}</strong> team member
            {(summary?.overAllocatedEmployees ?? 0) > 1 ? 's are' : ' is'} over-allocated today.{' '}
            <Link to="/resources" className="font-medium text-accent hover:underline">
              View capacity →
            </Link>
          </p>
        </div>
      )}

      {showCapacityUtilisation && (
        <CapacityUtilisationSection
          data={capacityQuery.data}
          isLoading={capacityQuery.isLoading}
          error={!!capacityQuery.error}
          showTeamBars={!showOrgOverview}
          showHeatmap={false}
          weeksLabel={capacityRangeLabel}
        />
      )}
        </>
      )}

      {breakdownPanel && (
        <SlideOverListPanel
          title={breakdownPanel.title}
          subtitle={breakdownPanel.subtitle}
          items={breakdownPanel.items}
          groups={breakdownPanel.groups}
          onClose={() => setBreakdownPanel(null)}
        />
      )}
    </div>
  );
}
