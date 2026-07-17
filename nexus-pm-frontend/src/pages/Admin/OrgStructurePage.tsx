import { FormEvent, useState } from 'react';
import { Network } from 'lucide-react';
import { ManagementOrgTree } from '@/components/ManagementOrgTree';
import { ManagementOrgChart } from '@/components/ManagementOrgChart';
import { OrgStructureStats } from '@/components/OrgStructureStats';
import { OrgStructureManagersTab } from '@/components/OrgStructureManagersTab';
import { OrgStructureEmployeesTab } from '@/components/OrgStructureEmployeesTab';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useTeamManagement, useUpdateTeamManagement } from '@/hooks/useTeamRoster';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import type { TeamManagement } from '@/api/teamRoster.api';

type Section = 'people' | 'chart' | 'stats' | 'managers' | 'employees';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

export function OrgStructurePage() {
  const { can } = usePermissions();
  const canEdit = can(P.TEAM_CREATE) || can(P.TEAM_UPDATE);
  const [section, setSection] = useState<Section>('people');
  const [editing, setEditing] = useState<TeamManagement | null>(null);

  const { data: management = [] } = useTeamManagement();
  const updateRow = useUpdateTeamManagement(editing?.id ?? '');

  const handleSupervisorSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    updateRow.mutate(
      {
        roleTitle: editing.roleTitle,
        firstName: editing.firstName,
        lastName: editing.lastName,
        supervisorId: (fd.get('supervisorId') as string) || undefined,
        supervisorName: (fd.get('supervisorName') as string).trim() || undefined,
        status: editing.status,
      },
      {
        onSuccess: () => {
          setEditing(null);
          updateRow.reset();
        },
      },
    );
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <Network className="text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Org structure</h1>
          <p className="text-text2">
            Build the management tree using supervisor links from the management roster
          </p>
        </div>
      </div>

      <div className="mt-6 border-b border-border">
        <nav className="-mb-px flex flex-wrap gap-4">
          {(
            [
              ['people', 'Management & teams'],
              ['chart', 'Org chart'],
              ['managers', 'Leadership'],
              ['employees', 'Engineers'],
              ['stats', 'Stats'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`border-b-2 pb-3 text-sm font-medium transition ${
                section === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text2 hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {section === 'people' ? (
          <section>
            <ManagementOrgTree
              canEdit={canEdit}
              selectedId={editing?.id ?? null}
              onSelect={setEditing}
            />
          </section>
        ) : section === 'chart' ? (
          <section className="min-w-0">
            <p className="mb-3 text-sm text-text2">
              Full org chart: C-level (CEO/COO/…) → VP → Manager → Engineers. Scroll horizontally
              and vertically to explore the tree.
            </p>
            <ManagementOrgChart />
          </section>
        ) : section === 'managers' ? (
          <section className="min-w-0">
            <p className="mb-4 text-sm text-text2">
              Leadership roster for viewing and download (Excel / PDF).
            </p>
            <OrgStructureManagersTab />
          </section>
        ) : section === 'employees' ? (
          <section className="min-w-0">
            <p className="mb-4 text-sm text-text2">
              Engineer roster for viewing and download (Excel / PDF).
            </p>
            <OrgStructureEmployeesTab />
          </section>
        ) : section === 'stats' ? (
          <section className="min-w-0">
            <p className="mb-4 text-sm text-text2">
              Designation code headcount by category (org-wide) and by VP.
            </p>
            <OrgStructureStats />
          </section>
        ) : null}
      </div>

      {canEdit && editing && (
        <SlideOverPanel
          title={`Set supervisor — ${editing.fullName}`}
          subtitle={editing.roleTitle}
          onClose={() => {
            setEditing(null);
            updateRow.reset();
          }}
        >
          <form onSubmit={handleSupervisorSubmit} className="space-y-4">
            <label className="block text-sm">
              <span className="text-text2">Supervisor (linked)</span>
              <select
                name="supervisorId"
                defaultValue={editing.supervisorId ?? ''}
                className={inputClass}
              >
                <option value="">None / use text below</option>
                {management
                  .filter((person) => person.id !== editing.id)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName} — {person.roleTitle}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-text2">Supervisor (text — matched on relink)</span>
              <input
                name="supervisorName"
                type="text"
                defaultValue={editing.supervisorName ?? editing.supervisorFullName ?? ''}
                placeholder="e.g. Anuruddha Basnayake"
                className={inputClass}
              />
            </label>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={updateRow.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ color: 'var(--accent-fg)' }}
              >
                {updateRow.isPending ? 'Saving…' : 'Save supervisor'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  updateRow.reset();
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </SlideOverPanel>
      )}
    </div>
  );
}
