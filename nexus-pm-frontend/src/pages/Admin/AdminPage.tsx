import { FormEvent, useEffect, useState } from 'react';
import { Search, Settings } from 'lucide-react';
import { AdminReferenceSection } from '@/components/AdminReferenceSection';
import { AdminRolePermissionsSection } from '@/components/AdminRolePermissionsSection';
import { AdminRdFieldsSection } from '@/components/AdminRdFieldsSection';
import { ProjectExcelUpload } from '@/components/ProjectExcelUpload';
import { BacklogExcelUpload } from '@/components/BacklogExcelUpload';
import { ListPagination } from '@/components/ListPagination';
import { AiToolsSection } from '@/pages/Admin/AiToolsSection';
import { AiSettingsSection } from '@/pages/Admin/AiSettingsSection';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import {
  useAuditLogs,
  useHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useWorkflowRules,
  useSystemSettings,
  useUpdateSetting,
  useNotificationTemplates,
} from '@/hooks/useAdmin';

type Tab =
  | 'audit'
  | 'holidays'
  | 'workflow'
  | 'settings'
  | 'templates'
  | 'reference'
  | 'access'
  | 'projects'
  | 'rd-fields'
  | 'ai-tools'
  | 'ai-settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'audit', label: 'Audit log' },
  { key: 'projects', label: 'Excel import' },
  { key: 'reference', label: 'Reference data' },
  { key: 'rd-fields', label: 'RD fields' },
  { key: 'access', label: 'Roles & access' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'workflow', label: 'Workflow rules' },
  { key: 'settings', label: 'Settings' },
  { key: 'ai-tools', label: 'AI Tools' },
  { key: 'ai-settings', label: 'AI Settings' },
  { key: 'templates', label: 'Email templates' },
];

function tabVisible(
  key: Tab,
  can: (code: string) => boolean,
  superAdmin: boolean,
): boolean {
  switch (key) {
    case 'audit':
    case 'holidays':
    case 'workflow':
    case 'settings':
    case 'templates':
    case 'ai-tools':
    case 'ai-settings':
      return can(P.ADMIN_VIEW);
    case 'projects':
      return can(P.IMPORT_CREATE);
    case 'reference':
    case 'rd-fields':
      return can(P.REFERENCE_VIEW);
    case 'access':
      return superAdmin;
    default:
      return false;
  }
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('audit');
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [auditSearchInput, setAuditSearchInput] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const { can, superAdmin } = usePermissions();
  const visibleTabs = TABS.filter((t) => tabVisible(t.key, can, superAdmin));

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === tab)) {
      setTab(visibleTabs[0].key);
    }
  }, [visibleTabs, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAuditSearch(auditSearchInput.trim());
      setAuditPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [auditSearchInput]);

  const { data: auditData, isLoading: auditLoading } = useAuditLogs(
    auditPage,
    auditSearch,
    auditPageSize,
  );
  const { data: holidays } = useHolidays();
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const { data: workflowRules } = useWorkflowRules();
  const { data: settings } = useSystemSettings();
  const updateSetting = useUpdateSetting();
  const { data: templates } = useNotificationTemplates();

  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [settingDraft, setSettingDraft] = useState('');

  const handleAddHoliday = async (e: FormEvent) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) return;
    await createHoliday.mutateAsync({ name: holidayName, holidayDate });
    setHolidayName('');
    setHolidayDate('');
  };

  const saveSetting = async (id: string) => {
    await updateSetting.mutateAsync({ id, value: settingDraft });
    setEditingSetting(null);
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <Settings className="text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-text2">System configuration and audit trail</p>
        </div>
      </div>

      <div className="mt-6 border-b border-border">
        <nav className="-mb-px flex flex-wrap gap-4">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`border-b-2 pb-3 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text2 hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'audit' && (
        <div className="mt-6 space-y-4">
          <label className="block max-w-md text-sm">
            <span className="text-text2">Search</span>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text2" size={16} />
              <input
                type="search"
                value={auditSearchInput}
                onChange={(e) => setAuditSearchInput(e.target.value)}
                placeholder="User, action, entity, details…"
                className="w-full rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>
          {auditLoading && <p className="text-text2">Loading…</p>}
          {auditData && (
            <>
              <ListPagination
                page={auditData}
                pageIndex={auditPage}
                pageSize={auditPageSize}
                onPageChange={setAuditPage}
                onPageSizeChange={setAuditPageSize}
                itemLabel="entries"
              />
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg2 text-text2">
                    <tr>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Entity</th>
                      <th className="px-4 py-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.content.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-text2">
                          {auditSearch
                            ? `No audit entries matching “${auditSearch}”.`
                            : 'No audit entries yet.'}
                        </td>
                      </tr>
                    )}
                    {auditData.content.map((log) => (
                      <tr key={log.id} className="border-t border-border">
                        <td className="px-4 py-3 text-text2 whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3">{log.employeeName ?? '—'}</td>
                        <td className="px-4 py-3 font-medium">{log.action}</td>
                        <td className="px-4 py-3 text-text2">{log.entityType}</td>
                        <td className="px-4 py-3 text-text2">{log.details ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'projects' && (
        <div className="mt-6 space-y-6">
          {can(P.IMPORT_CREATE) && <ProjectExcelUpload />}
          {superAdmin && <BacklogExcelUpload variant="admin" />}
        </div>
      )}

      {tab === 'reference' && (
        <div className="mt-6">
          <AdminReferenceSection />
        </div>
      )}

      {tab === 'rd-fields' && can(P.REFERENCE_VIEW) && (
        <div className="mt-6">
          <AdminRdFieldsSection />
        </div>
      )}

      {tab === 'access' && superAdmin && (
        <div className="mt-6">
          <AdminRolePermissionsSection />
        </div>
      )}

      {tab === 'holidays' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleAddHoliday} className="card p-6">
            <h2 className="font-semibold">Add holiday</h2>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="Holiday name"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
                required
              />
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                disabled={createHoliday.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ color: 'var(--accent-fg)' }}
              >
                Add holiday
              </button>
            </div>
          </form>
          <div className="card p-6">
            <h2 className="font-semibold">Holiday calendar</h2>
            <ul className="mt-4 divide-y divide-border">
              {holidays?.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-sm text-text2">
                      {h.holidayDate}
                      {h.countryName ? ` · ${h.countryName}` : ' · Global'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteHoliday.mutate(h.id)}
                    className="text-xs text-danger hover:underline"
                  >
                    Delete
                  </button>
                </li>
              ))}
              {(!holidays || holidays.length === 0) && (
                <li className="py-4 text-text2">No holidays configured.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {tab === 'workflow' && (
        <div className="mt-6">
          <p className="text-sm text-text2">
            Allowed status transitions per issue type. Bug workflows are seeded; other types allow any transition.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg2 text-text2">
                <tr>
                  <th className="px-4 py-3 font-medium">Issue type</th>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                </tr>
              </thead>
              <tbody>
                {workflowRules?.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">{r.issueTypeName}</td>
                    <td className="px-4 py-3">{r.fromStatusName}</td>
                    <td className="px-4 py-3">{r.toStatusName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="mt-6 space-y-3">
          {settings?.map((s) => (
            <div key={s.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="font-mono text-sm font-medium">{s.settingKey}</p>
                {editingSetting !== s.id ? (
                  <p className="mt-1 text-text2">{s.settingValue}</p>
                ) : (
                  <input
                    type="text"
                    value={settingDraft}
                    onChange={(e) => setSettingDraft(e.target.value)}
                    className="mt-2 w-full max-w-md rounded border border-border bg-bg3 px-3 py-1.5 text-sm"
                  />
                )}
              </div>
              {editingSetting === s.id ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveSetting(s.id)}
                    className="text-sm text-accent hover:underline"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSetting(null)}
                    className="text-sm text-text2 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSetting(s.id);
                    setSettingDraft(s.settingValue ?? '');
                  }}
                  className="text-sm text-accent hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'ai-tools' && can(P.ADMIN_VIEW) && <AiToolsSection />}

      {tab === 'ai-settings' && can(P.ADMIN_VIEW) && <AiSettingsSection />}

      {tab === 'templates' && (
        <div className="mt-6 space-y-4">
          {templates?.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-bg3 px-2 py-0.5 font-mono text-xs">{t.code}</span>
                <span className="font-medium">{t.subject}</span>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded bg-bg3 p-3 text-xs text-text2">
                {t.bodyTemplate}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
