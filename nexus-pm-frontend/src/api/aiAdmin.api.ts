import api from './axios';

export type AiToolCatalogItem = {
  id?: string;
  toolKey: string;
  displayName: string;
  description?: string;
  requiredPermission?: string;
  sortOrder?: number;
  apiPath?: string;
  updatedAt?: string;
};

export type AiProfile = {
  key: string;
  label: string;
  model: string;
  baseUrlHost: string;
};

export type AiSettings = {
  yamlEnabled: boolean;
  softEnabled: boolean;
  available: boolean;
  modelProfile: string;
  systemInstructions: string;
  maxToolsPerQuestion: number;
  rateLimitPerHour: number;
  allowedRoles: string;
  profiles: AiProfile[];
  activeProfile?: AiProfile;
};

export async function fetchAiToolsAvailable(): Promise<AiToolCatalogItem[]> {
  const { data } = await api.get<AiToolCatalogItem[]>('/admin/ai-tools/available');
  return data;
}

export async function fetchAiToolsActive(): Promise<AiToolCatalogItem[]> {
  const { data } = await api.get<AiToolCatalogItem[]>('/admin/ai-tools/active');
  return data;
}

export async function addAiTool(payload: {
  toolKey: string;
  displayName?: string;
  description?: string;
}): Promise<AiToolCatalogItem> {
  const { data } = await api.post<AiToolCatalogItem>('/admin/ai-tools/active', payload);
  return data;
}

export async function updateAiTool(
  id: string,
  payload: {
    displayName?: string;
    description?: string;
    requiredPermission?: string;
    sortOrder?: number;
  },
): Promise<AiToolCatalogItem> {
  const { data } = await api.put<AiToolCatalogItem>(`/admin/ai-tools/active/${id}`, payload);
  return data;
}

export async function removeAiTool(id: string): Promise<void> {
  await api.delete(`/admin/ai-tools/active/${id}`);
}

export async function fetchAiSettings(): Promise<AiSettings> {
  const { data } = await api.get<AiSettings>('/admin/ai-settings');
  return data;
}

export async function updateAiSettings(payload: {
  softEnabled?: boolean;
  modelProfile?: string;
  systemInstructions?: string;
  maxToolsPerQuestion?: number;
  rateLimitPerHour?: number;
  allowedRoles?: string;
}): Promise<AiSettings> {
  const { data } = await api.put<AiSettings>('/admin/ai-settings', payload);
  return data;
}
