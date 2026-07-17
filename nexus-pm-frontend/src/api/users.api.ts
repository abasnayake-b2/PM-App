import api from './axios';
import type { Employee, PageResponse } from '@/types';

export interface Department {
  id: string;
  name: string;
}

export interface Designation {
  id: string;
  name: string;
  code?: string;
  departmentId?: string;
  departmentName?: string;
  streamId?: string;
  streamName?: string;
}

export interface RoleOption {
  id: string;
  name: string;
  code: string;
}

export interface CreateEmployeePayload {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  roleCode: string;
  departmentId?: string;
  designationId?: string;
  managerId?: string;
}

export interface UpdateEmployeePayload {
  firstName: string;
  lastName: string;
  status?: string;
  roleCode?: string;
  departmentId?: string;
  designationId?: string;
  managerId?: string;
  password?: string;
}

export interface EmployeeListParams {
  search?: string;
}

export type TeamSearchBy = 'EMPLOYEE' | 'MANAGER' | 'VP';

export interface TeamManagerGroup {
  managerId: string;
  managerName: string;
  manager: Employee;
  members: Employee[];
}

export interface TeamSearchResponse {
  searchBy: TeamSearchBy;
  matchedLeaderName?: string;
  employees?: Employee[];
  groups?: TeamManagerGroup[];
}

export async function fetchEmployees(params?: EmployeeListParams): Promise<Employee[]> {
  const { data } = await api.get<PageResponse<Employee>>('/users', {
    params: {
      size: 200,
      search: params?.search || undefined,
    },
  });
  return data.content;
}

export async function fetchTeamSearch(
  search: string,
  searchBy: TeamSearchBy,
): Promise<TeamSearchResponse> {
  const { data } = await api.get<TeamSearchResponse>('/users/team-search', {
    params: {
      search: search || undefined,
      searchBy,
    },
  });
  return data;
}

export async function fetchEmployee(id: string): Promise<Employee> {
  const { data } = await api.get<Employee>(`/users/${id}`);
  return data;
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
  const { data } = await api.post<Employee>('/users', payload);
  return data;
}

export async function updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<Employee> {
  const { data } = await api.put<Employee>(`/users/${id}`, payload);
  return data;
}

export async function changeEmployeeRole(id: string, roleCode: string): Promise<Employee> {
  const { data } = await api.patch<Employee>(`/users/${id}/role`, { roleCode });
  return data;
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await api.get<Department[]>('/departments');
  return data;
}

export async function fetchDesignations(): Promise<Designation[]> {
  const { data } = await api.get<Designation[]>('/designations');
  return data;
}

export async function fetchAssignableRoles(): Promise<RoleOption[]> {
  const { data } = await api.get<RoleOption[]>('/users/roles');
  return data;
}
