import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  useImportTeamManagement,
  useImportTeamMembers,
  useLatestTeamManagementImport,
  useLatestTeamMembersImport,
  useUpdateTeamMembers,
} from '@/hooks/useTeamRoster';

import type { TeamImportResult } from '@/api/teamRoster.api';

type TeamExcelUploadVariant = 'management' | 'employees';

interface TeamExcelUploadProps {
  variant: TeamExcelUploadVariant;
  onImported?: () => void;
  /** Employees: download a Team sheet that can be re-uploaded. */
  onDownload?: () => void | Promise<void>;
  downloading?: boolean;
  downloadDisabled?: boolean;
}

const COPY: Record<
  TeamExcelUploadVariant,
  {
    title: string;
    description: string;
    sheetName: string;
    success: (count: number, fileName: string, usersCreated?: number) => string;
    lastImport: (latest: TeamImportResult) => string;
  }
> = {
  management: {
    title: 'Import management from Excel',
    description:
      'Upload an Excel file with a Management sheet: Role (title), First Name, Last Name, Supervisor, Role (CXO / CEO / COO / CTO / CPO / VP / Manager), Email. Replaces the current management roster and auto-creates login accounts using the Email column when provided (otherwise firstname.lastname@dfnpm.local). Initial password is FirstInitialLastName@12345 (e.g. ECulum@12345).',
    sheetName: 'Management',
    success: (count, fileName, usersCreated) =>
      `Imported ${count} management record${count !== 1 ? 's' : ''} from ${fileName}${
        usersCreated ? ` and created ${usersCreated} user account${usersCreated !== 1 ? 's' : ''}` : ''
      }.`,
    lastImport: (latest) =>
      `Last import: ${latest.fileName} — ${latest.managementImported} management record${latest.managementImported !== 1 ? 's' : ''}${
        latest.usersCreated ? `, ${latest.usersCreated} user${latest.usersCreated !== 1 ? 's' : ''} created` : ''
      }${latest.importedAt ? ` · ${new Date(latest.importedAt).toLocaleString()}` : ''}`,
  },
  employees: {
    title: 'Import employees from Excel',
    description:
      'Upload an Excel file with a Team sheet (Name, Code, Designation, Team, EM, NTP/GBL, Country, Product, Email, Tel). Download Excel first to get a file you can edit and re-upload. Designation codes (e.g. SE, QA) are matched to reference designation names. Each EM must exist in the management roster — upload Management Excel first. Upload Team Excel replaces the current employee roster. Update matches each row by Name and updates skills and the other columns on that employee.',
    sheetName: 'Team',
    success: (count, fileName) => `Imported ${count} employee${count !== 1 ? 's' : ''} from ${fileName}.`,
    lastImport: (latest) =>
      `Last import: ${latest.fileName} — ${latest.membersImported} employee${latest.membersImported !== 1 ? 's' : ''}${
        latest.importedAt ? ` · ${new Date(latest.importedAt).toLocaleString()}` : ''
      }`,
  },
};

export function TeamExcelUpload({
  variant,
  onImported,
  onDownload,
  downloading = false,
  downloadDisabled = false,
}: TeamExcelUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const importManagement = useImportTeamManagement();
  const importMembers = useImportTeamMembers();
  const updateMembers = useUpdateTeamMembers();
  const { data: latestManagement } = useLatestTeamManagementImport(variant === 'management');
  const { data: latestMembers } = useLatestTeamMembersImport(variant === 'employees');

  const importMutation = variant === 'management' ? importManagement : importMembers;
  const latest = variant === 'management' ? latestManagement : latestMembers;
  const copy = COPY[variant];

  const errorMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data?.detail ??
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    fallback;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    updateMembers.reset();
    importMutation.mutate(file, {
      onSuccess: () => {
        onImported?.();
        if (fileRef.current) fileRef.current.value = '';
      },
      onError: (err: unknown) => {
        setError(errorMessage(err, 'Import failed'));
      },
    });
  };

  const handleUpdateFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    importMutation.reset();
    updateMembers.mutate(file, {
      onSuccess: () => {
        onImported?.();
        if (updateFileRef.current) updateFileRef.current.value = '';
      },
      onError: (err: unknown) => {
        setError(errorMessage(err, 'Update failed'));
      },
    });
  };

  const importedCount =
    variant === 'management'
      ? importMutation.data?.managementImported ?? 0
      : importMutation.data?.membersImported ?? 0;

  return (
    <div className="rounded-xl border border-border bg-bg2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{copy.title}</h3>
          <p className="mt-1 text-xs text-text2">{copy.description}</p>
          {latest && <p className="mt-2 text-xs text-text2">{copy.lastImport(latest)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onDownload && (
            <button
              type="button"
              onClick={() => void onDownload()}
              disabled={downloading || downloadDisabled}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3 disabled:opacity-50"
            >
              <Download size={16} />
              {downloading ? 'Preparing…' : 'Download Excel'}
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
            disabled={importMutation.isPending || updateMembers.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Upload size={16} />
            {importMutation.isPending ? 'Importing…' : `Upload ${copy.sheetName} Excel`}
          </button>
          {variant === 'employees' && (
            <>
              <input
                ref={updateFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handleUpdateFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => updateFileRef.current?.click()}
                disabled={importMutation.isPending || updateMembers.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-bg3 disabled:opacity-50"
              >
                <Upload size={16} />
                {updateMembers.isPending ? 'Updating…' : 'Update'}
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-3 whitespace-pre-wrap text-sm text-danger">{error}</p>}
      {variant === 'employees' && updateMembers.isSuccess && updateMembers.data && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-text2">
            Updated {updateMembers.data.membersImported} employee
            {updateMembers.data.membersImported !== 1 ? 's' : ''} from {updateMembers.data.fileName}.
            {(updateMembers.data.notUpdated?.length ?? 0) === 0
              ? ' Every row matched an employee.'
              : ` ${updateMembers.data.notUpdated!.length} row${updateMembers.data.notUpdated!.length !== 1 ? 's were' : ' was'} not updated.`}
          </p>
          {(updateMembers.data.notUpdated?.length ?? 0) > 0 && (
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead className="bg-bg3 text-text2">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {updateMembers.data.notUpdated!.map((row) => (
                    <tr key={`${row.rowNumber}-${row.name}`} className="border-t border-border">
                      <td className="px-3 py-2">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {importMutation.isSuccess && importMutation.data && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-text2">
            {copy.success(
              importedCount,
              importMutation.data.fileName,
              variant === 'management' ? importMutation.data.usersCreated : undefined,
            )}
          </p>
          {variant === 'management' && (importMutation.data.provisionedUsers?.length ?? 0) > 0 && (
            <div className="overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[32rem] text-left text-xs">
                <thead className="bg-bg3 text-text2">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Initial password</th>
                  </tr>
                </thead>
                <tbody>
                  {importMutation.data.provisionedUsers!.map((user) => (
                    <tr key={user.managementId} className="border-t border-border">
                      <td className="px-3 py-2">{user.fullName}</td>
                      <td className="px-3 py-2 font-mono">{user.email}</td>
                      <td className="px-3 py-2">{user.roleCode}</td>
                      <td className="px-3 py-2 font-mono">{user.initialPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
