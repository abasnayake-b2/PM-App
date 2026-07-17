import api from './axios';

export interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  action: string;
}

export interface RoleAccessItem {
  id: string;
  name: string;
  code: string;
  systemRole: boolean;
  permissionsEditable: boolean;
  deletable: boolean;
  permissionCodes: string[];
}

const base = '/admin/access';

export async function fetchAccessPermissions(): Promise<PermissionItem[]> {
  const { data } = await api.get<PermissionItem[]>(`${base}/permissions`);
  return data;
}

export async function fetchAccessRoles(): Promise<RoleAccessItem[]> {
  const { data } = await api.get<RoleAccessItem[]>(`${base}/roles`);
  return data;
}

export async function updateRolePermissions(roleId: string, permissionCodes: string[]): Promise<RoleAccessItem> {
  const { data } = await api.put<RoleAccessItem>(`${base}/roles/${roleId}/permissions`, { permissionCodes });
  return data;
}

export async function createAccessRole(payload: {
  name: string;
  code: string;
  permissionCodes?: string[];
}): Promise<RoleAccessItem> {
  const { data } = await api.post<RoleAccessItem>(`${base}/roles`, payload);
  return data;
}

export async function deleteAccessRole(roleId: string): Promise<void> {
  await api.delete(`${base}/roles/${roleId}`);
}
