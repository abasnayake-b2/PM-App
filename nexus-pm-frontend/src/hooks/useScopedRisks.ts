import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProjectRisk,
  createReleaseRisk,
  deleteProjectRisk,
  deleteReleaseRisk,
  fetchProjectRisks,
  fetchReleaseRisks,
  updateProjectRisk,
  updateReleaseRisk,
  type RiskPayload,
} from '@/api/scopedRisks.api';

export function useProjectRisks(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['project-risks', projectId],
    queryFn: () => fetchProjectRisks(projectId!),
    enabled: !!projectId && enabled,
  });
}

export function useCreateProjectRisk(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RiskPayload) => createProjectRisk(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-risks', projectId] }),
  });
}

export function useUpdateProjectRisk(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RiskPayload }) =>
      updateProjectRisk(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-risks', projectId] }),
  });
}

export function useDeleteProjectRisk(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjectRisk(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-risks', projectId] }),
  });
}

export function useReleaseRisks(releaseId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['release-risks', releaseId],
    queryFn: () => fetchReleaseRisks(releaseId!),
    enabled: !!releaseId && enabled,
  });
}

export function useCreateReleaseRisk(releaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RiskPayload) => createReleaseRisk(releaseId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['release-risks', releaseId] }),
  });
}

export function useUpdateReleaseRisk(releaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RiskPayload }) =>
      updateReleaseRisk(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['release-risks', releaseId] }),
  });
}

export function useDeleteReleaseRisk(releaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReleaseRisk(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['release-risks', releaseId] }),
  });
}
