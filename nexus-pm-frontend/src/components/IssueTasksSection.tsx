import type { TaskRecord } from '@/api/scopedTasks.api';
import { TasksSection } from '@/components/TasksSection';
import {
  useCreateIssueTask,
  useDeleteIssueTask,
  useIssueTasks,
  useUpdateIssueTask,
} from '@/hooks/useScopedTasks';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

export function IssueTasksSection({
  issueId,
  localRows,
  onLocalRowsChange,
  rdDisplayKey,
}: {
  issueId?: string;
  mode?: 'view' | 'edit';
  localRows?: TaskRecord[];
  onLocalRowsChange?: (rows: TaskRecord[]) => void;
  rdDisplayKey?: string;
}) {
  const { can } = usePermissions();
  const localMode = !issueId;
  const canManage = localMode || can(P.ISSUES_UPDATE);
  const { data: remoteTasks = [], isLoading: remoteLoading } = useIssueTasks(issueId);
  const createTask = useCreateIssueTask(issueId ?? '');
  const updateTask = useUpdateIssueTask(issueId ?? '');
  const deleteTask = useDeleteIssueTask(issueId ?? '');
  const tasks = localMode ? (localRows ?? []) : remoteTasks;

  return (
    <TasksSection
      title="Tasks"
      tasks={tasks}
      isLoading={localMode ? false : remoteLoading}
      canManage={canManage}
      createPending={createTask.isPending}
      updatePending={updateTask.isPending}
      deletePending={deleteTask.isPending}
      createError={createTask.error}
      updateError={updateTask.error}
      onResetCreate={() => createTask.reset()}
      onResetUpdate={() => updateTask.reset()}
      localMode={localMode}
      keyPrefix={rdDisplayKey}
      onCreate={(payload, onSuccess, localRow) => {
        if (localMode) {
          if (localRow) onLocalRowsChange?.([...(localRows ?? []), localRow]);
          onSuccess();
          return;
        }
        createTask.mutate(payload, { onSuccess });
      }}
      onUpdate={(id, payload, onSuccess) => {
        if (localMode) {
          onLocalRowsChange?.(
            (localRows ?? []).map((row) =>
              row.id === id
                ? {
                    ...row,
                    description: payload.description,
                    module: payload.clearModule ? undefined : (payload.module ?? row.module),
                  }
                : row,
            ),
          );
          onSuccess();
          return;
        }
        updateTask.mutate({ id, payload }, { onSuccess });
      }}
      onDelete={(id) => {
        if (localMode) {
          onLocalRowsChange?.((localRows ?? []).filter((row) => row.id !== id));
          return;
        }
        deleteTask.mutate(id);
      }}
    />
  );
}
