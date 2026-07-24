import { useState, FormEvent, useEffect, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Pencil, Plus, Users } from 'lucide-react';
import { ProjectUtilisationSection } from '@/components/ProjectUtilisationSection';
import { RAGIndicator } from '@/components/RAGIndicator';
import { ProjectForm } from '@/components/ProjectForm';
import { ReleaseForm } from '@/components/ReleaseForm';
import { ProjectBacklogTab } from '@/components/ProjectBacklogTab';
import { ReleaseBoard } from '@/components/ReleaseBoard';
import {
  useProject,
  useProjectHealthLog,
  useProjectReleases,
  useCreateRelease,
  useUpdateProject,
  useArchiveProject,
  useDeleteProject,
  useUpdateProjectRag,
} from '@/hooks/useProjects';
import type { UpdateProjectPayload } from '@/hooks/useProjects';
import { useAllocations } from '@/hooks/useResources';
import { useIssues } from '@/hooks/useIssues';
import { fetchClients } from '@/api/organisations.api';
import { fetchTeamManagement, fetchTeamRosterMembers } from '@/api/teamRoster.api';
import { filterEngineeringManagerOptions } from '@/utils/managementRoles';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { aggregateProjectUtilisation, todayLocalIso } from '@/utils/allocationUi';
import { projectProgressHint, projectProgressLabel } from '@/utils/projectUi';

type Tab = 'overview' | 'backlog' | 'releases' | 'health' | 'utilisation';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can, superAdmin } = usePermissions();
  const canEditProject = can(P.PROJECTS_UPDATE);
  const canDeleteProject = can(P.PROJECTS_DELETE);
  const canCreateRelease = can(P.RELEASES_CREATE);
  const canImportBacklog = superAdmin;
  const canCreateIssue = can(P.ISSUES_CREATE);
  const canEditAllocations = can(P.ALLOCATIONS_CREATE) || can(P.ALLOCATIONS_UPDATE);

  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [addingRelease, setAddingRelease] = useState(false);
  const [ragStatus, setRagStatus] = useState('GREEN');
  const [ragNotes, setRagNotes] = useState('');

  const { data: project, isLoading, error } = useProject(id);
  const { data: healthLog } = useProjectHealthLog(tab === 'health' ? id : undefined);
  const { data: releases } = useProjectReleases(tab === 'releases' ? id : undefined);
  const { data: projectIssuesData } = useIssues(
    { projectId: id },
    { enabled: tab === 'releases' && !!id },
  );
  const { data: projectAllocations } = useAllocations(
    { projectId: id, asOf: todayLocalIso() },
    { enabled: !!id },
  );

  const createRelease = useCreateRelease(id!);

  const projectUtilisation = useMemo(
    () => aggregateProjectUtilisation(projectAllocations ?? []),
    [projectAllocations],
  );

  const updateProject = useUpdateProject(id!);
  const archiveProject = useArchiveProject();
  const deleteProjectMutation = useDeleteProject();
  const updateRag = useUpdateProjectRag(id!);

  const { data: rosterMembers } = useQuery({
    queryKey: ['team-roster-members'],
    queryFn: () => fetchTeamRosterMembers(),
    enabled: editing && canEditProject,
  });

  const { data: management } = useQuery({
    queryKey: ['team-management'],
    queryFn: () => fetchTeamManagement(),
    enabled: editing && canEditProject,
  });

  const rosterEmployees = useMemo(
    () =>
      (rosterMembers ?? [])
        .filter((member) => member.status === 'ACTIVE')
        .map((member) => ({ id: member.id, label: member.fullName })),
    [rosterMembers],
  );

  const engineeringManagerOptions = useMemo(
    () => filterEngineeringManagerOptions(management ?? []),
    [management],
  );

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    enabled: false,
  });

  useEffect(() => {
    if (project?.ragStatus) {
      setRagStatus(project.ragStatus);
    }
  }, [project?.ragStatus]);

  if (id === 'new') {
    return <Navigate to="/projects/new" replace />;
  }

  if (isLoading) {
    return <p className="text-text2">Loading project…</p>;
  }

  if (error || !project) {
    return (
      <div>
        <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
          <ArrowLeft size={16} />
          Back to projects
        </Link>
        <p className="mt-4 text-danger">Project not found or access denied.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'backlog', label: 'Backlog' },
    { key: 'releases', label: 'Releases' },
    { key: 'health', label: 'Health log' },
    { key: 'utilisation', label: 'Utilisation' },
  ];

  const handleArchive = () => {
    if (project.deleted || project.archived) {
      if (!superAdmin) {
        window.alert('Only Super Admin can restore a deleted project.');
        return;
      }
      if (window.confirm(`Restore project "${project.name}" and its issues and allocations?`)) {
        archiveProject.mutate({ id: project.id, archived: false });
      }
      return;
    }
    if (
      window.confirm(
        `Mark project "${project.name}" as deleted?\n\nAll issues and allocations under this project will also be marked deleted.`,
      )
    ) {
      deleteProjectMutation.mutate(project.id);
    }
  };

  const handleRagSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateRag.mutate({ ragStatus, notes: ragNotes || undefined }, {
      onSuccess: () => setRagNotes(''),
    });
  };

  return (
    <div>
      <Link to="/projects" className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
        <ArrowLeft size={16} />
        Back to projects
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <RAGIndicator status={project.ragStatus} />
            {project.archived && (
              <span className="rounded bg-bg3 px-2 py-0.5 text-xs text-text2">
                {project.deleted ? 'Deleted' : 'Archived'}
              </span>
            )}
          </div>
          <p className="mt-1 text-text2">{project.clientName}</p>
          {project.product && (
            <p className="mt-1 text-sm text-text2">Product: {project.product}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-border bg-bg2 px-3 py-1 text-sm">{project.status}</span>
          {canEditProject && !editing && (
            <button
              type="button"
              onClick={() => {
                setRagStatus(project.ragStatus);
                setEditing(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bg3"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          {canDeleteProject && (
            <button
              type="button"
              onClick={handleArchive}
              className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
            >
              {project.archived || project.deleted ? 'Restore' : 'Delete project'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 border-b border-border">
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`border-b-2 pb-3 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text2 hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && editing && canEditProject && (
        <div className="mt-6 max-w-2xl">
          <ProjectForm
            mode="edit"
            initial={project}
            clients={clients?.map((c) => ({ id: c.id, label: c.name })) ?? []}
            rosterEmployees={rosterEmployees}
            engineeringManagerOptions={engineeringManagerOptions}
            loading={updateProject.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(payload) => {
              updateProject.mutate(payload as UpdateProjectPayload, {
                onSuccess: () => setEditing(false),
              });
            }}
          />
        </div>
      )}

      {tab === 'overview' && !editing && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text2">Region</dt>
                <dd>{project.regionName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text2">VP</dt>
                <dd>{project.vpName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text2">Engineering manager</dt>
                <dd>{project.engineeringManagerName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text2">Project lead</dt>
                <dd>{project.leadEmployeeName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text2">Architect</dt>
                <dd>{project.architectEmployeeName ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text2">Progress</dt>
                <dd title={projectProgressHint(project)}>{projectProgressLabel(project)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text2">Budget</dt>
                <dd>
                  {project.budgetAmount != null
                    ? `${project.budgetCurrency ?? ''} ${project.budgetAmount}`
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Timeline</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-text2">
                <Calendar size={16} />
                <span>
                  {project.startDate ?? '—'} → {project.endDate ?? '—'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-text2">
                <Users size={16} />
                <span>
                  {projectUtilisation.length > 0
                    ? `${projectUtilisation.length} member${projectUtilisation.length !== 1 ? 's' : ''} allocated (see Utilisation tab)`
                    : `${project.teamSize ?? 0} team members`}
                </span>
              </div>
            </div>
            <div className="mt-6">
              <div className="mb-1 flex justify-between text-xs text-text2">
                <span>Completion</span>
                <span title={projectProgressHint(project)}>{project.progressPct ?? 0}%</span>
              </div>
              <p className="mb-2 text-xs text-text2">{projectProgressHint(project)}</p>
              <div className="h-2 overflow-hidden rounded-full bg-bg3">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${project.progressPct ?? 0}%` }}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'backlog' && id && (
        <ProjectBacklogTab
          projectId={id}
          projectLabel={project.product ?? project.name}
          canImportBacklog={canImportBacklog}
          canCreateIssue={canCreateIssue}
        />
      )}

      {tab === 'releases' && (
        <div className="mt-6 space-y-6">
          {canCreateRelease && !addingRelease && (
            <button
              type="button"
              onClick={() => setAddingRelease(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium"
              style={{ color: 'var(--accent-fg)' }}
            >
              <Plus size={16} />
              New release
            </button>
          )}

          {canCreateRelease && addingRelease && (
            <div className="max-w-2xl">
              <ReleaseForm
                loading={createRelease.isPending}
                onCancel={() => {
                  setAddingRelease(false);
                  createRelease.reset();
                }}
                onSubmit={(payload) => {
                  createRelease.mutate(payload, {
                    onSuccess: () => {
                      setAddingRelease(false);
                      createRelease.reset();
                    },
                  });
                }}
              />
            </div>
          )}

          {!addingRelease && (
            <ReleaseBoard
              releases={releases ?? []}
              issues={projectIssuesData?.content ?? []}
              allocations={projectAllocations ?? []}
              isManagerOrAbove={canCreateRelease}
            />
          )}

          {!addingRelease && (!releases || releases.length === 0) && (
            <p className="text-text2">Create a release to group issues for delivery.</p>
          )}
        </div>
      )}

      {tab === 'health' && (
        <div className="mt-6 space-y-6">
          {canEditProject && (
            <form onSubmit={handleRagSubmit} className="card p-5">
              <h2 className="font-semibold">Update RAG status</h2>
              <div className="mt-4 flex flex-wrap gap-4">
                <label className="text-sm">
                  <span className="text-text2">Status</span>
                  <select
                    value={ragStatus}
                    onChange={(e) => setRagStatus(e.target.value)}
                    className="mt-1 block rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
                  >
                    {['GREEN', 'AMBER', 'RED'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-[200px] flex-1 text-sm">
                  <span className="text-text2">Notes</span>
                  <input
                    type="text"
                    value={ragNotes}
                    onChange={(e) => setRagNotes(e.target.value)}
                    placeholder="Reason for change…"
                    className="mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={updateRag.isPending}
                className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ color: 'var(--accent-fg)' }}
              >
                {updateRag.isPending ? 'Saving…' : 'Record health update'}
              </button>
            </form>
          )}

          <div className="space-y-4">
            {healthLog && healthLog.length > 0 ? (
              healthLog.map((entry) => (
                <div key={entry.id} className="card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <RAGIndicator status={entry.ragStatus} />
                    <span className="text-xs text-text2">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {entry.notes && <p className="mt-2 text-sm text-text2">{entry.notes}</p>}
                  {entry.changedByName && (
                    <p className="mt-1 text-xs text-text2">By {entry.changedByName}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-text2">No health log entries yet.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'utilisation' && id && (
        <ProjectUtilisationSection projectId={id} canEdit={canEditAllocations} />
      )}
    </div>
  );
}
