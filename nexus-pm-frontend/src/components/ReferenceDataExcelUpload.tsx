import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import {
  importAdminReferenceData,
  importAdminSkillsData,
  type ReferenceDataImportResult,
} from '@/api/referenceData.api';

interface ReferenceDataExcelUploadProps {
  onImported?: () => void;
  variant?: 'reference' | 'skills';
}

function formatSummary(result: ReferenceDataImportResult, variant: 'reference' | 'skills'): string {
  if (variant === 'skills') {
    const created = result.skillsCreated ?? 0;
    const updated = result.skillsUpdated ?? 0;
    const skipped = result.skillsSkipped ?? 0;
    const parts = [`${created} skill${created !== 1 ? 's' : ''} created`];
    if (updated > 0) parts.push(`${updated} updated`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    return `Imported from ${result.fileName}: ${parts.join(', ')}.`;
  }

  const parts = [
    `${result.departmentsCreated} department${result.departmentsCreated !== 1 ? 's' : ''} created`,
    `${result.streamsCreated} stream${result.streamsCreated !== 1 ? 's' : ''} created`,
    `${result.designationsCreated} designation${result.designationsCreated !== 1 ? 's' : ''} created`,
  ];
  const skillsCreated = result.skillsCreated ?? 0;
  if (skillsCreated > 0) {
    parts.push(`${skillsCreated} skill${skillsCreated !== 1 ? 's' : ''} created`);
  }
  const updated =
    result.departmentsUpdated +
    result.streamsUpdated +
    result.designationsUpdated +
    (result.skillsUpdated ?? 0);
  if (updated > 0) {
    parts.push(`${updated} updated`);
  }
  const skipped =
    result.departmentsSkipped +
    result.streamsSkipped +
    result.designationsSkipped +
    (result.skillsSkipped ?? 0);
  if (skipped > 0) {
    parts.push(`${skipped} skipped`);
  }
  return `Imported from ${result.fileName}: ${parts.join(', ')}.`;
}

export function ReferenceDataExcelUpload({
  onImported,
  variant = 'reference',
}: ReferenceDataExcelUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: variant === 'skills' ? importAdminSkillsData : importAdminReferenceData,
    onSuccess: () => {
      onImported?.();
      if (fileRef.current) {
        fileRef.current.value = '';
      }
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

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    importMutation.mutate(file);
  };

  const result = importMutation.data;

  return (
    <div className="mb-6 rounded-xl border border-border bg-bg2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            {variant === 'skills'
              ? 'Import skills from Excel'
              : 'Import reference data from Excel'}
          </h3>
          <p className="mt-1 text-xs text-text2">
            {variant === 'skills'
              ? 'Upload an Excel file with a Skills sheet (or a single sheet), Name column, and optional Description column.'
              : 'Upload an Excel file with Departments, Streams, and Designations sheets. Designations may include an Is Management column (Yes/No). An optional Skills sheet (Name + Description) is also supported.'}
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
            disabled={importMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Upload size={16} />
            {importMutation.isPending
              ? 'Importing…'
              : variant === 'skills'
                ? 'Upload skills Excel'
                : 'Upload reference data Excel'}
          </button>
        </div>
      </div>
      {error && <p className="mt-3 whitespace-pre-wrap text-sm text-danger">{error}</p>}
      {importMutation.isSuccess && result && (
        <div className="mt-3 text-sm text-text2">
          <p>{formatSummary(result, variant)}</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-xs text-danger">
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
