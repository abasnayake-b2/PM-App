import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  fetchProjects,
  fetchProject,
  fetchProjectHealthLog,
  fetchReleases,
  createRelease,
  createProject,
  updateProject,
  archiveProject,
  deleteProject,
  restoreProject,
  updateProjectRag,
  importProjects,
  type CreateProjectPayload,
  type CreateReleasePayload,
  type UpdateProjectPayload,
} from '@/api/projects.api';

export function useProjects(
  params: {
    clientId?: string;
    regionId?: string;
    countryId?: string;
    ragStatus?: string;
    vpManagementId?: string;
    engineeringManagerManagementId?: string;
    includeArchived?: boolean;
    size?: number;
  } = {},
) {
  const { size = 500, ...rest } = params;
  return useQuery({
    queryKey: ['projects', { ...rest, size }],
    queryFn: () => fetchProjects({ ...rest, size }),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });
}

export function useProjectHealthLog(id: string | undefined) {
  return useQuery({
    queryKey: ['project-health', id],
    queryFn: () => fetchProjectHealthLog(id!),
    enabled: !!id,
  });
}

export function useProjectReleases(projectId: string | undefined) {
  return useQuery({
    queryKey: ['releases', projectId],
    queryFn: () => fetchReleases(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateRelease(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CreateReleasePayload, 'projectId'>) =>
      createRelease({ ...payload, projectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['releases', projectId] });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate(`/projects/${project.id}`);
    },
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProjectPayload) => updateProject(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => archiveProject(id, archived),
    onSuccess: (_, { id, archived }) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      if (archived) {
        navigate('/projects');
      }
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['dashboard-overview'] });
      navigate('/projects');
    },
  });
}

export function useRestoreProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreProject,
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', project.id] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useUpdateProjectRag(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ragStatus, notes }: { ragStatus: string; notes?: string }) =>
      updateProjectRag(id, ragStatus, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['project-health', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });
}

export function useImportProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importProjects,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['regions'] });
      qc.invalidateQueries({ queryKey: ['countries'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });
}

export type { CreateProjectPayload, CreateReleasePayload, UpdateProjectPayload };
