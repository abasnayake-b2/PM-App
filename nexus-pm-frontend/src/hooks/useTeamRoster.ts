import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTeamManagement,
  fetchTeamRosterMembers,
  createTeamManagement,
  updateTeamManagement,
  deleteTeamManagement,
  uploadTeamManagementPhoto,
  deleteTeamManagementPhoto,
  createTeamRosterMember,
  updateTeamRosterMember,
  deleteTeamRosterMember,
  uploadTeamRosterMemberPhoto,
  deleteTeamRosterMemberPhoto,
  importTeamManagement,
  importTeamMembers,
  fetchLatestTeamManagementImport,
  fetchLatestTeamMembersImport,
  relinkManagementSupervisors,
  promoteEmployeeToManagement,
  demoteManagementToEmployee,
  type TeamManagementPayload,
  type TeamRosterMemberPayload,
  type PromoteEmployeeToManagementPayload,
  type DemoteManagementToEmployeePayload,
} from '@/api/teamRoster.api';

export function useTeamManagement(search = '', enabled = true) {
  return useQuery({
    queryKey: ['team-management', search],
    queryFn: () => fetchTeamManagement(search),
    enabled,
  });
}

export function useTeamRosterMembers(search = '', enabled = true) {
  return useQuery({
    queryKey: ['team-roster-members', search],
    queryFn: () => fetchTeamRosterMembers(search),
    enabled,
  });
}

export function useLatestTeamManagementImport(enabled = true) {
  return useQuery({
    queryKey: ['team-import-management-latest'],
    queryFn: fetchLatestTeamManagementImport,
    enabled,
  });
}

export function useLatestTeamMembersImport(enabled = true) {
  return useQuery({
    queryKey: ['team-import-members-latest'],
    queryFn: fetchLatestTeamMembersImport,
    enabled,
  });
}

export function useImportTeamManagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importTeamManagement,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-management'] });
      qc.invalidateQueries({ queryKey: ['team-import-management-latest'] });
    },
  });
}

export function useImportTeamMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importTeamMembers,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-roster-members'] });
      qc.invalidateQueries({ queryKey: ['team-import-members-latest'] });
    },
  });
}

export function useRelinkManagementSupervisors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: relinkManagementSupervisors,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-management'] });
    },
  });
}

export function useCreateTeamManagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTeamManagement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-management'] }),
  });
}

export function useUpdateTeamManagement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeamManagementPayload) => updateTeamManagement(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-management'] }),
  });
}

export function useDeleteTeamManagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTeamManagement,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-management'] }),
  });
}

export function useUploadTeamManagementPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadTeamManagementPhoto(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-management'] }),
  });
}

export function useDeleteTeamManagementPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteTeamManagementPhoto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-management'] }),
  });
}

export function useCreateTeamRosterMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTeamRosterMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-roster-members'] }),
  });
}

export function useUpdateTeamRosterMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeamRosterMemberPayload) => updateTeamRosterMember(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-roster-members'] }),
  });
}

export function useDeleteTeamRosterMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTeamRosterMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-roster-members'] }),
  });
}

export function useUploadTeamRosterMemberPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadTeamRosterMemberPhoto(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-roster-members'] }),
  });
}

export function useDeleteTeamRosterMemberPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteTeamRosterMemberPhoto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-roster-members'] }),
  });
}

export function usePromoteEmployeeToManagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      payload,
    }: {
      employeeId: string;
      payload: PromoteEmployeeToManagementPayload;
    }) => promoteEmployeeToManagement(employeeId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-roster-members'] });
      qc.invalidateQueries({ queryKey: ['team-management'] });
      qc.invalidateQueries({ queryKey: ['eligible-management'] });
      qc.invalidateQueries({ queryKey: ['eligible-employees'] });
      qc.invalidateQueries({ queryKey: ['user-accounts'] });
    },
  });
}

export function useDemoteManagementToEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      managementId,
      payload,
    }: {
      managementId: string;
      payload?: DemoteManagementToEmployeePayload;
    }) => demoteManagementToEmployee(managementId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-roster-members'] });
      qc.invalidateQueries({ queryKey: ['team-management'] });
      qc.invalidateQueries({ queryKey: ['eligible-management'] });
      qc.invalidateQueries({ queryKey: ['eligible-employees'] });
      qc.invalidateQueries({ queryKey: ['user-accounts'] });
    },
  });
}

export type {
  TeamManagementPayload,
  TeamRosterMemberPayload,
  PromoteEmployeeToManagementPayload,
  DemoteManagementToEmployeePayload,
};
