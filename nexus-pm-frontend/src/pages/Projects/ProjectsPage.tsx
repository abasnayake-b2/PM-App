import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Plus } from 'lucide-react';
import { ListViewToggle, type ListViewMode } from '@/components/ListViewToggle';
import { OrganisationTree } from '@/components/OrganisationTree';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectGrid } from '@/components/ProjectGrid';
import { RAGIndicator } from '@/components/RAGIndicator';
import { fetchClients, fetchCountries, fetchRegions } from '@/api/organisations.api';
import { fetchTeamManagement } from '@/api/teamRoster.api';
import { useProjects } from '@/hooks/useProjects';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import {
  engineeringManagerIdsUnderVp,
  filterEngineeringManagerOptions,
  filterVpOptions,
} from '@/utils/managementRoles';

const RAG_OPTIONS = ['', 'GREEN', 'AMBER', 'RED'];

type OrgFilter = {
  regionId?: string;
  countryId?: string;
  clientId?: string;
};

export function ProjectsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const { can } = usePermissions();
  const canCreate = can(P.PROJECTS_CREATE);
  const canFilterOrg = can(P.ORGANISATIONS_VIEW);
  const isManager = role === 'MANAGER';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const [view, setView] = useState<ListViewMode>('cards');
  const [orgFilter, setOrgFilter] = useState<OrgFilter>({});
  const [ragStatus, setRagStatus] = useState('');
  const [vpManagementId, setVpManagementId] = useState('');
  const [engineeringManagerManagementId, setEngineeringManagerManagementId] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => fetchRegions(),
    enabled: canFilterOrg,
  });

  const { data: countries } = useQuery({
    queryKey: ['countries', orgFilter.regionId],
    queryFn: () => fetchCountries(orgFilter.regionId || undefined),
    enabled: canFilterOrg,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', orgFilter.countryId],
    queryFn: () => fetchClients({ countryId: orgFilter.countryId || undefined }),
    enabled: canFilterOrg,
  });

  const { data: management } = useQuery({
    queryKey: ['team-management'],
    queryFn: () => fetchTeamManagement(),
  });

  const vpOptions = useMemo(() => filterVpOptions(management ?? []), [management]);
  const engineeringManagerOptions = useMemo(
    () => filterEngineeringManagerOptions(management ?? [], vpManagementId || undefined),
    [management, vpManagementId],
  );

  const handleVpChange = (nextVpId: string) => {
    setVpManagementId(nextVpId);
    if (!nextVpId) return;
    if (!engineeringManagerManagementId) return;
    const allowed = engineeringManagerIdsUnderVp(management ?? [], nextVpId);
    if (!allowed.has(engineeringManagerManagementId)) {
      setEngineeringManagerManagementId('');
    }
  };

  const filteredCountries = useMemo(() => {
    const list = countries ?? [];
    if (!orgFilter.regionId) return list;
    return list.filter((country) => country.regionId === orgFilter.regionId);
  }, [countries, orgFilter.regionId]);

  const filteredClients = useMemo(() => {
    const list = clients ?? [];
    if (orgFilter.countryId) {
      return list.filter((client) => client.countryId === orgFilter.countryId);
    }
    if (orgFilter.regionId) {
      const countryIds = new Set(filteredCountries.map((country) => country.id));
      return list.filter((client) => countryIds.has(client.countryId));
    }
    return list;
  }, [clients, orgFilter.countryId, orgFilter.regionId, filteredCountries]);

  const { data, isLoading, error } = useProjects({
    clientId: orgFilter.clientId || undefined,
    regionId: orgFilter.regionId || undefined,
    countryId: orgFilter.countryId || undefined,
    ragStatus: ragStatus || undefined,
    vpManagementId: vpManagementId || undefined,
    engineeringManagerManagementId: engineeringManagerManagementId || undefined,
    includeArchived: showArchived,
  });

  const projects = data?.content ?? [];

  const hasOrgFilter = !!(orgFilter.regionId || orgFilter.countryId || orgFilter.clientId);

  const subtitle = useMemo(() => {
    if (isLoading) return 'Loading your projects…';
    if (isManager && !isAdmin) {
      const count = data?.totalElements ?? projects.length;
      return `${count} project${count !== 1 ? 's' : ''} assigned to you`;
    }
    return 'Portfolio overview and health status';
  }, [isLoading, isManager, isAdmin, data?.totalElements, projects.length]);

  const handleRegionChange = (regionId: string) => {
    if (!regionId) {
      setOrgFilter({});
      return;
    }
    setOrgFilter({ regionId });
  };

  const handleCountryChange = (countryId: string) => {
    if (!countryId) {
      setOrgFilter((prev) => ({ regionId: prev.regionId }));
      return;
    }
    const country = (countries ?? []).find((item) => item.id === countryId);
    setOrgFilter({
      regionId: country?.regionId ?? orgFilter.regionId,
      countryId,
    });
  };

  const handleClientChange = (clientId: string) => {
    if (!clientId) {
      setOrgFilter((prev) => ({
        regionId: prev.regionId,
        countryId: prev.countryId,
      }));
      return;
    }
    const client = (clients ?? []).find((item) => item.id === clientId);
    const country = client
      ? (countries ?? []).find((item) => item.id === client.countryId)
      : undefined;
    setOrgFilter({
      regionId: country?.regionId,
      countryId: client?.countryId,
      clientId,
    });
  };

  const handleTreeNavigate = (params: OrgFilter) => {
    setOrgFilter({
      regionId: params.regionId,
      countryId: params.countryId,
      clientId: params.clientId,
    });
  };

  const clearOrgFilters = () => setOrgFilter({});

  const projectList = (
    <>
      {isLoading && <p className="text-text2">Loading projects…</p>}
      {error && (
        <p className="text-danger">Failed to load projects. Check that the API is running.</p>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <p className="text-text2">No projects match your filters.</p>
      )}

      {!isLoading && !error && projects.length > 0 && view === 'cards' && (
        <div
          className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && !error && projects.length > 0 && view === 'grid' && (
        <ProjectGrid projects={projects} showManageActions={canCreate} />
      )}

      {!isLoading && projects.length > 0 && (
        <p className="mt-6 text-sm text-text2">
          Showing {projects.length} of {data?.totalElements ?? projects.length} projects
        </p>
      )}

      {projects.length > 0 && (
        <div className="mt-8 rounded-xl border border-border bg-bg2 p-4">
          <h2 className="mb-3 text-sm font-semibold text-text2">Legend</h2>
          <div className="flex flex-wrap gap-3">
            {['GREEN', 'AMBER', 'RED'].map((s) => (
              <RAGIndicator key={s} status={s} />
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FolderKanban className="text-accent" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-text2">{subtitle}</p>
          </div>
        </div>
        {canCreate && (
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Plus size={16} />
            New project
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <ListViewToggle view={view} onChange={setView} />

        {canFilterOrg && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text2">Region</span>
              <select
                value={orgFilter.regionId ?? ''}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-border bg-bg2 px-3 py-2 text-sm"
              >
                <option value="">All regions</option>
                {(regions ?? []).map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text2">Country</span>
              <select
                value={orgFilter.countryId ?? ''}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-border bg-bg2 px-3 py-2 text-sm"
              >
                <option value="">All countries</option>
                {filteredCountries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text2">Client</span>
              <select
                value={orgFilter.clientId ?? ''}
                onChange={(e) => handleClientChange(e.target.value)}
                className="min-w-[10rem] rounded-lg border border-border bg-bg2 px-3 py-2 text-sm"
              >
                <option value="">All clients</option>
                {filteredClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text2">VP</span>
          <select
            value={vpManagementId}
            onChange={(e) => handleVpChange(e.target.value)}
            className="min-w-[12rem] rounded-lg border border-border bg-bg2 px-3 py-2 text-sm"
          >
            <option value="">All VPs</option>
            {vpOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text2">Engineering manager</span>
          <select
            value={engineeringManagerManagementId}
            onChange={(e) => setEngineeringManagerManagementId(e.target.value)}
            disabled={!!vpManagementId && engineeringManagerOptions.length === 0}
            className="min-w-[12rem] rounded-lg border border-border bg-bg2 px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {vpManagementId && engineeringManagerOptions.length === 0
                ? 'No managers under this VP'
                : 'All engineering managers'}
            </option>
            {engineeringManagerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text2">RAG status</span>
          <select
            value={ragStatus}
            onChange={(e) => setRagStatus(e.target.value)}
            className="rounded-lg border border-border bg-bg2 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {RAG_OPTIONS.filter(Boolean).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-text2">Show archived</span>
        </label>

        {canFilterOrg && hasOrgFilter && (
          <button
            type="button"
            onClick={clearOrgFilters}
            className="pb-2 text-sm text-accent hover:underline"
          >
            Clear org filters
          </button>
        )}
      </div>

      {canFilterOrg ? (
        <div className="mt-8 flex min-h-[28rem] gap-6">
          <aside className="flex w-72 shrink-0 flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text2">Region → client → project</h2>
              {hasOrgFilter && (
                <button
                  type="button"
                  onClick={clearOrgFilters}
                  className="text-xs text-accent hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
              <OrganisationTree
                compact
                selection={orgFilter}
                onNavigate={handleTreeNavigate}
              />
            </div>
          </aside>
          <div className="min-w-0 flex-1">{projectList}</div>
        </div>
      ) : (
        <div className="mt-8">{projectList}</div>
      )}
    </div>
  );
}
