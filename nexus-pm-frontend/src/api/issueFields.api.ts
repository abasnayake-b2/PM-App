import api from './axios';

export type IssueFieldDataType = 'TEXT' | 'NUMBER' | 'DATE' | 'YEAR' | 'DROPDOWN';

export interface IssueFieldDefinition {
  id: string;
  fieldKey: string;
  label: string;
  dataType: IssueFieldDataType | string;
  maxLength?: number | null;
  required: boolean;
  active: boolean;
  systemField: boolean;
  sectionCode?: string | null;
  displayOrder: number;
  options?: string[] | null;
  helpText?: string | null;
}

export interface CreateIssueFieldPayload {
  fieldKey?: string;
  label: string;
  dataType: string;
  maxLength?: number | null;
  required?: boolean;
  active?: boolean;
  sectionCode?: string | null;
  displayOrder?: number | null;
  options?: string[];
  helpText?: string | null;
}

export type UpdateIssueFieldPayload = CreateIssueFieldPayload;

/** Active definitions for RD create/edit forms. */
export async function fetchActiveIssueFields(): Promise<IssueFieldDefinition[]> {
  const { data } = await api.get<IssueFieldDefinition[]>('/issue-fields');
  return data;
}

/** All definitions for Admin (includes inactive). */
export async function fetchAdminIssueFields(): Promise<IssueFieldDefinition[]> {
  const { data } = await api.get<IssueFieldDefinition[]>('/admin/reference/issue-fields');
  return data;
}

export async function createAdminIssueField(
  payload: CreateIssueFieldPayload,
): Promise<IssueFieldDefinition> {
  const { data } = await api.post<IssueFieldDefinition>('/admin/reference/issue-fields', payload);
  return data;
}

export async function updateAdminIssueField(
  id: string,
  payload: UpdateIssueFieldPayload,
): Promise<IssueFieldDefinition> {
  const { data } = await api.put<IssueFieldDefinition>(
    `/admin/reference/issue-fields/${id}`,
    payload,
  );
  return data;
}

export async function deleteAdminIssueField(id: string): Promise<void> {
  await api.delete(`/admin/reference/issue-fields/${id}`);
}
