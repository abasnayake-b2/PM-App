import api from './axios';

export interface ReferenceItem {
  id: string;
  name?: string;
  label?: string;
  code?: string;
  workflowCode?: string;
  description?: string;
  sequence?: number;
  terminal?: boolean;
  colour?: string;
  level?: number;
  slaResponseHrs?: number;
  slaResolveHrs?: number;
  departmentId?: string;
  departmentName?: string;
  department?: { id: string; name: string };
  streamId?: string;
  streamName?: string;
  stream?: { id: string; name: string; department?: { id: string; name: string } };
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdByName?: string;
  updatedByName?: string;
}

const base = '/admin/reference';

export interface ReferenceDataImportResult {
  fileName: string;
  departmentsCreated: number;
  departmentsUpdated: number;
  departmentsSkipped: number;
  streamsCreated: number;
  streamsUpdated: number;
  streamsSkipped: number;
  designationsCreated: number;
  designationsUpdated: number;
  designationsSkipped: number;
  skillsCreated?: number;
  skillsUpdated?: number;
  skillsSkipped?: number;
  errors: string[];
  importedByName?: string;
  importedAt?: string;
}

export async function importAdminReferenceData(file: File): Promise<ReferenceDataImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ReferenceDataImportResult>(`${base}/import`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function importAdminSkillsData(file: File): Promise<ReferenceDataImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ReferenceDataImportResult>(`${base}/skills/import`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchAdminDepartments(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/departments`);
  return data;
}

export async function createAdminDepartment(name: string): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/departments`, { name });
  return data;
}

export async function updateAdminDepartment(id: string, name: string): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/departments/${id}`, { name });
  return data;
}

export async function deleteAdminDepartment(id: string): Promise<void> {
  await api.delete(`${base}/departments/${id}`);
}

export async function fetchAdminStreams(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/streams`);
  return data;
}

export async function createAdminStream(name: string, departmentId: string): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/streams`, { name, departmentId });
  return data;
}

export async function updateAdminStream(id: string, name: string, departmentId: string): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/streams/${id}`, { name, departmentId });
  return data;
}

export async function deleteAdminStream(id: string): Promise<void> {
  await api.delete(`${base}/streams/${id}`);
}

export async function fetchAdminDesignations(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/designations`);
  return data;
}

export async function createAdminDesignation(
  name: string,
  streamId: string,
  code?: string,
): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/designations`, { name, streamId, code });
  return data;
}

export async function updateAdminDesignation(
  id: string,
  name: string,
  streamId: string,
  code?: string,
): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/designations/${id}`, { name, streamId, code });
  return data;
}

export async function deleteAdminDesignation(id: string): Promise<void> {
  await api.delete(`${base}/designations/${id}`);
}

export async function fetchAdminWorkTypes(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/work-types`);
  return data;
}

export async function createAdminWorkType(name: string): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/work-types`, { name });
  return data;
}

export async function updateAdminWorkType(id: string, name: string): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/work-types/${id}`, { name });
  return data;
}

export async function deleteAdminWorkType(id: string): Promise<void> {
  await api.delete(`${base}/work-types/${id}`);
}

export async function fetchAdminSkills(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/skills`);
  return data;
}

export async function createAdminSkill(name: string, description?: string): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/skills`, { name, description });
  return data;
}

export async function updateAdminSkill(
  id: string,
  name: string,
  description?: string,
): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/skills/${id}`, { name, description });
  return data;
}

export async function deleteAdminSkill(id: string): Promise<void> {
  await api.delete(`${base}/skills/${id}`);
}

export async function fetchAdminRoles(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/roles`);
  return data;
}

export async function createAdminRole(name: string, code: string): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/roles`, { name, code });
  return data;
}

export async function updateAdminRole(id: string, name: string): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/roles/${id}`, { name });
  return data;
}

export async function deleteAdminRole(id: string): Promise<void> {
  await api.delete(`${base}/roles/${id}`);
}

export async function fetchAdminIssueTypes(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/issue-types`);
  return data;
}

export async function createAdminIssueType(payload: {
  name: string;
  workflowCode: string;
  description?: string;
}): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/issue-types`, payload);
  return data;
}

export async function updateAdminIssueType(
  id: string,
  payload: { name: string; workflowCode: string; description?: string },
): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/issue-types/${id}`, payload);
  return data;
}

export async function deleteAdminIssueType(id: string): Promise<void> {
  await api.delete(`${base}/issue-types/${id}`);
}

export async function fetchAdminStatuses(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/statuses`);
  return data;
}

export async function createAdminStatus(payload: {
  name: string;
  sequence: number;
  terminal: boolean;
  colour?: string;
}): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/statuses`, payload);
  return data;
}

export async function updateAdminStatus(
  id: string,
  payload: { name: string; sequence: number; terminal: boolean; colour?: string },
): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/statuses/${id}`, payload);
  return data;
}

export async function deleteAdminStatus(id: string): Promise<void> {
  await api.delete(`${base}/statuses/${id}`);
}

export async function fetchAdminPriorities(): Promise<ReferenceItem[]> {
  const { data } = await api.get<ReferenceItem[]>(`${base}/priorities`);
  return data;
}

export async function createAdminPriority(payload: {
  label: string;
  level: number;
  slaResponseHrs: number;
  slaResolveHrs: number;
  colour?: string;
}): Promise<ReferenceItem> {
  const { data } = await api.post<ReferenceItem>(`${base}/priorities`, payload);
  return data;
}

export async function updateAdminPriority(
  id: string,
  payload: {
    label: string;
    level: number;
    slaResponseHrs: number;
    slaResolveHrs: number;
    colour?: string;
  },
): Promise<ReferenceItem> {
  const { data } = await api.put<ReferenceItem>(`${base}/priorities/${id}`, payload);
  return data;
}

export async function deleteAdminPriority(id: string): Promise<void> {
  await api.delete(`${base}/priorities/${id}`);
}
