import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useImportProjects } from '@/hooks/useProjects';

export function ProjectExcelUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const importProjects = useImportProjects();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    importProjects.mutate(file, {
      onSuccess: () => {
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

  const result = importProjects.data;

  return (
    <div className="rounded-xl border border-border bg-bg2 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-semibold">Import projects from Excel</h2>
          <p className="mt-2 text-sm text-text2">
            Upload a spreadsheet with columns: Region, Country, Client, Project, Product, EM, TL.
            Regions, countries, and clients are created automatically when missing. EM must already
            exist in the management roster (VP is taken from that EM&apos;s supervisor). If TL is empty,
            you are set as project lead.
          </p>
          <p className="mt-2 text-xs text-text2">
            Existing projects (same client + project name) are updated with Product, EM, and lead from
            the file.
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
            disabled={importProjects.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Upload size={16} />
            {importProjects.isPending ? 'Importing…' : 'Upload Projects Excel'}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 whitespace-pre-wrap text-sm text-danger">{error}</p>}

      {result && importProjects.isSuccess && (
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
