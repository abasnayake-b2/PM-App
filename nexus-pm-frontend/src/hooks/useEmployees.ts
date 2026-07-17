import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  fetchEmployees,
  fetchEmployee,
  fetchTeamSearch,
  createEmployee,
  updateEmployee,
  changeEmployeeRole,
  deleteEmployee,
  fetchDepartments,
  fetchDesignations,
  type CreateEmployeePayload,
  type UpdateEmployeePayload,
  type TeamSearchBy,
} from '@/api/users.api';

export type { CreateEmployeePayload, UpdateEmployeePayload, TeamSearchBy };

export function useEmployees(enabled = true) {
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => fetchEmployees(),
    enabled,
  });
}

export function useEmployeeList(search = '', enabled = true) {
  return useQuery({
    queryKey: ['employees', search],
    queryFn: () => fetchEmployees({ search: search || undefined }),
    enabled,
  });
}

export function useTeamSearch(search = '', searchBy: TeamSearchBy = 'EMPLOYEE', enabled = true) {
  return useQuery({
    queryKey: ['team-search', search, searchBy],
    queryFn: () => fetchTeamSearch(search, searchBy),
    enabled,
  });
}

export function useEmployee(id?: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => fetchEmployee(id!),
    enabled: !!id,
  });
}

export function useDepartments(enabled = true) {
  return useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled,
  });
}

export function useDesignations(enabled = true) {
  return useQuery({
    queryKey: ['designations'],
    queryFn: fetchDesignations,
    enabled,
  });
}

export function useCreateEmployee(options?: { navigateOnSuccess?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const navigateOnSuccess = options?.navigateOnSuccess !== false;
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: (employee) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['team-search'] });
      qc.invalidateQueries({ queryKey: ['capacity'] });
      if (navigateOnSuccess) {
        navigate(`/resources/${employee.id}`);
      }
    },
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateEmployeePayload) => updateEmployee(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['team-search'] });
      qc.invalidateQueries({ queryKey: ['employee', id] });
      qc.invalidateQueries({ queryKey: ['capacity'] });
    },
  });
}

export function useChangeEmployeeRole(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleCode: string) => changeEmployeeRole(id, roleCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['team-search'] });
      qc.invalidateQueries({ queryKey: ['employee', id] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['team-search'] });
      qc.invalidateQueries({ queryKey: ['capacity'] });
    },
  });
}
