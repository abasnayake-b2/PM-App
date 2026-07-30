import { RisksSection } from '@/components/RisksSection';
import {
  useCreateProjectRisk,
  useDeleteProjectRisk,
  useProjectRisks,
  useUpdateProjectRisk,
} from '@/hooks/useScopedRisks';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

export function ProjectRisksSection({ projectId }: { projectId: string }) {
  const { can } = usePermissions();
  const canManage = can(P.PROJECTS_UPDATE);
  const { data: risks = [], isLoading } = useProjectRisks(projectId);
  const createRisk = useCreateProjectRisk(projectId);
  const updateRisk = useUpdateProjectRisk(projectId);
  const deleteRisk = useDeleteProjectRisk(projectId);

  return (
    <RisksSection
      title="Project risks"
      risks={risks}
      isLoading={isLoading}
      canManage={canManage}
      createPending={createRisk.isPending}
      updatePending={updateRisk.isPending}
      deletePending={deleteRisk.isPending}
      createError={createRisk.error}
      updateError={updateRisk.error}
      onResetCreate={() => createRisk.reset()}
      onResetUpdate={() => updateRisk.reset()}
      onCreate={(payload, onSuccess) => createRisk.mutate(payload, { onSuccess })}
      onUpdate={(id, payload, onSuccess) =>
        updateRisk.mutate({ id, payload }, { onSuccess })
      }
      onDelete={(id) => deleteRisk.mutate(id)}
    />
  );
}
