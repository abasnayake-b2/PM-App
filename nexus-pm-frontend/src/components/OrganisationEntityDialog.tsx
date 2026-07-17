import { FormEvent } from 'react';
import type { Client, Country, Region } from '@/types';
import { SlideOverPanel } from '@/components/SlideOverPanel';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

export type OrgEntityKind = 'region' | 'country' | 'client';

export interface OrgEntityDialogState {
  kind: OrgEntityKind;
  mode: 'create' | 'edit';
  item?: Region | Country | Client;
}

interface OrganisationEntityDialogProps {
  state: OrgEntityDialogState;
  regions: Region[];
  regionId?: string;
  countryId?: string;
  loading?: boolean;
  error?: unknown;
  onClose: () => void;
  onSubmitRegion: (payload: { name: string; code: string }) => void;
  onSubmitCountry: (payload: { regionId: string; name: string; code: string }) => void;
  onSubmitClient: (payload: { countryId: string; name: string }) => void;
}

function apiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const data = (error as { response?: { data?: { detail?: string; title?: string; message?: string } } })
    .response?.data;
  return data?.detail ?? data?.title ?? data?.message ?? null;
}

export function OrganisationEntityDialog({
  state,
  regions,
  regionId,
  countryId,
  loading,
  error,
  onClose,
  onSubmitRegion,
  onSubmitCountry,
  onSubmitClient,
}: OrganisationEntityDialogProps) {
  const { kind, mode, item } = state;
  const title = mode === 'create' ? `Create ${kind}` : `Edit ${kind}`;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (kind === 'region') {
      onSubmitRegion({
        name: (fd.get('name') as string).trim(),
        code: (fd.get('code') as string).trim(),
      });
      return;
    }
    if (kind === 'country') {
      onSubmitCountry({
        regionId: (fd.get('regionId') as string) || regionId || '',
        name: (fd.get('name') as string).trim(),
        code: (fd.get('code') as string).trim(),
      });
      return;
    }
    onSubmitClient({
      countryId: (fd.get('countryId') as string) || countryId || '',
      name: (fd.get('name') as string).trim(),
    });
  };

  const country = kind === 'country' ? (item as Country | undefined) : undefined;
  const client = kind === 'client' ? (item as Client | undefined) : undefined;
  const region = kind === 'region' ? (item as Region | undefined) : undefined;

  return (
    <SlideOverPanel title={title} subtitle="Organisation" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {apiErrorMessage(error) && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {apiErrorMessage(error)}
          </p>
        )}

        {kind === 'country' && (
          <label className="block text-sm">
            <span className="text-text2">Region</span>
            <select
              name="regionId"
              required
              defaultValue={country?.regionId ?? regionId ?? ''}
              className={inputClass}
            >
              <option value="" disabled>
                Select region…
              </option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === 'client' && (
          <label className="block text-sm">
            <span className="text-text2">Country</span>
            <input
              name="countryId"
              type="hidden"
              defaultValue={client?.countryId ?? countryId ?? ''}
            />
            <input
              disabled
              value={client?.countryName ?? (countryId ? 'Selected country' : '')}
              className={`${inputClass} opacity-70`}
              placeholder="Selected from tree"
            />
            {!client?.countryId && !countryId && (
              <p className="mt-1 text-xs text-danger">Select a country in the tree first.</p>
            )}
          </label>
        )}

        <label className="block text-sm">
          <span className="text-text2">Name</span>
          <input
            name="name"
            required
            defaultValue={
              kind === 'region'
                ? region?.name
                : kind === 'country'
                  ? country?.name
                  : client?.name
            }
            className={inputClass}
          />
        </label>

        {(kind === 'region' || kind === 'country') && (
          <label className="block text-sm">
            <span className="text-text2">Code</span>
            <input
              name="code"
              required
              defaultValue={kind === 'region' ? region?.code : country?.code}
              className={inputClass}
            />
          </label>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || (kind === 'client' && !client?.countryId && !countryId)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ color: 'var(--accent-fg)' }}
          >
            {loading ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
          >
            Cancel
          </button>
        </div>
      </form>
    </SlideOverPanel>
  );
}
