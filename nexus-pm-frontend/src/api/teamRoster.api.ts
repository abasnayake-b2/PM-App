import api from './axios';

export interface TeamManagement {
  id: string;
  roleTitle: string;
  firstName: string;
  lastName: string;
  fullName: string;
  supervisorName?: string;
  supervisorId?: string;
  supervisorFullName?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface TeamRosterMember {
  id: string;
  fullName: string;
  designationId?: string;
  designationCode?: string;
  designation?: string;
  streamId?: string;
  teamName?: string;
  engineeringManagerManagementId?: string;
  engineeringManagerName?: string;
  workTypeId?: string;
  workType?: string;
  countryId?: string;
  country?: string;
  product?: string;
  email?: string;
  phone?: string;
  /** Relative API path when set, e.g. /team-roster/members/{id}/photo */
  profilePictureUrl?: string | null;
  status: string;
  skillIds?: string[];
  skillNames?: string[];
  totalYearsOfExperience?: number | null;
  experienceInDfn?: number | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface ManagementUserProvisioned {
  managementId: string;
  fullName: string;
  email: string;
  roleCode: string;
  initialPassword: string;
}

export interface TeamImportResult {
  batchId: string;
  fileName: string;
  managementImported: number;
  membersImported: number;
  usersCreated?: number;
  provisionedUsers?: ManagementUserProvisioned[];
  importedByName?: string;
  importedAt?: string;
}

export interface TeamManagementPayload {
  roleTitle: string;
  firstName: string;
  lastName: string;
  supervisorName?: string;
  supervisorId?: string;
  status?: string;
}

export interface TeamRosterMemberPayload {
  fullName: string;
  designationId?: string;
  streamId?: string;
  engineeringManagerManagementId?: string;
  workTypeId?: string;
  countryId?: string;
  /** Legacy text fallbacks when IDs are unavailable. */
  designationCode?: string;
  designation?: string;
  teamName?: string;
  engineeringManagerName?: string;
  workType?: string;
  country?: string;
  product?: string;
  email?: string;
  phone?: string;
  status?: string;
  skillIds?: string[];
  totalYearsOfExperience?: number | null;
  experienceInDfn?: number | null;
}

export async function fetchTeamManagement(search?: string): Promise<TeamManagement[]> {
  const { data } = await api.get<TeamManagement[]>('/team-roster/management', {
    params: { search: search || undefined },
  });
  return data;
}

export async function createTeamManagement(payload: TeamManagementPayload): Promise<TeamManagement> {
  const { data } = await api.post<TeamManagement>('/team-roster/management', payload);
  return data;
}

export async function updateTeamManagement(
  id: string,
  payload: TeamManagementPayload,
): Promise<TeamManagement> {
  const { data } = await api.put<TeamManagement>(`/team-roster/management/${id}`, payload);
  return data;
}

export async function deleteTeamManagement(id: string): Promise<void> {
  await api.delete(`/team-roster/management/${id}`);
}

export async function fetchTeamRosterMembers(search?: string): Promise<TeamRosterMember[]> {
  const { data } = await api.get<TeamRosterMember[]>('/team-roster/members', {
    params: { search: search || undefined },
  });
  return data;
}

export async function fetchEngineeringManagers(): Promise<string[]> {
  const { data } = await api.get<string[]>('/team-roster/members/engineering-managers');
  return data;
}

export async function createTeamRosterMember(
  payload: TeamRosterMemberPayload,
): Promise<TeamRosterMember> {
  const { data } = await api.post<TeamRosterMember>('/team-roster/members', payload);
  return data;
}

export async function updateTeamRosterMember(
  id: string,
  payload: TeamRosterMemberPayload,
): Promise<TeamRosterMember> {
  const { data } = await api.put<TeamRosterMember>(`/team-roster/members/${id}`, payload);
  return data;
}

export async function deleteTeamRosterMember(id: string): Promise<void> {
  await api.delete(`/team-roster/members/${id}`);
}

export async function uploadTeamRosterMemberPhoto(
  id: string,
  file: File,
): Promise<TeamRosterMember> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<TeamRosterMember>(`/team-roster/members/${id}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteTeamRosterMemberPhoto(id: string): Promise<TeamRosterMember> {
  const { data } = await api.delete<TeamRosterMember>(`/team-roster/members/${id}/photo`);
  return data;
}

export async function importTeamManagement(file: File): Promise<TeamImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<TeamImportResult>('/team-roster/import/management', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function importTeamMembers(file: File): Promise<TeamImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<TeamImportResult>('/team-roster/import/members', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchLatestTeamManagementImport(): Promise<TeamImportResult | null> {
  const { data } = await api.get<TeamImportResult | null>('/team-roster/import/management/latest');
  return data;
}

export async function fetchLatestTeamMembersImport(): Promise<TeamImportResult | null> {
  const { data } = await api.get<TeamImportResult | null>('/team-roster/import/members/latest');
  return data;
}

export interface RelinkSupervisorsResult {
  totalRecords: number;
  linkedCount: number;
  unresolvedCount: number;
}

export async function relinkManagementSupervisors(): Promise<RelinkSupervisorsResult> {
  const { data } = await api.post<RelinkSupervisorsResult>('/team-roster/management/relink-supervisors');
  return data;
}
