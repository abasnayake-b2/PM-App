import { Pencil, X } from 'lucide-react';
import type { TeamRosterMember } from '@/api/teamRoster.api';
import { ResourceAvatar } from '@/components/ResourceAvatar';

interface TeamRosterMemberPanelProps {
  member: TeamRosterMember;
  canEdit?: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const display = value?.trim() || '—';
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-text2">{label}</dt>
      <dd className="mt-1 text-sm">{display}</dd>
    </div>
  );
}

export function TeamRosterMemberPanel({ member, canEdit, onClose, onEdit }: TeamRosterMemberPanelProps) {
  const subtitle = [member.designationCode, member.designation].filter(Boolean).join(' · ') || 'Employee';

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
          <div className="flex min-w-0 items-center gap-3">
            <ResourceAvatar
              name={member.fullName}
              size="md"
              imageUrl={member.profilePictureUrl}
            />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{member.fullName}</h2>
              <p className="text-sm text-text2">{subtitle}</p>
            </div>
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
            <DetailRow label="Designation code" value={member.designationCode} />
            <DetailRow label="Designation" value={member.designation} />
            <DetailRow label="Team" value={member.teamName} />
            <DetailRow label="Engineering manager" value={member.engineeringManagerName} />
            <DetailRow label="NTP/GBL" value={member.workType} />
            <DetailRow label="Country" value={member.country} />
            <DetailRow label="Product" value={member.product} />
            <DetailRow
              label="Skills"
              value={member.skillNames?.length ? member.skillNames.join(', ') : null}
            />
            <DetailRow
              label="Total years of experience"
              value={
                member.totalYearsOfExperience != null ? String(member.totalYearsOfExperience) : null
              }
            />
            <DetailRow
              label="Experience in DFN"
              value={member.experienceInDfn != null ? String(member.experienceInDfn) : null}
            />
            <DetailRow label="Email" value={member.email} />
            <DetailRow label="Tel" value={member.phone} />
            <DetailRow label="Status" value={member.status} />
            <DetailRow label="Created by" value={member.createdByName} />
            <DetailRow label="Updated by" value={member.updatedByName} />
          </dl>
        </div>

        {canEdit && onEdit && (
          <div className="border-t border-border p-5">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
            >
              <Pencil size={16} />
              Edit employee
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
