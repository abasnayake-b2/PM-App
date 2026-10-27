import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import {
  importAdminReferenceData,
  importAdminSkillsData,
  importAdminWorkTypesData,
  type ReferenceDataImportResult,
} from '@/api/referenceData.api';

type ReferenceExcelVariant = 'reference' | 'skills' | 'work-types';

interface ReferenceDataExcelUploadProps {
  onImported?: () => void;
  variant?: ReferenceExcelVariant;
  onDownload?: () => void | Promise<void>;
  downloading?: boolean;
}

function formatSummary(result: ReferenceDataImportResult, variant: ReferenceExcelVariant): string {
  if (variant === 'work-types') {
    const created = result.workTypesCreated ?? 0;
    const updated = result.workTypesUpdated ?? 0;
    const skipped = result.workTypesSkipped ?? 0;
    const parts = [`${created} NTP/GBL value${created !== 1 ? 's' : ''} created`];
    if (updated > 0) parts.push(`${updated} updated`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    return `Imported from ${result.fileName}: ${parts.join(', ')}.`;
  }
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

const COPY: Record<ReferenceExcelVariant, { title: string; description: string; upload: string; download: string }> = {
  reference: {
    title: 'Import reference data from Excel',
    description:
      'Upload an Excel file with Departments, Streams, and Designations sheets. Designations may include an Is Management column (Yes/No). An optional Skills sheet (Name + Description) is also supported.',
    upload: 'Upload reference data Excel',
    download: 'Download Excel',
  },
  skills: {
    title: 'Skills Excel',
    description:
      'Download Skill Excel to get the current list (Name and Description). Edit that file, then upload it with Upload Skill Excel. Matching names are updated; new names are added.',
    upload: 'Upload Skill Excel',
    download: 'Download Skill Excel',
  },
  'work-types': {
    title: 'NTP/GBL Excel',
    description:
      'Download NTP/GBL Excel to get the current list (Name). Edit that file, then upload it with Upload NTP/GBL Excel. Matching names are updated; new names are added.',
    upload: 'Upload NTP/GBL Excel',
    download: 'Download NTP/GBL Excel',
  },
};

export function ReferenceDataExcelUpload({
  onImported,
  variant = 'reference',
  onDownload,
  downloading = false,
}: ReferenceDataExcelUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[variant];

  const importMutation = useMutation({
    mutationFn:
      variant === 'skills'
        ? importAdminSkillsData
        : variant === 'work-types'
          ? importAdminWorkTypesData
          : importAdminReferenceData,
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
          <h3 className="text-sm font-semibold">{copy.title}</h3>
          <p className="mt-1 text-xs text-text2">{copy.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onDownload && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                void Promise.resolve(onDownload()).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Download failed');
                });
              }}
              disabled={downloading || importMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3 disabled:opacity-50"
            >
              <Download size={16} />
              {downloading ? 'Preparing…' : copy.download}
            </button>
          )}
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
            {importMutation.isPending ? 'Importing…' : copy.upload}
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
