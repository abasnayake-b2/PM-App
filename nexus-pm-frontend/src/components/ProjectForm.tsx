import { FormEvent, useMemo, useState } from 'react';
import type { Project } from '@/types';
import type { CreateProjectPayload, UpdateProjectPayload } from '@/hooks/useProjects';
import { ClientHierarchySelect, type ClientHierarchyValue } from '@/components/ClientHierarchySelect';

export interface ProjectFormOption {
  id: string;
  label: string;
  /** EM supervisor display name (used for derived VP field). */
  supervisorName?: string;
}

interface ProjectFormProps {
  mode: 'create' | 'edit';
  clients?: ProjectFormOption[];
  rosterEmployees: ProjectFormOption[];
  engineeringManagerOptions: ProjectFormOption[];
  initial?: Project;
  initialHierarchy?: ClientHierarchyValue;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateProjectPayload | UpdateProjectPayload) => void;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

function readOptionalId(fd: FormData, name: string): string | null {
  const value = (fd.get(name) as string) ?? '';
  return value || null;
}

export function ProjectForm({
  mode,
  clients,
  rosterEmployees,
  engineeringManagerOptions,
  initial,
  initialHierarchy,
  loading,
  onCancel,
  onSubmit,
}: ProjectFormProps) {
  const [hierarchy, setHierarchy] = useState<ClientHierarchyValue>(
    initialHierarchy ?? {
      regionId: initial?.regionId ?? '',
      countryId: '',
      clientId: initial?.clientId ?? '',
    },
  );
  const [engineeringManagerManagementId, setEngineeringManagerManagementId] = useState(
    initial?.engineeringManagerManagementId ?? '',
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [dateError, setDateError] = useState<string | null>(null);

  const selectedEm = useMemo(
    () =>
      engineeringManagerOptions.find((option) => option.id === engineeringManagerManagementId) ??
      null,
    [engineeringManagerOptions, engineeringManagerManagementId],
  );

  const vpDisplayName = useMemo(() => {
    if (selectedEm?.supervisorName) return selectedEm.supervisorName;
    // Keep showing stored VP while EM options load, or when EM unchanged but supervisor missing on option.
    if (
      mode === 'edit' &&
      initial?.vpName &&
      engineeringManagerManagementId === (initial.engineeringManagerManagementId ?? '')
    ) {
      return initial.vpName;
    }
    if (!engineeringManagerManagementId) {
      return mode === 'edit' ? '—' : 'Set after EM is chosen (follows EM’s supervisor)';
    }
    return 'No supervisor set for this EM';
  }, [
    selectedEm,
    mode,
    engineeringManagerManagementId,
    initial?.vpName,
    initial?.engineeringManagerManagementId,
  ]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (startDate && endDate && endDate < startDate) {
      setDateError('End date must be on or after the start date.');
      return;
    }
    setDateError(null);

    if (mode === 'create') {
      const clientId = hierarchy.clientId || (fd.get('clientId') as string);
      const payload: CreateProjectPayload = {
        clientId,
        name: (fd.get('name') as string).trim(),
        product: (fd.get('product') as string).trim() || undefined,
        jiraProjectKey: (fd.get('jiraProjectKey') as string).trim() || undefined,
        leadEmployeeId: fd.get('leadEmployeeId') as string,
        architectEmployeeId: readOptionalId(fd, 'architectEmployeeId') ?? undefined,
        engineeringManagerManagementId: engineeringManagerManagementId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        budgetCurrency: (fd.get('budgetCurrency') as string) || undefined,
      };
      const budget = fd.get('budgetAmount') as string;
      if (budget) payload.budgetAmount = parseFloat(budget);
      onSubmit(payload);
      return;
    }

    const payload: UpdateProjectPayload = {
      name: (fd.get('name') as string).trim(),
      product: (fd.get('product') as string).trim() || null,
      jiraProjectKey: (fd.get('jiraProjectKey') as string).trim() || null,
      leadEmployeeId: (fd.get('leadEmployeeId') as string) || undefined,
      architectEmployeeId: readOptionalId(fd, 'architectEmployeeId'),
      engineeringManagerManagementId: engineeringManagerManagementId || null,
      startDate: startDate || null,
      endDate: endDate || null,
      status: (fd.get('status') as string) || undefined,
      budgetCurrency: (fd.get('budgetCurrency') as string) || undefined,
    };
    const budget = fd.get('budgetAmount') as string;
    if (budget) payload.budgetAmount = parseFloat(budget);
    else if (budget === '') payload.budgetAmount = null;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-bg2 p-6">
      <label className="block text-sm">
        <span className="text-text2">Project name</span>
        <input
          name="name"
          required
          defaultValue={initial?.name ?? ''}
          className={inputClass}
          placeholder="e.g. Trading Platform Redesign"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Product</span>
          <input
            name="product"
            defaultValue={initial?.product ?? ''}
            className={inputClass}
            placeholder="e.g. GBL"
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">Jira project key</span>
          <input
            name="jiraProjectKey"
            defaultValue={initial?.jiraProjectKey ?? ''}
            className={inputClass}
            placeholder="e.g. TEST"
          />
        </label>
      </div>

      {mode === 'create' && (
        clients ? (
          <label className="block text-sm">
            <span className="text-text2">Client</span>
            <select name="clientId" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Select client…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <ClientHierarchySelect
            value={hierarchy}
            onChange={setHierarchy}
            showCreateLinks
          />
        )
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Engineering manager</span>
          <select
            name="engineeringManagerManagementId"
            className={inputClass}
            value={engineeringManagerManagementId}
            onChange={(e) => setEngineeringManagerManagementId(e.target.value)}
          >
            <option value="">{mode === 'edit' ? 'None' : 'Select engineering manager…'}</option>
            {engineeringManagerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-text2">VP (from EM supervisor)</span>
          <input
            type="text"
            readOnly
            disabled
            value={vpDisplayName}
            className={`${inputClass} opacity-80`}
            title="Derived from the engineering manager’s supervisor. Change the EM’s supervisor in Org Structure to move projects."
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Project lead</span>
          <select
            name="leadEmployeeId"
            required={mode === 'create'}
            className={inputClass}
            defaultValue={initial?.leadEmployeeId ?? ''}
          >
            <option value="">{mode === 'edit' ? 'Unchanged' : 'Select project lead…'}</option>
            {rosterEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-text2">Architect</span>
          <select
            name="architectEmployeeId"
            className={inputClass}
            defaultValue={initial?.architectEmployeeId ?? ''}
          >
            <option value="">{mode === 'edit' ? 'None' : 'Select architect…'}</option>
            {rosterEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === 'edit' && (
        <>
          <label className="block text-sm">
            <span className="text-text2">Status</span>
            <select name="status" className={inputClass} defaultValue={initial?.status ?? 'ACTIVE'}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </label>
          {initial && (
            <p className="text-sm text-text2">
              Completion ({initial.progressPct ?? 0}%) is calculated automatically from issues or the project
              schedule.
            </p>
          )}
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Start date</span>
          <input
            name="startDate"
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => {
              const next = e.target.value;
              setStartDate(next);
              if (endDate && next && endDate < next) {
                setDateError('End date must be on or after the start date.');
              } else {
                setDateError(null);
              }
            }}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">End date</span>
          <input
            name="endDate"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => {
              const next = e.target.value;
              setEndDate(next);
              if (startDate && next && next < startDate) {
                setDateError('End date must be on or after the start date.');
              } else {
                setDateError(null);
              }
            }}
            className={inputClass}
          />
        </label>
      </div>
      {dateError && <p className="text-xs text-danger">{dateError}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Budget amount</span>
          <input
            name="budgetAmount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial?.budgetAmount ?? ''}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="text-text2">Currency</span>
          <select
            name="budgetCurrency"
            className={inputClass}
            defaultValue={initial?.budgetCurrency ?? 'USD'}
          >
            {['USD', 'EUR', 'GBP', 'LKR', 'INR'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || !!dateError}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : mode === 'create' ? 'Create project' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
