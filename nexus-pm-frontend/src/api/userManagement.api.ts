import api from './axios';

export interface UserAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  /** Primary role (most senior). */
  roleCode: string;
  /** All assigned application roles. */
  roleCodes?: string[];
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationName?: string;
  managerId?: string;
  managerName?: string;
  managementId?: string;
  managementRoleTitle?: string;
  managementFullName?: string;
  authActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string | null;
  accountLocked: boolean;
  /** Manager-only: when true, see org-wide data like a VP. */
  orgWideVisibility?: boolean;
}

export interface EligibleManagementOption {
  id: string;
  roleTitle: string;
  firstName: string;
  lastName: string;
  fullName: string;
  supervisorName?: string;
  supervisorFullName?: string;
  supervisorManagementId?: string;
  supervisorEmployeeId?: string;
  supervisorEmployeeName?: string;
  status: string;
}

export interface EligibleEmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationName?: string;
  managerId?: string;
  managerName?: string;
  engineeringManagerName?: string;
  managementId?: string;
  managementRoleTitle?: string;
  status: string;
}

export interface CreateUserAccountPayload {
  managementId?: string;
  employeeId?: string;
  email: string;
  password: string;
  /** @deprecated prefer roleCodes; kept for compatibility */
  roleCode?: string;
  roleCodes: string[];
  departmentId?: string;
  designationId?: string;
  managerId?: string;
  orgWideVisibility?: boolean;
}

export interface UpdateUserAccountPayload {
  email?: string;
  status?: string;
  /** @deprecated prefer roleCodes */
  roleCode?: string;
  roleCodes?: string[];
  departmentId?: string;
  designationId?: string;
  managerId?: string;
  password?: string;
  orgWideVisibility?: boolean;
}

const base = '/admin/users';

export async function fetchUserAccounts(search?: string): Promise<UserAccount[]> {
  const { data } = await api.get<UserAccount[]>(base, {
    params: { search: search || undefined },
  });
  return data;
}

export async function fetchEligibleManagement(search?: string): Promise<EligibleManagementOption[]> {
  const { data } = await api.get<EligibleManagementOption[]>(`${base}/eligible-management`, {
    params: { search: search || undefined },
  });
  return data;
}

export async function fetchEligibleEmployees(search?: string): Promise<EligibleEmployeeOption[]> {
  const { data } = await api.get<EligibleEmployeeOption[]>(`${base}/eligible-employees`, {
    params: { search: search || undefined },
  });
  return data;
}

export async function createUserAccount(payload: CreateUserAccountPayload): Promise<UserAccount> {
  const { data } = await api.post<UserAccount>(base, payload);
  return data;
}

export async function updateUserAccount(
  id: string,
  payload: UpdateUserAccountPayload,
): Promise<UserAccount> {
  const { data } = await api.put<UserAccount>(`${base}/${id}`, payload);
  return data;
}

export async function deleteUserAccount(id: string): Promise<void> {
  await api.delete(`${base}/${id}`);
}

export async function unlockUserAccount(id: string): Promise<UserAccount> {
  const { data } = await api.post<UserAccount>(`${base}/${id}/unlock`);
  return data;
}
