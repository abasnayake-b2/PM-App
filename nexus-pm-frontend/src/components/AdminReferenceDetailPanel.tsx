import { Pencil, X } from 'lucide-react';
import type { ReferenceItem } from '@/api/referenceData.api';

export type RefTab =
  | 'departments'
  | 'streams'
  | 'designations'
  | 'work-types'
  | 'skills'
  | 'issue-types'
  | 'statuses'
  | 'priorities';

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-text2">{label}</dt>
      <dd className="mt-1 text-sm">{value?.trim() || '—'}</dd>
    </div>
  );
}

function displayName(item: ReferenceItem) {
  return item.name ?? item.label ?? item.code ?? item.id;
}

function detailFields(tab: RefTab, item: ReferenceItem): { label: string; value?: string | null }[] {
  switch (tab) {
    case 'departments':
      return [{ label: 'Name', value: item.name }];
    case 'streams':
      return [
        { label: 'Name', value: item.name },
        { label: 'Department', value: item.department?.name ?? item.departmentName },
      ];
    case 'designations':
      return [
        { label: 'Name', value: item.name },
        { label: 'Code', value: item.code },
        { label: 'Stream', value: item.stream?.name ?? item.streamName },
        { label: 'Department', value: item.department?.name ?? item.departmentName ?? item.stream?.department?.name },
      ];
    case 'work-types':
      return [{ label: 'Name', value: item.name }];
    case 'skills':
      return [
        { label: 'Name', value: item.name },
        { label: 'Description', value: item.description },
      ];
    case 'issue-types':
      return [
        { label: 'Name', value: item.name },
        { label: 'Workflow code', value: item.workflowCode },
        { label: 'Description', value: item.description },
      ];
    case 'statuses':
      return [
        { label: 'Name', value: item.name },
        { label: 'Sequence', value: item.sequence != null ? String(item.sequence) : null },
        { label: 'Terminal', value: item.terminal ? 'Yes' : 'No' },
        { label: 'Colour', value: item.colour },
      ];
    case 'priorities':
      return [
        { label: 'Label', value: item.label },
        { label: 'Level', value: item.level != null ? String(item.level) : null },
        { label: 'Colour', value: item.colour },
      ];
  }
}

interface AdminReferenceDetailPanelProps {
  tab: RefTab;
  item: ReferenceItem;
  onClose: () => void;
  onEdit: () => void;
}

export function AdminReferenceDetailPanel({ tab, item, onClose, onEdit }: AdminReferenceDetailPanelProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-bg2 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{displayName(item)}</h2>
            <p className="text-sm text-text2">Reference data</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text2 hover:bg-bg3 hover:text-text"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <dl className="rounded-xl border border-border bg-bg3 px-4">
            {detailFields(tab, item).map((field) => (
              <DetailRow key={field.label} label={field.label} value={field.value} />
            ))}
            <DetailRow label="Created by" value={item.createdByName} />
            <DetailRow label="Updated by" value={item.updatedByName} />
          </dl>
        </div>

        <div className="border-t border-border p-5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
          >
            <Pencil size={16} />
            Edit
          </button>
        </div>
      </aside>
    </>
  );
}

export function itemSearchText(item: ReferenceItem): string {
  return [
    item.name,
    item.label,
    item.code,
    item.workflowCode,
    item.description,
    item.department?.name,
    item.departmentName,
    item.stream?.name,
    item.streamName,
    item.colour,
    item.sequence != null ? String(item.sequence) : null,
    item.level != null ? String(item.level) : null,
    item.terminal ? 'terminal' : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function refDisplayName(item: ReferenceItem) {
  return displayName(item);
}

export function refItemDepartmentId(item?: ReferenceItem) {
  return item?.department?.id ?? item?.departmentId;
}

export function refItemStreamId(item?: ReferenceItem) {
  return item?.stream?.id ?? item?.streamId;
}
