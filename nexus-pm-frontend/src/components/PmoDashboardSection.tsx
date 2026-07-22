import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { RAGIndicator } from '@/components/RAGIndicator';
import { useCrStatusMatrixDashboard } from '@/hooks/useDashboard';
import { useProjects } from '@/hooks/useProjects';
import { EmCapacityPlanSection } from '@/components/EmCapacityPlanSection';
import type { DashboardSummary, Project } from '@/types';
import type { CrStatusMatrix } from '@/api/crMatrix.api';

const RAG_KEYS = ['GREEN', 'AMBER', 'RED'] as const;

const RAG_BAR: Record<string, string> = {
  GREEN: 'bg-green',
  AMBER: 'bg-warning',
  RED: 'bg-danger',
};

type PmoDashboardTab = 'overview' | 'delivery' | 'portfolio' | 'capacity';

const PMO_DASHBOARD_TABS: { id: PmoDashboardTab; label: string; description: string }[] = [
  { id: 'overview', label: 'Overview', description: 'Headline PMO KPIs and health signals' },
  { id: 'delivery', label: 'Delivery', description: 'Projects needing PMO follow-up' },
  { id: 'portfolio', label: 'Portfolio', description: 'Full project portfolio view' },
  { id: 'capacity', label: 'Capacity Planning', description: 'EM-wise CR and resource summary' },
];

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card flex flex-col justify-center px-5 py-4">
      <p className="text-sm text-text2">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-text2">{hint}</p>}
    </div>
  );
}

function PmoDashboardTabs({
  activeTab,
  onChange,
}: {
  activeTab: PmoDashboardTab;
  onChange: (tab: PmoDashboardTab) => void;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-2 px-3 py-3">
      {PMO_DASHBOARD_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg border px-3 py-2 text-left transition ${
            activeTab === tab.id
              ? 'border-accent/40 bg-accent-muted text-accent'
              : 'border-border bg-bg2 text-text2 hover:text-text'
          }`}
        >
          <div className="text-sm font-semibold">{tab.label}</div>
          <div className="text-xs">{tab.description}</div>
        </button>
      ))}
    </div>
  );
}

function RagBreakdown({ projects, loading }: { projects: Project[]; loading: boolean }) {
  const counts = useMemo(() => {
    const tally: Record<string, number> = { GREEN: 0, AMBER: 0, RED: 0 };
    for (const p of projects) {
      const key = (p.ragStatus ?? 'GREEN').toUpperCase();
      if (key in tally) tally[key]++;
    }
    return tally;
  }, [projects]);

  const total = projects.length || 1;

  return (
    <section className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className="shrink-0 border-b border-border px-5 py-4">
        <h2 className="font-semibold">Portfolio health (RAG)</h2>
        <p className="mt-1 text-sm text-text2">Active projects by RAG status</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 px-5 py-5">
        {loading ? (
          <p className="text-sm text-text2">Loading portfolio…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-text2">No active projects in scope.</p>
        ) : (
          <>
            <div className="flex h-3 overflow-hidden rounded-full bg-bg3">
              {RAG_KEYS.map((rag) => {
                const pct = (counts[rag] / total) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={rag}
                    className={RAG_BAR[rag]}
                    style={{ width: `${pct}%` }}
                    title={`${rag}: ${counts[rag]}`}
                  />
                );
              })}
            </div>
            <dl className="grid grid-cols-3 gap-3">
              {RAG_KEYS.map((rag) => (
                <div key={rag} className="rounded-lg border border-border bg-bg2/50 px-3 py-2.5 text-center">
                  <dt className="mb-1 flex justify-center">
                    <RAGIndicator status={rag} />
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">{counts[rag]}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </section>
  );
}

function CrPipelineSummary({ matrix, loading }: { matrix?: CrStatusMatrix; loading: boolean }) {
  const statuses = matrix?.statuses ?? [];
  const statusCounts = matrix?.totals.statusCounts ?? {};

  const rows = useMemo(
    () =>
      [...statuses]
        .sort((a, b) => a.sequence - b.sequence)
        .map((s) => ({
          ...s,
          count: statusCounts[s.id] ?? 0,
        }))
        .filter((s) => s.count > 0 || !s.terminal),
    [statuses, statusCounts],
  );

  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  return (
    <section className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-semibold">CR pipeline</h2>
          <p className="mt-1 text-sm text-text2">Change requests by workflow stage</p>
        </div>
        <Link
          to="/issues"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Backlog tracker
          <ExternalLink size={14} />
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {loading ? (
          <p className="text-sm text-text2">Loading CR pipeline…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-text2">No change request data.</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={row.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate" title={row.name}>
                    {row.name}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">{row.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg3">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.count / maxCount) * 100}%`,
                      backgroundColor: row.colour || 'var(--accent)',
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PortfolioTable({
  projects,
  crByProject,
  loading,
}: {
  projects: Project[];
  crByProject: Map<string, { activeCr: number; totalCr: number }>;
  loading: boolean;
}) {
  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const ragOrder = (r: string) => {
          const i = RAG_KEYS.indexOf(r.toUpperCase() as (typeof RAG_KEYS)[number]);
          return i >= 0 ? i : 99;
        };
        const diff = ragOrder(b.ragStatus) - ragOrder(a.ragStatus);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      }),
    [projects],
  );

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-semibold">Project portfolio</h2>
          <p className="mt-1 text-sm text-text2">Active projects — sorted by RAG, then name</p>
        </div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          All projects
          <ArrowRight size={14} />
        </Link>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
            <tr>
              <th className="w-10 px-3 py-3">#</th>
              <th className="px-3 py-3">Project</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">EM</th>
              <th className="px-3 py-3">RAG</th>
              <th className="px-3 py-3">Progress</th>
              <th className="px-3 py-3 text-right">Backlog</th>
              <th className="px-3 py-3 text-right">Active CR</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-text2">
                  Loading projects…
                </td>
              </tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-text2">
                  No active projects in your scope.
                </td>
              </tr>
            )}
            {sorted.map((project, index) => {
              const cr = crByProject.get(project.id);
              const progress = project.progressPct ?? 0;
              return (
                <tr key={project.id} className="border-t border-border hover:bg-bg2/50">
                  <td className="px-3 py-2.5 tabular-nums text-text2">{index + 1}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">
                    <Link to={`/projects/${project.id}`} className="hover:text-accent" title={project.name}>
                      {project.name}
                    </Link>
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2.5 text-text2" title={project.clientName}>
                    {project.clientName ?? '—'}
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2.5 text-text2" title={project.engineeringManagerName}>
                    {project.engineeringManagerName ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <RAGIndicator status={project.ragStatus} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-[5rem] items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg3">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-text2">
                        {progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{project.backlogItemCount ?? 0}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{cr?.activeCr ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeliveryProjectTable({
  projects,
  crByProject,
  loading,
}: {
  projects: Project[];
  crByProject: Map<string, { activeCr: number; totalCr: number }>;
  loading: boolean;
}) {
  const rows = useMemo(
    () =>
      [...projects]
        .map((project) => ({
          project,
          activeCr: crByProject.get(project.id)?.activeCr ?? 0,
        }))
        .filter(({ project, activeCr }) => {
          const rag = (project.ragStatus ?? 'GREEN').toUpperCase();
          return rag !== 'GREEN' || activeCr > 0;
        })
        .sort((a, b) => {
          const ragWeight = (rag: string) => (rag === 'RED' ? 3 : rag === 'AMBER' ? 2 : 1);
          const byRag = ragWeight(b.project.ragStatus?.toUpperCase?.() ?? 'GREEN')
            - ragWeight(a.project.ragStatus?.toUpperCase?.() ?? 'GREEN');
          if (byRag !== 0) return byRag;
          if (b.activeCr !== a.activeCr) return b.activeCr - a.activeCr;
          return a.project.name.localeCompare(b.project.name);
        })
        .slice(0, 12),
    [crByProject, projects],
  );

  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">Projects needing attention</h2>
        <p className="mt-1 text-sm text-text2">Amber/red projects or projects with active CRs</p>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
            <tr>
              <th className="w-10 px-3 py-3">#</th>
              <th className="px-3 py-3">Project</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">EM</th>
              <th className="px-3 py-3">RAG</th>
              <th className="px-3 py-3 text-right">Progress</th>
              <th className="px-3 py-3 text-right">Backlog</th>
              <th className="px-3 py-3 text-right">Active CR</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-text2">
                  Loading delivery dashboard…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-text2">
                  No active delivery risks in scope.
                </td>
              </tr>
            )}
            {rows.map(({ project, activeCr }, index) => (
              <tr key={project.id} className="border-t border-border hover:bg-bg2/50">
                <td className="px-3 py-2.5 tabular-nums text-text2">{index + 1}</td>
                <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">
                  <Link to={`/projects/${project.id}`} className="hover:text-accent" title={project.name}>
                    {project.name}
                  </Link>
                </td>
                <td className="max-w-[10rem] truncate px-3 py-2.5 text-text2" title={project.clientName}>
                  {project.clientName ?? '—'}
                </td>
                <td className="max-w-[10rem] truncate px-3 py-2.5 text-text2" title={project.engineeringManagerName}>
                  {project.engineeringManagerName ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  <RAGIndicator status={project.ragStatus} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{project.progressPct ?? 0}%</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{project.backlogItemCount ?? 0}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{activeCr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClientDistribution({ projects }: { projects: Project[] }) {
  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      const client = project.clientName?.trim() || 'Unassigned client';
      counts.set(client, (counts.get(client) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [projects]);

  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section className="card flex h-full min-h-0 flex-col overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">Projects by client</h2>
        <p className="mt-1 text-sm text-text2">Top clients by active project count</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
        {rows.length === 0 ? (
          <p className="text-sm text-text2">No client data available.</p>
        ) : (
          rows.map((row) => (
            <div key={row.name}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate" title={row.name}>
                  {row.name}
                </span>
                <span className="tabular-nums font-medium">{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg3">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

interface PmoDashboardSectionProps {
  summary?: DashboardSummary;
  summaryLoading?: boolean;
}

export function PmoDashboardSection({ summary, summaryLoading }: PmoDashboardSectionProps) {
  const { data: projectsPage, isLoading: projectsLoading } = useProjects({ status: 'ACTIVE', size: 500 });
  const crQuery = useCrStatusMatrixDashboard();
  const [activeTab, setActiveTab] = useState<PmoDashboardTab>('overview');

  const activeProjects = useMemo(
    () => (projectsPage?.content ?? []).filter((p) => !p.archived && p.status === 'ACTIVE'),
    [projectsPage],
  );

  const crByProject = useMemo(() => {
    const map = new Map<string, { activeCr: number; totalCr: number }>();
    for (const row of crQuery.data?.rows ?? []) {
      map.set(row.projectId, { activeCr: row.activeCr, totalCr: row.totalCr });
    }
    return map;
  }, [crQuery.data]);

  const loading = summaryLoading || projectsLoading || crQuery.isLoading;
  const riskProjects = useMemo(
    () => activeProjects.filter((project) => ['AMBER', 'RED'].includes((project.ragStatus ?? 'GREEN').toUpperCase())),
    [activeProjects],
  );
  const projectsWithActiveCr = useMemo(
    () => activeProjects.filter((project) => (crByProject.get(project.id)?.activeCr ?? 0) > 0),
    [activeProjects, crByProject],
  );
  const avgProgress = useMemo(() => {
    if (activeProjects.length === 0) return 0;
    return Math.round(
      activeProjects.reduce((sum, project) => sum + (project.progressPct ?? 0), 0) / activeProjects.length,
    );
  }, [activeProjects]);
  const projectsWithoutEm = useMemo(
    () => activeProjects.filter((project) => !project.engineeringManagerName?.trim()).length,
    [activeProjects],
  );

  return (
    <div className="space-y-4">
      <PmoDashboardTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Active projects"
              value={loading ? '…' : (summary?.activeProjects ?? activeProjects.length)}
            />
            <KpiCard
              label="Open backlog items"
              value={loading ? '…' : (summary?.openIssues ?? 0)}
              hint="Non-terminal issues in scope"
            />
            <KpiCard
              label="Total change requests"
              value={loading ? '…' : (crQuery.data?.totals.totalCr ?? 0)}
            />
            <KpiCard
              label="Active change requests"
              value={loading ? '…' : (crQuery.data?.totals.activeCr ?? 0)}
              hint="Excluding completed / cancelled"
            />
          </div>

          <div className="grid min-h-[18rem] gap-4 lg:grid-cols-2">
            <RagBreakdown projects={activeProjects} loading={projectsLoading} />
            <CrPipelineSummary matrix={crQuery.data} loading={crQuery.isLoading} />
          </div>
        </>
      )}

      {activeTab === 'delivery' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Amber / red projects"
              value={loading ? '…' : riskProjects.length}
              hint="Projects that likely need PMO follow-up"
            />
            <KpiCard
              label="Projects with active CRs"
              value={loading ? '…' : projectsWithActiveCr.length}
              hint="Projects carrying open change demand"
            />
            <KpiCard
              label="Average progress"
              value={loading ? '…' : `${avgProgress}%`}
              hint="Across active projects"
            />
            <KpiCard
              label="Projects without EM"
              value={loading ? '…' : projectsWithoutEm}
              hint="Needs ownership review"
            />
          </div>

          <div className="grid min-h-[18rem] gap-4 lg:grid-cols-2">
            <CrPipelineSummary matrix={crQuery.data} loading={crQuery.isLoading} />
            <ClientDistribution projects={activeProjects} />
          </div>

          <DeliveryProjectTable projects={activeProjects} crByProject={crByProject} loading={projectsLoading} />
        </>
      )}

      {activeTab === 'portfolio' && (
        <>
          <div className="grid min-h-[18rem] gap-4 lg:grid-cols-2">
            <RagBreakdown projects={activeProjects} loading={projectsLoading} />
            <ClientDistribution projects={activeProjects} />
          </div>

          <PortfolioTable projects={activeProjects} crByProject={crByProject} loading={projectsLoading} />
        </>
      )}

      {activeTab === 'capacity' && <EmCapacityPlanSection />}
    </div>
  );
}
