import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight, Globe, MapPin, Plus } from 'lucide-react';
import { OrganisationTree } from '@/components/OrganisationTree';
import { OrganisationViewToggle, type OrganisationViewMode } from '@/components/OrganisationViewToggle';
import { OrgCrudActions } from '@/components/OrgCrudActions';
import {
  OrganisationEntityDialog,
  type OrgEntityDialogState,
} from '@/components/OrganisationEntityDialog';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectGrid } from '@/components/ProjectGrid';
import {
  useRegions,
  useCountries,
  useClients,
  useCreateRegion,
  useUpdateRegion,
  useDeleteRegion,
  useRestoreRegion,
  useCreateCountry,
  useUpdateCountry,
  useDeleteCountry,
  useRestoreCountry,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useRestoreClient,
} from '@/hooks/useOrganisation';
import { useProjects } from '@/hooks/useProjects';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import type { Client, Country, Region } from '@/types';

export function OrganisationPage() {
  const { can, superAdmin } = usePermissions();
  const canView = can(P.ORGANISATIONS_VIEW);
  const isAdmin = can(P.ORGANISATIONS_CREATE) || can(P.ORGANISATIONS_UPDATE) || can(P.ORGANISATIONS_DELETE);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  const [searchParams, setSearchParams] = useSearchParams();
  const regionId = searchParams.get('regionId') ?? '';
  const countryId = searchParams.get('countryId') ?? '';
  const clientId = searchParams.get('clientId') ?? '';

  const [listView, setListView] = useState<OrganisationViewMode>('cards');
  const [dialog, setDialog] = useState<OrgEntityDialogState | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const includeDeleted = showDeleted && superAdmin;
  const { data: regions, isLoading: regionsLoading } = useRegions(includeDeleted);
  const { data: countries, isLoading: countriesLoading } = useCountries(
    regionId || undefined,
    !!regionId,
    includeDeleted,
  );
  const { data: clients, isLoading: clientsLoading } = useClients(
    countryId || undefined,
    !!countryId,
    includeDeleted,
  );
  const { data: projectsData, isLoading: projectsLoading } = useProjects({
    clientId: clientId || undefined,
  });

  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion();
  const deleteRegion = useDeleteRegion();
  const restoreRegion = useRestoreRegion();
  const createCountry = useCreateCountry();
  const updateCountry = useUpdateCountry();
  const deleteCountry = useDeleteCountry();
  const restoreCountry = useRestoreCountry();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const restoreClient = useRestoreClient();

  const selectedRegion = regions?.find((r) => r.id === regionId);
  const selectedCountry = countries?.find((c) => c.id === countryId);
  const selectedClient = clients?.find((c) => c.id === clientId);
  const projects = projectsData?.content ?? [];

  const dialogPending =
    createRegion.isPending ||
    updateRegion.isPending ||
    createCountry.isPending ||
    updateCountry.isPending ||
    createClient.isPending ||
    updateClient.isPending;

  const dialogError =
    createRegion.error ??
    updateRegion.error ??
    createCountry.error ??
    updateCountry.error ??
    createClient.error ??
    updateClient.error;

  const navigateTo = (params: { regionId?: string; countryId?: string; clientId?: string }) => {
    const next = new URLSearchParams();
    if (params.regionId) next.set('regionId', params.regionId);
    if (params.countryId) next.set('countryId', params.countryId);
    if (params.clientId) next.set('clientId', params.clientId);
    setSearchParams(next);
  };

  const openCreate = (kind: OrgEntityDialogState['kind']) => {
    setDialog({ kind, mode: 'create' });
  };

  const openEdit = (kind: OrgEntityDialogState['kind'], item: Region | Country | Client) => {
    setDialog({ kind, mode: 'edit', item });
  };

  const closeDialog = () => {
    setDialog(null);
    createRegion.reset();
    updateRegion.reset();
    createCountry.reset();
    updateCountry.reset();
    createClient.reset();
    updateClient.reset();
  };

  const handleDialogSubmit = {
    onSubmitRegion: (payload: { name: string; code: string }) => {
      if (!dialog) return;
      if (dialog.mode === 'create') {
        createRegion.mutate(payload, {
          onSuccess: (r) => {
            closeDialog();
            navigateTo({ regionId: r.id });
          },
        });
        return;
      }
      const item = dialog.item as Region;
      updateRegion.mutate(
        { id: item.id, ...payload },
        { onSuccess: () => closeDialog() },
      );
    },
    onSubmitCountry: (payload: { regionId: string; name: string; code: string }) => {
      if (!dialog) return;
      if (dialog.mode === 'create') {
        createCountry.mutate(payload, {
          onSuccess: (c) => {
            closeDialog();
            navigateTo({ regionId: payload.regionId, countryId: c.id });
          },
        });
        return;
      }
      const item = dialog.item as Country;
      updateCountry.mutate(
        { id: item.id, ...payload },
        { onSuccess: () => closeDialog() },
      );
    },
    onSubmitClient: (payload: { countryId: string; name: string }) => {
      if (!dialog) return;
      if (dialog.mode === 'create') {
        createClient.mutate(payload, {
          onSuccess: (c) => {
            closeDialog();
            navigateTo({ regionId, countryId: payload.countryId, clientId: c.id });
          },
        });
        return;
      }
      const item = dialog.item as Client;
      updateClient.mutate(
        { id: item.id, countryId: payload.countryId, name: payload.name },
        { onSuccess: () => closeDialog() },
      );
    },
  };

  const projectCreateUrl = clientId
    ? `/projects/new?regionId=${regionId}&countryId=${countryId}&clientId=${clientId}`
    : '/projects/new';

  const sectionToolbar = (onCreate: () => void, createLabel: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <OrganisationViewToggle view={listView} onChange={setListView} />
      {isAdmin && listView !== 'tree' && (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium"
          style={{ color: 'var(--accent-fg)' }}
        >
          <Plus size={14} />
          {createLabel}
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        <Building2 className="text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Organisation</h1>
          <p className="text-text2">Region → Country → Client → Project</p>
          {isAdmin && listView !== 'tree' && (
            <p className="mt-1 text-xs text-text2">
              Use Grid view for create, edit, and delete. Tree view shows the full hierarchy. Cards view is for browsing.
            </p>
          )}
        </div>
      </div>

      {superAdmin && (
        <label className="mt-4 flex items-center gap-2 text-sm text-text2">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />
          Show deleted items (Super Admin can restore)
        </label>
      )}

      <nav className={`mt-6 flex flex-wrap items-center gap-1 text-sm ${listView === 'tree' ? 'hidden' : ''}`}>
        <button
          type="button"
          onClick={() => navigateTo({})}
          className={`rounded px-2 py-1 hover:bg-bg3 ${!regionId ? 'font-semibold text-accent' : 'text-text2'}`}
        >
          Regions
        </button>
        {selectedRegion && (
          <>
            <ChevronRight size={14} className="text-text2" />
            <button
              type="button"
              onClick={() => navigateTo({ regionId })}
              className={`rounded px-2 py-1 hover:bg-bg3 ${regionId && !countryId ? 'font-semibold text-accent' : 'text-text2'}`}
            >
              {selectedRegion.name}
            </button>
          </>
        )}
        {selectedCountry && (
          <>
            <ChevronRight size={14} className="text-text2" />
            <button
              type="button"
              onClick={() => navigateTo({ regionId, countryId })}
              className={`rounded px-2 py-1 hover:bg-bg3 ${countryId && !clientId ? 'font-semibold text-accent' : 'text-text2'}`}
            >
              {selectedCountry.name}
            </button>
          </>
        )}
        {selectedClient && (
          <>
            <ChevronRight size={14} className="text-text2" />
            <span className="px-2 py-1 font-semibold text-accent">{selectedClient.name}</span>
          </>
        )}
      </nav>

      {listView === 'tree' && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Organisation tree</h2>
            <OrganisationViewToggle view={listView} onChange={setListView} />
          </div>
          <div className="mt-4">
            <OrganisationTree
              onNavigate={(params) => {
                setListView('cards');
                navigateTo(params);
              }}
            />
          </div>
        </section>
      )}

      {/* Regions */}
      {listView !== 'tree' && !regionId && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Regions</h2>
            {sectionToolbar(() => openCreate('region'), 'New region')}
          </div>

          {regionsLoading && <p className="mt-4 text-text2">Loading regions…</p>}

          {listView === 'cards' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {regions?.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigateTo({ regionId: r.id })}
                  className="card flex items-center gap-3 p-4 text-left hover:border-accent/50"
                >
                  <Globe className="shrink-0 text-accent" size={20} />
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-text2">{r.code}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {listView === 'grid' && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regions?.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-bg2/50">
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-text2">{r.code}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigateTo({ regionId: r.id })}
                            className="text-sm text-accent hover:underline"
                          >
                            Open
                          </button>
                          {isAdmin && (
                            <OrgCrudActions
                              deleted={r.deleted}
                              onEdit={() => openEdit('region', r)}
                              onDelete={() => {
                                if (
                                  window.confirm(
                                    `Mark region "${r.name}" as deleted?\n\nThis will also mark all countries, clients, projects, issues, and allocations under it as deleted.`,
                                  )
                                ) {
                                  deleteRegion.mutate(r.id);
                                }
                              }}
                              onRestore={
                                superAdmin
                                  ? () => {
                                      if (
                                        window.confirm(
                                          `Restore region "${r.name}" and all related records under it?`,
                                        )
                                      ) {
                                        restoreRegion.mutate(r.id);
                                      }
                                    }
                                  : undefined
                              }
                              disabled={deleteRegion.isPending || restoreRegion.isPending}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Countries */}
      {listView !== 'tree' && regionId && !countryId && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Countries in {selectedRegion?.name}</h2>
            {sectionToolbar(() => openCreate('country'), 'New country')}
          </div>

          {countriesLoading && <p className="mt-4 text-text2">Loading countries…</p>}
          {!countriesLoading && countries?.length === 0 && (
            <p className="mt-4 text-text2">No countries in this region yet.</p>
          )}

          {listView === 'cards' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {countries?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigateTo({ regionId, countryId: c.id })}
                  className="card flex items-center gap-3 p-4 text-left hover:border-accent/50"
                >
                  <MapPin className="shrink-0 text-accent" size={20} />
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-text2">{c.code}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {listView === 'grid' && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {countries?.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-bg2/50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-text2">{c.code}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigateTo({ regionId, countryId: c.id })}
                            className="text-sm text-accent hover:underline"
                          >
                            Open
                          </button>
                          {isAdmin && (
                            <OrgCrudActions
                              deleted={c.deleted}
                              onEdit={() => openEdit('country', c)}
                              onDelete={() => {
                                if (
                                  window.confirm(
                                    `Mark country "${c.name}" as deleted?\n\nThis will also mark all clients, projects, issues, and allocations under it as deleted.`,
                                  )
                                ) {
                                  deleteCountry.mutate(c.id);
                                }
                              }}
                              onRestore={
                                superAdmin
                                  ? () => {
                                      if (window.confirm(`Restore country "${c.name}" and related records?`)) {
                                        restoreCountry.mutate(c.id);
                                      }
                                    }
                                  : undefined
                              }
                              disabled={deleteCountry.isPending || restoreCountry.isPending}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Clients */}
      {listView !== 'tree' && regionId && countryId && !clientId && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Clients in {selectedCountry?.name}</h2>
            {sectionToolbar(() => openCreate('client'), 'New client')}
          </div>

          {clientsLoading && <p className="mt-4 text-text2">Loading clients…</p>}
          {!clientsLoading && clients?.length === 0 && (
            <p className="mt-4 text-text2">No clients in this country yet.</p>
          )}

          {listView === 'cards' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clients?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigateTo({ regionId, countryId, clientId: c.id })}
                  className="card flex items-center gap-3 p-4 text-left hover:border-accent/50"
                >
                  <Building2 className="shrink-0 text-accent" size={20} />
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-text2">{c.status}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {listView === 'grid' && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients?.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-bg2/50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-text2">{c.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigateTo({ regionId, countryId, clientId: c.id })}
                            className="text-sm text-accent hover:underline"
                          >
                            Open
                          </button>
                          {isAdmin && (
                            <OrgCrudActions
                              deleted={c.deleted}
                              onEdit={() => openEdit('client', c)}
                              onDelete={() => {
                                if (
                                  window.confirm(
                                    `Mark client "${c.name}" as deleted?\n\nThis will also mark all projects, issues, and allocations under it as deleted.`,
                                  )
                                ) {
                                  deleteClient.mutate(c.id);
                                }
                              }}
                              onRestore={
                                superAdmin
                                  ? () => {
                                      if (window.confirm(`Restore client "${c.name}" and related records?`)) {
                                        restoreClient.mutate(c.id);
                                      }
                                    }
                                  : undefined
                              }
                              disabled={deleteClient.isPending || restoreClient.isPending}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Projects */}
      {listView !== 'tree' && regionId && countryId && clientId && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Projects for {selectedClient?.name}</h2>
            <div className="flex flex-wrap items-center gap-3">
              <OrganisationViewToggle view={listView} onChange={setListView} />
              {isAdmin && (
                <Link
                  to={projectCreateUrl}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium"
                  style={{ color: 'var(--accent-fg)' }}
                >
                  <Plus size={14} />
                  New project
                </Link>
              )}
            </div>
          </div>

          {projectsLoading && <p className="mt-4 text-text2">Loading projects…</p>}
          {!projectsLoading && projects.length === 0 && (
            <p className="mt-4 text-text2">No projects for this client yet.</p>
          )}
          {!projectsLoading && projects.length > 0 && listView === 'cards' && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
          {!projectsLoading && projects.length > 0 && listView === 'grid' && (
            <div className="mt-6">
              <ProjectGrid projects={projects} showManageActions={can(P.PROJECTS_CREATE)} />
            </div>
          )}
          {!isAdmin && (
            <p className="mt-4 text-xs text-text2">
              Open a project to edit details. Create and archive require Admin access.
            </p>
          )}
        </section>
      )}

      {dialog && (
        <OrganisationEntityDialog
          state={dialog}
          regions={regions ?? []}
          regionId={regionId}
          countryId={countryId}
          loading={dialogPending}
          error={dialogError}
          onClose={closeDialog}
          {...handleDialogSubmit}
        />
      )}
    </div>
  );
}
