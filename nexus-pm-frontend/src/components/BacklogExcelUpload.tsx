import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useImportBacklogAll, useImportProjectBacklog } from '@/hooks/useIssues';

type BacklogExcelUploadVariant = 'project' | 'admin';

interface BacklogExcelUploadProps {
  variant: BacklogExcelUploadVariant;
  projectId?: string;
  projectLabel?: string;
  compact?: boolean;
  onImported?: () => void;
}

export function BacklogExcelUpload({
  variant,
  projectId,
  projectLabel,
  compact = false,
  onImported,
}: BacklogExcelUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const importProject = useImportProjectBacklog(projectId);
  const importAll = useImportBacklogAll();
  const importMutation = variant === 'project' ? importProject : importAll;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    importMutation.mutate(file, {
      onSuccess: () => {
        onImported?.();
        if (fileRef.current) fileRef.current.value = '';
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
            ?.detail ??
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Import failed';
        setError(msg);
      },
    });
  };

  const result = importMutation.data;
  const isProject = variant === 'project';

  if (compact) {
    return (
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importMutation.isPending || (isProject && !projectId)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3 disabled:opacity-50"
        >
          <Upload size={16} />
          {importMutation.isPending ? 'Importing…' : 'Upload RD Excel'}
        </button>
        {error && <p className="mt-2 max-w-xl whitespace-pre-wrap text-sm text-danger">{error}</p>}
        {result && importMutation.isSuccess && (
          <div className="mt-2 max-w-xl text-sm text-text2">
            <p>
              {result.created} created, {result.updated} updated
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-danger">
                {result.errors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg2 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-semibold">
            {isProject ? 'Import backlog from RD Excel' : 'Import backlog for all projects'}
          </h2>
          <p className="mt-2 text-sm text-text2">
            Upload a spreadsheet with columns: Project, Title, Type, Priority, Current Stage, Priority.
            {isProject
              ? ` Rows are imported into ${projectLabel ?? 'this project'}'s backlog. The Project column is ignored on this screen.`
              : ' Each row is routed to the project named in the Project column (matched by product code or project name).'}
          </p>
          <p className="mt-2 text-xs text-text2">
            Supported types: Epic, Stories, Task, Bugs, Change Request. Duplicate titles in the same
            project update priority and status. The second Priority column is used when present.
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importMutation.isPending || (isProject && !projectId)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Upload size={16} />
            {importMutation.isPending ? 'Importing…' : 'Upload RD Excel'}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 whitespace-pre-wrap text-sm text-danger">{error}</p>}

      {result && importMutation.isSuccess && (
        <div className="mt-4 rounded-lg border border-border bg-bg3/50 p-4 text-sm">
          <p className="font-medium">
            Imported {result.fileName}: {result.created} created, {result.updated} updated
            {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
          </p>
          {result.importedAt && (
            <p className="mt-1 text-xs text-text2">
              {result.importedByName ? `${result.importedByName} · ` : ''}
              {new Date(result.importedAt).toLocaleString()}
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-danger">
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
