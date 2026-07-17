import api from './axios';
import type { Client, Country, Region } from '@/types';

export async function fetchRegions(includeDeleted = false): Promise<Region[]> {
  const { data } = await api.get<Region[]>('/regions', { params: { includeDeleted } });
  return data;
}

export async function createRegion(payload: { name: string; code: string }): Promise<Region> {
  const { data } = await api.post<Region>('/regions', payload);
  return data;
}

export async function updateRegion(id: string, payload: { name: string; code: string }): Promise<Region> {
  const { data } = await api.put<Region>(`/regions/${id}`, payload);
  return data;
}

export async function deleteRegion(id: string): Promise<void> {
  await api.delete(`/regions/${id}`);
}

export async function restoreRegion(id: string): Promise<Region> {
  const { data } = await api.patch<Region>(`/regions/${id}/restore`);
  return data;
}

export async function fetchCountries(regionId?: string, includeDeleted = false): Promise<Country[]> {
  const { data } = await api.get<Country[]>('/countries', {
    params: { regionId, includeDeleted },
  });
  return data;
}

export async function createCountry(payload: {
  regionId: string;
  name: string;
  code: string;
}): Promise<Country> {
  const { data } = await api.post<Country>('/countries', payload);
  return data;
}

export async function updateCountry(
  id: string,
  payload: { regionId: string; name: string; code: string },
): Promise<Country> {
  const { data } = await api.put<Country>(`/countries/${id}`, payload);
  return data;
}

export async function deleteCountry(id: string): Promise<void> {
  await api.delete(`/countries/${id}`);
}

export async function restoreCountry(id: string): Promise<Country> {
  const { data } = await api.patch<Country>(`/countries/${id}/restore`);
  return data;
}

export async function fetchClients(
  params: { countryId?: string; status?: string; includeDeleted?: boolean } = {},
): Promise<Client[]> {
  const { data } = await api.get<Client[]>('/clients', {
    params: { status: 'ACTIVE', ...params },
  });
  return data;
}

export async function fetchClient(id: string): Promise<Client> {
  const { data } = await api.get<Client>(`/clients/${id}`);
  return data;
}

export async function createClient(payload: { countryId: string; name: string }): Promise<Client> {
  const { data } = await api.post<Client>('/clients', payload);
  return data;
}

export async function updateClient(
  id: string,
  payload: { countryId?: string; name: string },
): Promise<Client> {
  const { data } = await api.put<Client>(`/clients/${id}`, payload);
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/clients/${id}`);
}

export async function restoreClient(id: string): Promise<Client> {
  const { data } = await api.patch<Client>(`/clients/${id}/restore`);
  return data;
}
