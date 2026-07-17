import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderKanban } from 'lucide-react';
import { ProjectForm } from '@/components/ProjectForm';
import { fetchTeamManagement, fetchTeamRosterMembers } from '@/api/teamRoster.api';
import { useCreateProject } from '@/hooks/useProjects';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { filterEngineeringManagerOptions } from '@/utils/managementRoles';
import type { CreateProjectPayload } from '@/hooks/useProjects';

export function ProjectCreatePage() {
  const [searchParams] = useSearchParams();
  const { can } = usePermissions();
  const canCreate = can(P.PROJECTS_CREATE);
  const createProject = useCreateProject();

  const initialHierarchy = {
    regionId: searchParams.get('regionId') ?? '',
    countryId: searchParams.get('countryId') ?? '',
    clientId: searchParams.get('clientId') ?? '',
  };

  const { data: rosterMembers } = useQuery({
    queryKey: ['team-roster-members'],
    queryFn: () => fetchTeamRosterMembers(),
    enabled: canCreate,
  });

  const { data: management } = useQuery({
    queryKey: ['team-management'],
    queryFn: () => fetchTeamManagement(),
    enabled: canCreate,
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

  if (!canCreate) {
    return <Navigate to="/projects" replace />;
  }

  return (
    <div>
      <Link to="/projects" className="text-sm text-accent hover:underline">
        ← Back to projects
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <FolderKanban className="text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">New project</h1>
          <p className="text-text2">Create a project for a client</p>
        </div>
      </div>

      <div className="mt-8 max-w-2xl">
        <ProjectForm
          mode="create"
          rosterEmployees={rosterEmployees}
          engineeringManagerOptions={engineeringManagerOptions}
          initialHierarchy={initialHierarchy}
          loading={createProject.isPending}
          onCancel={() => window.history.back()}
          onSubmit={(payload) => createProject.mutate(payload as CreateProjectPayload)}
        />
      </div>
    </div>
  );
}
