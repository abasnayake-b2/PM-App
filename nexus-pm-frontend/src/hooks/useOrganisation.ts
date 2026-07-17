import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRegions,
  fetchCountries,
  fetchClients,
  fetchClient,
  createRegion,
  updateRegion,
  deleteRegion,
  restoreRegion,
  createCountry,
  updateCountry,
  deleteCountry,
  restoreCountry,
  createClient,
  updateClient,
  deleteClient,
  restoreClient,
} from '@/api/organisations.api';

function invalidateRegions(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['regions'] });
}

function invalidateCountries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['countries'] });
}

function invalidateClients(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['clients'] });
}

export function useRegions(includeDeleted = false, enabled = true) {
  return useQuery({
    queryKey: ['regions', includeDeleted],
    queryFn: () => fetchRegions(includeDeleted),
    enabled,
  });
}

export function useCountries(regionId?: string, enabled = true, includeDeleted = false) {
  return useQuery({
    queryKey: ['countries', regionId ?? 'all', includeDeleted],
    queryFn: () => fetchCountries(regionId, includeDeleted),
    enabled,
  });
}

export function useClients(countryId?: string, enabled = true, includeDeleted = false) {
  return useQuery({
    queryKey: ['clients', countryId ?? 'all', includeDeleted],
    queryFn: () => fetchClients(countryId ? { countryId, includeDeleted } : { includeDeleted }),
    enabled,
  });
}

export function useClient(id?: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id!),
    enabled: !!id,
  });
}

export function useCreateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRegion,
    onSuccess: () => invalidateRegions(qc),
  });
}

export function useUpdateRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name: string; code: string }) =>
      updateRegion(id, payload),
    onSuccess: () => invalidateRegions(qc),
  });
}

export function useDeleteRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRegion,
    onSuccess: () => {
      invalidateRegions(qc);
      invalidateCountries(qc);
      invalidateClients(qc);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useRestoreRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreRegion,
    onSuccess: () => {
      invalidateRegions(qc);
      invalidateCountries(qc);
      invalidateClients(qc);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useCreateCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCountry,
    onSuccess: (_, vars) => invalidateCountries(qc),
  });
}

export function useUpdateCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; regionId: string; name: string; code: string }) =>
      updateCountry(id, payload),
    onSuccess: () => invalidateCountries(qc),
  });
}

export function useDeleteCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCountry,
    onSuccess: () => {
      invalidateCountries(qc);
      invalidateClients(qc);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useRestoreCountry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreCountry,
    onSuccess: () => {
      invalidateCountries(qc);
      invalidateClients(qc);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createClient,
    onSuccess: () => invalidateClients(qc),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; countryId?: string; name: string }) =>
      updateClient(id, payload),
    onSuccess: () => invalidateClients(qc),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      invalidateClients(qc);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export function useRestoreClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreClient,
    onSuccess: () => {
      invalidateClients(qc);
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}
