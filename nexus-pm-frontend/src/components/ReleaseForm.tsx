import { FormEvent } from 'react';
import type { CreateReleasePayload } from '@/hooks/useProjects';

interface ReleaseFormProps {
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: Omit<CreateReleasePayload, 'projectId'>) => void;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

const RELEASE_STATUSES = ['PLANNED', 'ACTIVE', 'RELEASED', 'CANCELLED'] as const;

export function ReleaseForm({ loading, onCancel, onSubmit }: ReleaseFormProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const targetDate = (fd.get('targetDate') as string).trim();
    onSubmit({
      name: (fd.get('name') as string).trim(),
      version: (fd.get('version') as string).trim() || undefined,
      status: fd.get('status') as string,
      targetDate: targetDate || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <h2 className="font-semibold">New release</h2>

      <label className="block text-sm">
        <span className="text-text2">Name</span>
        <input name="name" type="text" required maxLength={100} className={inputClass} />
      </label>

      <label className="block text-sm">
        <span className="text-text2">Version</span>
        <input name="version" type="text" maxLength={50} placeholder="e.g. 1.0.0" className={inputClass} />
      </label>

      <label className="block text-sm">
        <span className="text-text2">Status</span>
        <select name="status" defaultValue="PLANNED" className={inputClass}>
          {RELEASE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-text2">Target date</span>
        <input name="targetDate" type="date" className={inputClass} />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Creating…' : 'Create release'}
        </button>
      </div>
    </form>
  );
}
