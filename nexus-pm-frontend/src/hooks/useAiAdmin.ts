import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addAiTool,
  fetchAiSettings,
  fetchAiToolsActive,
  fetchAiToolsAvailable,
  removeAiTool,
  updateAiSettings,
  updateAiTool,
} from '@/api/aiAdmin.api';

export function useAiToolsAvailable(enabled = true) {
  return useQuery({
    queryKey: ['admin-ai-tools-available'],
    queryFn: fetchAiToolsAvailable,
    enabled,
  });
}

export function useAiToolsActive(enabled = true) {
  return useQuery({
    queryKey: ['admin-ai-tools-active'],
    queryFn: fetchAiToolsActive,
    enabled,
  });
}

export function useAddAiTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addAiTool,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-tools-available'] });
      qc.invalidateQueries({ queryKey: ['admin-ai-tools-active'] });
    },
  });
}

export function useUpdateAiTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      displayName?: string;
      description?: string;
      requiredPermission?: string;
      sortOrder?: number;
    }) => updateAiTool(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-tools-active'] });
    },
  });
}

export function useRemoveAiTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeAiTool,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-tools-available'] });
      qc.invalidateQueries({ queryKey: ['admin-ai-tools-active'] });
    },
  });
}

export function useAiSettings(enabled = true) {
  return useQuery({
    queryKey: ['admin-ai-settings'],
    queryFn: fetchAiSettings,
    enabled,
  });
}

export function useUpdateAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAiSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-settings'] });
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });
}
