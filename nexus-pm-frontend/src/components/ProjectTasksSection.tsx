import { TasksSection } from '@/components/TasksSection';
import {
  useCreateProjectTask,
  useDeleteProjectTask,
  useProjectTasks,
  useUpdateProjectTask,
} from '@/hooks/useScopedTasks';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { projectTaskKeyPrefix } from '@/utils/issueUi';

export function ProjectTasksSection({
  projectId,
  projectKey,
}: {
  projectId: string;
  projectKey?: string;
}) {
  const { can } = usePermissions();
  const canManage = can(P.PROJECTS_UPDATE);
  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const createTask = useCreateProjectTask(projectId);
  const updateTask = useUpdateProjectTask(projectId);
  const deleteTask = useDeleteProjectTask(projectId);

  return (
    <TasksSection
      title="Project level tasks"
      tasks={tasks}
      isLoading={isLoading}
      canManage={canManage}
      createPending={createTask.isPending}
      updatePending={updateTask.isPending}
      deletePending={deleteTask.isPending}
      createError={createTask.error}
      updateError={updateTask.error}
      onResetCreate={() => createTask.reset()}
      onResetUpdate={() => updateTask.reset()}
      onCreate={(payload, onSuccess) => createTask.mutate(payload, { onSuccess })}
      onUpdate={(id, payload, onSuccess) =>
        updateTask.mutate({ id, payload }, { onSuccess })
      }
      onDelete={(id) => deleteTask.mutate(id)}
      keyPrefix={projectTaskKeyPrefix(projectKey)}
      keyStyle="project"
    />
  );
}
