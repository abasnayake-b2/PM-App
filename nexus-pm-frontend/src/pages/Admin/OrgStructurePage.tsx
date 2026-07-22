import { useState } from 'react';
import { Network } from 'lucide-react';
import { ManagementOrgTree } from '@/components/ManagementOrgTree';
import { ManagementOrgChart } from '@/components/ManagementOrgChart';
import { OrgStructureStats } from '@/components/OrgStructureStats';
import { OrgStructureManagersTab } from '@/components/OrgStructureManagersTab';
import { OrgStructureEmployeesTab } from '@/components/OrgStructureEmployeesTab';
import { TeamManagementPanel } from '@/components/TeamManagementPanel';
import { TeamRosterMemberPanel } from '@/components/TeamRosterMemberPanel';
import type { TeamManagement, TeamRosterMember } from '@/api/teamRoster.api';

type Section = 'people' | 'chart' | 'stats' | 'managers' | 'employees';

export function OrgStructurePage() {
  const [section, setSection] = useState<Section>('people');
  const [selectedManager, setSelectedManager] = useState<TeamManagement | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamRosterMember | null>(null);

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
            <p className="mb-3 text-sm text-text2">Click a name to view their profile.</p>
            <ManagementOrgTree
              selectedId={selectedManager?.id ?? null}
              onSelectManager={(person) => {
                setSelectedMember(null);
                setSelectedManager(person);
              }}
              onSelectMember={(member) => {
                setSelectedManager(null);
                setSelectedMember(member);
              }}
            />
          </section>
        ) : section === 'chart' ? (
          <section className="min-w-0">
            <p className="mb-3 text-sm text-text2">
              Full org chart: C-level (CEO/COO/…) → VP → Manager → Engineers. Click a name to view
              their profile. Scroll horizontally and vertically to explore the tree.
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

      {selectedManager && (
        <TeamManagementPanel
          member={selectedManager}
          onClose={() => setSelectedManager(null)}
        />
      )}
      {selectedMember && (
        <TeamRosterMemberPanel
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
