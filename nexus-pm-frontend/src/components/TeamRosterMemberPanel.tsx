import { Briefcase, Clock, Mail, MapPin, Pencil, User, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TeamRosterMember } from '@/api/teamRoster.api';
import { ResourceAvatar } from '@/components/ResourceAvatar';

interface TeamRosterMemberPanelProps {
  member: TeamRosterMember;
  canEdit?: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

function displayValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || '—';
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-text3">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-text">{displayValue(value)}</dd>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-bg3 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-accent/10 to-transparent px-4 py-2.5">
        <span className="text-accent">{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text2">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const active = (status ?? '').toUpperCase() === 'ACTIVE';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        active
          ? 'bg-success/15 text-success'
          : 'bg-danger/10 text-danger'
      }`}
    >
      {status ?? 'UNKNOWN'}
    </span>
  );
}

function SkillChips({ skills }: { skills?: string[] }) {
  if (!skills?.length) {
    return <p className="text-sm text-text3">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className="rounded-md border border-border bg-bg2 px-2 py-0.5 text-xs font-medium text-text"
        >
          {skill}
        </span>
      ))}
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
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l glass-panel">
        <div className="border-b border-border bg-gradient-to-br from-accent/10 via-bg2 to-bg2 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ResourceAvatar
                name={member.fullName}
                size="lg"
                imageUrl={member.profilePictureUrl}
              />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{member.fullName}</h2>
                <p className="text-sm text-text2">{subtitle}</p>
                <div className="mt-2">
                  <StatusBadge status={member.status} />
                </div>
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
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <SectionCard title="Role & assignment" icon={<Briefcase size={14} />}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Designation code" value={member.designationCode} />
              <DetailField label="Designation" value={member.designation} />
              <DetailField label="Team" value={member.teamName} />
              <DetailField label="Engineering manager" value={member.engineeringManagerName} />
              <DetailField label="Employment type" value={member.employmentType} />
            </dl>
          </SectionCard>

          <SectionCard title="Location & product" icon={<MapPin size={14} />}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="NTP/GBL" value={member.workType} />
              <DetailField label="Country" value={member.country} />
              <div className="sm:col-span-2">
                <DetailField label="Product" value={member.product} />
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Experience" icon={<Clock size={14} />}>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text3">Skills</p>
                <div className="mt-1.5">
                  <SkillChips skills={member.skillNames} />
                </div>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField
                  label="Total years of experience"
                  value={
                    member.totalYearsOfExperience != null
                      ? String(member.totalYearsOfExperience)
                      : null
                  }
                />
                <DetailField
                  label="Experience in DFN"
                  value={
                    member.experienceInDfn != null ? String(member.experienceInDfn) : null
                  }
                />
              </dl>
            </div>
          </SectionCard>

          <SectionCard title="Contact" icon={<Mail size={14} />}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Email" value={member.email} />
              <DetailField label="Tel" value={member.phone} />
            </dl>
          </SectionCard>

          {(member.createdByName || member.updatedByName) && (
            <SectionCard title="Audit" icon={<User size={14} />}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Created by" value={member.createdByName} />
                <DetailField label="Updated by" value={member.updatedByName} />
              </dl>
            </SectionCard>
          )}
        </div>

        {canEdit && onEdit && (
          <div className="border-t border-border p-5">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium hover:opacity-90"
              style={{ color: 'var(--accent-fg)' }}
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
