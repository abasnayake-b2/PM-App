import { RisksSection } from '@/components/RisksSection';
import {
  useCreateReleaseRisk,
  useDeleteReleaseRisk,
  useReleaseRisks,
  useUpdateReleaseRisk,
} from '@/hooks/useScopedRisks';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

export function ReleaseRisksSection({ releaseId }: { releaseId: string }) {
  const { can } = usePermissions();
  const canManage = can(P.PROJECTS_UPDATE) || can(P.RELEASES_CREATE);
  const { data: risks = [], isLoading } = useReleaseRisks(releaseId);
  const createRisk = useCreateReleaseRisk(releaseId);
  const updateRisk = useUpdateReleaseRisk(releaseId);
  const deleteRisk = useDeleteReleaseRisk(releaseId);

  return (
    <RisksSection
      title="Release risks"
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
