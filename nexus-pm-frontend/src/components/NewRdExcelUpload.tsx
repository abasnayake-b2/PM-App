import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useImportNewRdExcel } from '@/hooks/useIssues';

export function NewRdExcelUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const importNewRd = useImportNewRdExcel();

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    importNewRd.mutate(file, {
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

  const result = importNewRd.data;

  return (
    <div className="rounded-xl border border-border bg-bg2 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-semibold">New RD upload</h2>
          <p className="mt-2 text-sm text-text2">
            Upload the new RD Excel workbook. Columns are mapped to RD fields (BMS ID, Change Request
            Name, dates, financials, man-days, milestones, risk, and notes). This is separate from the
            existing backlog import above.
          </p>
          <p className="mt-2 text-xs text-text2">
            Include a <strong>Project Name</strong> column (matched to the project name or product
            code). Header row can sit below title rows. Product or the sheet name is used only if
            Project Name is blank. CR No / ID is <strong>{'{Project Name}-RD-{CR #}'}</strong>. An
            existing RD is updated only when that exact key already exists; otherwise a new RD is
            created (next project number if CR # is blank). Type defaults to Change Request when
            omitted. Accepts .xlsx or .xls.
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
            disabled={importNewRd.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Upload size={16} />
            {importNewRd.isPending ? 'Importing…' : 'Upload New RD Excel'}
          </button>
        </div>
      </div>

      {error && <p className="mt-4 whitespace-pre-wrap text-sm text-danger">{error}</p>}

      {result && importNewRd.isSuccess && (
        <div className="mt-4 rounded-lg border border-border bg-bg3/50 p-4 text-sm">
          <p className="font-medium">
            Imported {result.fileName}: {result.created} created, {result.updated} updated
            {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
          </p>
          {result.message && <p className="mt-2 text-text2">{result.message}</p>}
          {result.importedAt && (
            <p className="mt-1 text-xs text-text2">
              {result.importedByName ? `${result.importedByName} · ` : ''}
              {new Date(result.importedAt).toLocaleString()}
            </p>
          )}
          {result.detectedColumns && result.detectedColumns.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-text2">Detected columns</p>
              <p className="mt-1 text-xs text-text2">{result.detectedColumns.join(', ')}</p>
            </div>
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
