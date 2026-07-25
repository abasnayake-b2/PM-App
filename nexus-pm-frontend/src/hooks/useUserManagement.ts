import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUserAccount,
  deleteUserAccount,
  fetchEligibleEmployees,
  fetchEligibleManagement,
  fetchUserAccounts,
  unlockUserAccount,
  updateUserAccount,
  type CreateUserAccountPayload,
  type UpdateUserAccountPayload,
} from '@/api/userManagement.api';

export function useUserAccounts(search = '') {
  return useQuery({
    queryKey: ['user-accounts', search],
    queryFn: () => fetchUserAccounts(search || undefined),
  });
}

export function useEligibleManagement(search = '', enabled = true) {
  return useQuery({
    queryKey: ['eligible-management', search],
    queryFn: () => fetchEligibleManagement(search || undefined),
    enabled,
  });
}

export function useEligibleEmployees(search = '', enabled = true) {
  return useQuery({
    queryKey: ['eligible-employees', search],
    queryFn: () => fetchEligibleEmployees(search || undefined),
    enabled,
  });
}

export function useCreateUserAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserAccountPayload) => createUserAccount(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-accounts'] });
      qc.invalidateQueries({ queryKey: ['eligible-management'] });
      qc.invalidateQueries({ queryKey: ['eligible-employees'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['team-roster-members'] });
    },
  });
}

export function useUpdateUserAccount(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateUserAccountPayload) => updateUserAccount(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-accounts'] });
      qc.invalidateQueries({ queryKey: ['employee', id] });
      qc.invalidateQueries({ queryKey: ['team-roster-members'] });
      qc.invalidateQueries({ queryKey: ['team-management'] });
      qc.invalidateQueries({ queryKey: ['eligible-management'] });
      qc.invalidateQueries({ queryKey: ['eligible-employees'] });
    },
  });
}

export function useDeleteUserAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteUserAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-accounts'] });
      qc.invalidateQueries({ queryKey: ['eligible-management'] });
    },
  });
}

export function useUnlockUserAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: unlockUserAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-accounts'] });
    },
  });
}
