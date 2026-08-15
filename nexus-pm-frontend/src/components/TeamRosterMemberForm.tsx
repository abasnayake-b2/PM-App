import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { fetchCountries } from '@/api/organisations.api';
import {
  fetchRosterDesignations,
  fetchRosterSkills,
  fetchRosterStreams,
  fetchRosterWorkTypes,
} from '@/api/rosterLookups.api';
import { fetchTeamManagement } from '@/api/teamRoster.api';
import type { TeamRosterMember, TeamRosterMemberPayload } from '@/api/teamRoster.api';
import { CheckboxMultiSelect } from '@/components/CheckboxMultiSelect';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import {
  useDeleteTeamRosterMemberPhoto,
  useUploadTeamRosterMemberPhoto,
} from '@/hooks/useTeamRoster';
import { EMPLOYMENT_TYPE_OPTIONS } from '@/utils/employmentType';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

const selectClass = inputClass;

const RAW_PREFIX = '__raw__:';

function norm(s?: string | null) {
  return (s ?? '').trim().toLowerCase();
}

function isRawId(id: string) {
  return id.startsWith(RAW_PREFIX);
}

function rawDesignationId(code?: string, name?: string) {
  return `${RAW_PREFIX}designation:${code ?? ''}|${name ?? ''}`;
}

function parseRawDesignationId(id: string): { code?: string; name?: string } | null {
  if (!id.startsWith(`${RAW_PREFIX}designation:`)) return null;
  const [code, name] = id.slice(`${RAW_PREFIX}designation:`.length).split('|');
  return { code: code || undefined, name: name || undefined };
}

function rawCountryId(value: string) {
  return `${RAW_PREFIX}country:${value}`;
}

function parseRawCountryId(id: string): string | null {
  if (!id.startsWith(`${RAW_PREFIX}country:`)) return null;
  return id.slice(`${RAW_PREFIX}country:`.length) || null;
}

function resolveDesignationId(
  initial: TeamRosterMember | undefined,
  designations: { id: string; name: string; code?: string }[],
) {
  if (!initial) return '';
  if (initial.designationId) return initial.designationId;
  const code = norm(initial.designationCode);
  const name = norm(initial.designation);
  const match = designations.find(
    (d) => (code && norm(d.code) === code) || (name && norm(d.name) === name),
  );
  if (match) return match.id;
  if (initial.designationCode || initial.designation) {
    return rawDesignationId(initial.designationCode, initial.designation);
  }
  return '';
}

function resolveStreamId(initial: TeamRosterMember | undefined, streams: { id: string; name: string }[]) {
  if (!initial) return '';
  if (initial.streamId) return initial.streamId;
  if (!initial.teamName) return '';
  const team = norm(initial.teamName);
  return streams.find((s) => norm(s.name) === team)?.id ?? '';
}

function resolveWorkTypeId(initial: TeamRosterMember | undefined, workTypes: { id: string; name: string }[]) {
  if (!initial) return '';
  if (initial.workTypeId) return initial.workTypeId;
  if (!initial.workType) return '';
  const workType = norm(initial.workType);
  return workTypes.find((w) => norm(w.name) === workType)?.id ?? '';
}

function resolveCountryId(
  initial: TeamRosterMember | undefined,
  countries: { id: string; name: string; code?: string }[],
) {
  if (!initial) return '';
  if (initial.countryId) return initial.countryId;
  if (!initial.country) return '';
  const value = norm(initial.country);
  const match = countries.find((c) => norm(c.name) === value || norm(c.code) === value);
  if (match) return match.id;
  return rawCountryId(initial.country.trim());
}

function resolveEmManagementId(
  initial: TeamRosterMember | undefined,
  managers: { id: string; fullName: string }[],
) {
  if (!initial) return '';
  if (initial.engineeringManagerManagementId) return initial.engineeringManagerManagementId;
  if (!initial.engineeringManagerName) return '';
  const em = initial.engineeringManagerName.trim();
  const exact = managers.find((m) => m.fullName === em);
  if (exact) return exact.id;
  const normalized = norm(em);
  const fuzzy = managers.find((m) => {
    const full = norm(m.fullName);
    return full === normalized || full.includes(normalized) || normalized.includes(full);
  });
  return fuzzy?.id ?? '';
}

export function TeamRosterMemberForm({
  initial,
  loading,
  lockName = false,
  onCancel,
  onSubmit,
}: {
  initial?: TeamRosterMember;
  loading?: boolean;
  /** When true, name cannot be changed (e.g. Org structure Engineers edit). */
  lockName?: boolean;
  onCancel: () => void;
  onSubmit: (payload: TeamRosterMemberPayload) => void;
}) {
  const { data: designations = [] } = useQuery({
    queryKey: ['roster-designations'],
    queryFn: fetchRosterDesignations,
  });
  const { data: streams = [] } = useQuery({
    queryKey: ['roster-streams'],
    queryFn: fetchRosterStreams,
  });
  const { data: workTypes = [] } = useQuery({
    queryKey: ['roster-work-types'],
    queryFn: fetchRosterWorkTypes,
  });
  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetchCountries(),
  });
  const { data: managers = [] } = useQuery({
    queryKey: ['team-management'],
    queryFn: () => fetchTeamManagement(),
  });
  const { data: skills = [] } = useQuery({
    queryKey: ['roster-skills'],
    queryFn: fetchRosterSkills,
  });

  const emOptions = useMemo(() => {
    const options = [...managers].sort((a, b) => a.fullName.localeCompare(b.fullName));
    if (
      initial?.engineeringManagerManagementId &&
      !options.some((m) => m.id === initial.engineeringManagerManagementId)
    ) {
      options.unshift({
        id: initial.engineeringManagerManagementId,
        fullName: initial.engineeringManagerName ?? 'Imported manager',
        roleTitle: '',
        firstName: '',
        lastName: '',
        status: 'ACTIVE',
      });
    }
    return options;
  }, [managers, initial]);

  const designationOptions = useMemo(() => {
    const id = resolveDesignationId(initial, designations);
    if (!isRawId(id) || !initial) return designations;
    const parsed = parseRawDesignationId(id);
    if (!parsed) return designations;
    return [
      {
        id,
        name: parsed.name || parsed.code || initial.designationCode || 'Imported designation',
        code: parsed.code,
      },
      ...designations,
    ];
  }, [designations, initial]);

  const countryOptions = useMemo(() => {
    const id = resolveCountryId(initial, countries);
    if (!isRawId(id) || !initial?.country) return countries;
    return [
      {
        id,
        name: initial.country,
        code: initial.country,
        regionId: '',
      },
      ...countries,
    ];
  }, [countries, initial]);

  const [designationId, setDesignationId] = useState(() => resolveDesignationId(initial, designations));
  const [streamId, setStreamId] = useState(() => resolveStreamId(initial, streams));
  const [workTypeId, setWorkTypeId] = useState(() => resolveWorkTypeId(initial, workTypes));
  const [countryId, setCountryId] = useState(() => resolveCountryId(initial, countries));
  const [emManagementId, setEmManagementId] = useState(() => resolveEmManagementId(initial, managers));
  const [skillIds, setSkillIds] = useState<string[]>(() => initial?.skillIds ?? []);
  const [pictureUrl, setPictureUrl] = useState<string | null | undefined>(initial?.profilePictureUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberId = initial?.id ?? '';
  const uploadPhoto = useUploadTeamRosterMemberPhoto(memberId);
  const deletePhoto = useDeleteTeamRosterMemberPhoto(memberId);

  useEffect(() => {
    setDesignationId(resolveDesignationId(initial, designations));
  }, [designations, initial]);

  useEffect(() => {
    setStreamId(resolveStreamId(initial, streams));
  }, [streams, initial]);

  useEffect(() => {
    setWorkTypeId(resolveWorkTypeId(initial, workTypes));
  }, [workTypes, initial]);

  useEffect(() => {
    setCountryId(resolveCountryId(initial, countries));
  }, [countries, initial]);

  useEffect(() => {
    setEmManagementId(resolveEmManagementId(initial, managers));
  }, [managers, initial]);

  useEffect(() => {
    setSkillIds(initial?.skillIds ?? []);
  }, [initial]);

  useEffect(() => {
    setPictureUrl(initial?.profilePictureUrl);
    setPhotoError(null);
  }, [initial?.id, initial?.profilePictureUrl]);

  const parseYears = (raw: FormDataEntryValue | null): number | null | undefined => {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (name: string) => {
      const v = (fd.get(name) as string)?.trim();
      return v || undefined;
    };

    const designation = designationOptions.find((d) => d.id === designationId);
    const parsedDesignation = parseRawDesignationId(designationId);
    const stream = streams.find((s) => s.id === streamId);
    const workType = workTypes.find((w) => w.id === workTypeId);
    const country = countryOptions.find((c) => c.id === countryId);
    const rawCountry = parseRawCountryId(countryId);
    const emManager = emOptions.find((m) => m.id === emManagementId);
    const totalYearsOfExperience = parseYears(fd.get('totalYearsOfExperience'));
    const experienceInDfn = parseYears(fd.get('experienceInDfn'));
    if (totalYearsOfExperience === undefined || experienceInDfn === undefined) {
      return;
    }

    onSubmit({
      fullName: lockName
        ? (initial?.fullName ?? '').trim()
        : (fd.get('fullName') as string).trim(),
      designationId: !isRawId(designationId) ? designationId || undefined : undefined,
      streamId: streamId || undefined,
      engineeringManagerManagementId: emManagementId || undefined,
      workTypeId: workTypeId || undefined,
      countryId: !isRawId(countryId) ? countryId || undefined : undefined,
      designationCode: designation?.code ?? parsedDesignation?.code ?? str('designationCode'),
      designation: designation?.name ?? parsedDesignation?.name ?? str('designation'),
      teamName: stream?.name ?? str('teamName'),
      engineeringManagerName: emManager?.fullName ?? str('engineeringManagerName'),
      workType: workType?.name ?? str('workType'),
      country: country?.name ?? rawCountry ?? str('country'),
      product: str('product'),
      email: str('email'),
      phone: str('phone'),
      status: (fd.get('status') as string) || 'ACTIVE',
      employmentType: str('employmentType'),
      skillIds,
      totalYearsOfExperience,
      experienceInDfn,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {memberId ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-bg3 p-3">
          <ResourceAvatar
            name={initial?.fullName ?? 'Employee'}
            size="lg"
            imageUrl={pictureUrl}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">Profile picture</p>
            <p className="text-xs text-text2">JPG, PNG, WEBP or GIF · max 2 MB</p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setPhotoError(null);
                  uploadPhoto.mutate(file, {
                    onSuccess: (member) => setPictureUrl(member.profilePictureUrl),
                    onError: (err) => {
                      setPhotoError(
                        isAxiosError(err)
                          ? ((err.response?.data as { detail?: string })?.detail ??
                            'Failed to upload picture.')
                          : 'Failed to upload picture.',
                      );
                    },
                  });
                }}
              />
              <button
                type="button"
                disabled={uploadPhoto.isPending || deletePhoto.isPending}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ color: 'var(--accent-fg)' }}
              >
                {uploadPhoto.isPending
                  ? 'Uploading…'
                  : pictureUrl
                    ? 'Update picture'
                    : 'Add picture'}
              </button>
              {pictureUrl && (
                <button
                  type="button"
                  disabled={uploadPhoto.isPending || deletePhoto.isPending}
                  onClick={() => {
                    setPhotoError(null);
                    deletePhoto.mutate(undefined, {
                      onSuccess: () => setPictureUrl(null),
                      onError: (err) => {
                        setPhotoError(
                          isAxiosError(err)
                            ? ((err.response?.data as { detail?: string })?.detail ??
                              'Failed to delete picture.')
                            : 'Failed to delete picture.',
                        );
                      },
                    });
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-bg2 disabled:opacity-50"
                >
                  {deletePhoto.isPending ? 'Removing…' : 'Delete picture'}
                </button>
              )}
            </div>
            {photoError && <p className="text-xs text-danger">{photoError}</p>}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-bg3 px-3 py-2 text-xs text-text2">
          Save the employee first, then you can add a profile picture.
        </p>
      )}

      <label className="block text-sm">
        <span className="text-text2">Name</span>
        <input
          name="fullName"
          required
          defaultValue={initial?.fullName}
          disabled={lockName}
          readOnly={lockName}
          className={`${inputClass}${lockName ? ' cursor-not-allowed opacity-70' : ''}`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Designation code</span>
          <select
            value={designationId}
            onChange={(e) => setDesignationId(e.target.value)}
            className={selectClass}
          >
            <option value="">Select code…</option>
            {designationOptions
              .filter((d) => d.code)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-text2">Designation</span>
          <select
            value={designationId}
            onChange={(e) => setDesignationId(e.target.value)}
            className={selectClass}
          >
            <option value="">Select designation…</option>
            {designationOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-text2">Team</span>
        <select value={streamId} onChange={(e) => setStreamId(e.target.value)} className={selectClass}>
          <option value="">Select team…</option>
          {streams.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-text2">Engineering manager (EM)</span>
        <select value={emManagementId} onChange={(e) => setEmManagementId(e.target.value)} className={selectClass}>
          <option value="">Select manager…</option>
          {emOptions.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.fullName}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">NTP/GBL</span>
          <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)} className={selectClass}>
            <option value="">Select NTP/GBL…</option>
            {workTypes.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-text2">Country</span>
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={selectClass}>
            <option value="">Select country…</option>
            {countryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code && c.code !== c.name ? `${c.name} (${c.code})` : c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-text2">Product</span>
        <input name="product" defaultValue={initial?.product ?? ''} className={inputClass} />
      </label>
      <CheckboxMultiSelect
        label="Skills"
        options={skills}
        selectedIds={skillIds}
        onChange={setSkillIds}
        placeholder="Select skills…"
        emptyMessage="No skills in reference data yet. Add them under Admin → Reference data → Skills."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Total years of experience</span>
          <input
            name="totalYearsOfExperience"
            type="number"
            min={0}
            max={99}
            step={0.1}
            defaultValue={initial?.totalYearsOfExperience ?? ''}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">Experience in DFN</span>
          <input
            name="experienceInDfn"
            type="number"
            min={0}
            max={99}
            step={0.1}
            defaultValue={initial?.experienceInDfn ?? ''}
            className={inputClass}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Email</span>
          <input name="email" type="email" defaultValue={initial?.email ?? ''} className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="text-text2">Tel</span>
          <input name="phone" defaultValue={initial?.phone ?? ''} className={inputClass} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Employment type</span>
          <select
            name="employmentType"
            defaultValue={initial?.employmentType ?? ''}
            className={selectClass}
          >
            <option value="">Select employment type…</option>
            {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-text2">Status</span>
          <select name="status" defaultValue={initial?.status ?? 'ACTIVE'} className={inputClass}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
