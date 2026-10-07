import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTeamManagement, useTeamRosterMembers } from '@/hooks/useTeamRoster';
import type { TeamManagement, TeamRosterMember } from '@/api/teamRoster.api';
import { isActiveRosterStatus } from '@/utils/rosterStatus';
import { fetchRosterWorkTypes } from '@/api/rosterLookups.api';
import {
  isCoeManagerTitle,
  isDeliveryManagerTitle,
  isEngineeringManagerRole,
  isVpRole,
  lineManagerIdsUnderVp,
  partitionManagersByType,
} from '@/utils/managementRoles';
import {
  classifyEngineerTrack,
  countByDesignationCode,
  countByTrackAndCode,
  normalizeDesignationCode,
  TRACK_LABELS,
  TRACK_ORDER,
} from '@/utils/designationLevels';
import {
  downloadOrgStatsExcel,
  downloadOrgStatsPdf,
  type OrgStatsExportTable,
  type SkillEmMatrixExport,
} from '@/utils/orgStructureStatsExport';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { TeamRosterMemberPanel } from '@/components/TeamRosterMemberPanel';

function normalizeName(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildManagementIndex(management: TeamManagement[]) {
  const byId = new Map(management.map((person) => [person.id, person]));
  return { byId };
}

function isStatsLineManager(roleTitle: string) {
  return (
    isEngineeringManagerRole(roleTitle) ||
    isDeliveryManagerTitle(roleTitle) ||
    isCoeManagerTitle(roleTitle)
  );
}

function matchesWorkType(member: TeamRosterMember, selected: string): boolean {
  if (!selected) return true;
  return (member.workType ?? '').trim().toLowerCase() === selected.trim().toLowerCase();
}

const PREFERRED_DEPARTMENTS = ['Engineering', 'Delivery', 'COE'];

type DepartmentPalette = {
  header: string;
  subheader: string;
  cell: string;
  total: string;
  border: string;
};

const DEPARTMENT_PALETTES: Record<string, DepartmentPalette> = {
  Engineering: {
    header: 'bg-[#cfe2f3] text-[#1e4e79]',
    subheader: 'bg-[#e2eef8] text-[#1e4e79]',
    cell: 'bg-[#f4f8fc]',
    total: 'bg-[#d9eaf6]',
    border: 'border-[#9dc3e6]',
  },
  Delivery: {
    header: 'bg-[#fce4c4] text-[#7a4a10]',
    subheader: 'bg-[#fff0dc] text-[#7a4a10]',
    cell: 'bg-[#fff8ee]',
    total: 'bg-[#fdebd3]',
    border: 'border-[#e8c48a]',
  },
  COE: {
    header: 'bg-[#d5eedd] text-[#1f5c3a]',
    subheader: 'bg-[#e8f6ed] text-[#1f5c3a]',
    cell: 'bg-[#f4fbf6]',
    total: 'bg-[#dcefdc]',
    border: 'border-[#a8d4b8]',
  },
};

const FALLBACK_PALETTES: DepartmentPalette[] = [
  {
    header: 'bg-[#e2d4f0] text-[#5b2d82]',
    subheader: 'bg-[#f0e8f8] text-[#5b2d82]',
    cell: 'bg-[#f8f4fc]',
    total: 'bg-[#eadff4]',
    border: 'border-[#c5a6e0]',
  },
  {
    header: 'bg-[#f8d0d8] text-[#8a1f3a]',
    subheader: 'bg-[#fbe4e8] text-[#8a1f3a]',
    cell: 'bg-[#fdf4f6]',
    total: 'bg-[#f6dce2]',
    border: 'border-[#e3a4b2]',
  },
  {
    header: 'bg-[#d4eef2] text-[#1a5c66]',
    subheader: 'bg-[#e6f5f8] text-[#1a5c66]',
    cell: 'bg-[#f3fafb]',
    total: 'bg-[#dceef2]',
    border: 'border-[#9fd0d8]',
  },
];

function departmentPalette(name: string, index: number): DepartmentPalette {
  return DEPARTMENT_PALETTES[name] ?? FALLBACK_PALETTES[index % FALLBACK_PALETTES.length];
}

function normalizeDepartmentLabel(name?: string | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (/\bcoe\b/.test(lower) || lower.includes('center of excellence') || lower.includes('centre of excellence')) {
    return 'COE';
  }
  if (lower.includes('delivery')) return 'Delivery';
  if (lower.includes('engineering')) return 'Engineering';
  return trimmed;
}

function managerForMember(
  member: TeamRosterMember,
  managementById: Map<string, TeamManagement>,
): TeamManagement | undefined {
  if (member.engineeringManagerManagementId) {
    const byId = managementById.get(member.engineeringManagerManagementId);
    if (byId) return byId;
  }
  const emName = normalizeName(member.engineeringManagerName);
  if (!emName) return undefined;
  for (const person of managementById.values()) {
    if (normalizeName(person.fullName) === emName) return person;
  }
  return undefined;
}

function memberDepartment(
  member: TeamRosterMember,
  managementById: Map<string, TeamManagement>,
): string {
  const manager = managerForMember(member, managementById);
  const title = manager?.roleTitle ?? '';
  if (isDeliveryManagerTitle(title)) return 'Delivery';
  if (isCoeManagerTitle(title)) return 'COE';

  const fromHr = normalizeDepartmentLabel(member.departmentName);
  if (fromHr) return fromHr;
  return 'Engineering';
}

function departmentGroups(
  members: TeamRosterMember[],
  managementById: Map<string, TeamManagement>,
): string[] {
  const present = new Set(members.map((member) => memberDepartment(member, managementById)));
  const preferred = PREFERRED_DEPARTMENTS.filter((name) => present.has(name));
  const rest = [...present]
    .filter((name) => !PREFERRED_DEPARTMENTS.includes(name))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return [...preferred, ...rest];
}

function membersInDepartment(
  members: TeamRosterMember[],
  department: string,
  managementById: Map<string, TeamManagement>,
): TeamRosterMember[] {
  return members.filter((member) => memberDepartment(member, managementById) === department);
}

function departmentCodesByGroup(
  members: TeamRosterMember[],
  groups: string[],
  managementById: Map<string, TeamManagement>,
): Record<string, string[]> {
  return Object.fromEntries(
    groups.map((group) => [
      group,
      countByDesignationCode(membersInDepartment(members, group, managementById)).codes,
    ]),
  );
}

function membersForManagerIds(
  members: TeamRosterMember[],
  managerIds: Set<string>,
  managementById: Map<string, TeamManagement>,
): TeamRosterMember[] {
  const managerNames = new Set<string>();
  for (const id of managerIds) {
    const person = managementById.get(id);
    if (person) managerNames.add(normalizeName(person.fullName));
  }

  return members.filter((member) => {
    if (member.engineeringManagerManagementId && managerIds.has(member.engineeringManagerManagementId)) {
      return true;
    }
    const emName = normalizeName(member.engineeringManagerName);
    return !!emName && managerNames.has(emName);
  });
}

/** skill → designation code → count (a person with N skills is counted under each). */
function countBySkillAndDesignation(
  members: TeamRosterMember[],
  skills: string[],
  codes: string[],
): Record<string, Record<string, number>> {
  const emptyCodes = (): Record<string, number> =>
    Object.fromEntries(codes.map((code) => [code, 0]));
  const bySkill: Record<string, Record<string, number>> = Object.fromEntries(
    skills.map((skill) => [skill, emptyCodes()]),
  );

  for (const member of members) {
    const code = normalizeDesignationCode(member.designationCode);
    if (!codes.includes(code)) continue;
    const names = (member.skillNames ?? []).map((n) => n.trim()).filter(Boolean);
    for (const skill of names) {
      if (!bySkill[skill]) continue;
      bySkill[skill][code] = (bySkill[skill][code] ?? 0) + 1;
    }
  }
  return bySkill;
}

type StatsPeopleDrill = {
  title: string;
  subtitle: string;
  members: TeamRosterMember[];
};

type StatsRow = {
  key: string;
  label: string;
  subLabel?: string;
  vpName?: string;
  counts: Record<string, number>;
  total: number;
  isGroup?: boolean;
  members: TeamRosterMember[];
};

function buildCategoryRows(members: TeamRosterMember[]): StatsRow[] {
  const byTrack = new Map<string, TeamRosterMember[]>();
  for (const member of members) {
    const track = classifyEngineerTrack(member);
    const list = byTrack.get(track) ?? [];
    list.push(member);
    byTrack.set(track, list);
  }
  return TRACK_ORDER.filter((track) => (byTrack.get(track)?.length ?? 0) > 0).map((track) => {
    const team = byTrack.get(track) ?? [];
    const { counts, total } = countByDesignationCode(team);
    return {
      key: track,
      label: TRACK_LABELS[track],
      counts,
      total,
      members: team,
    };
  });
}

const searchSelectClass =
  'mt-1 block w-full min-w-[11rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm';

function uniqueMembers(lists: TeamRosterMember[][]): TeamRosterMember[] {
  const byId = new Map<string, TeamRosterMember>();
  for (const list of lists) {
    for (const member of list) byId.set(member.id, member);
  }
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function membersWithCode(members: TeamRosterMember[], code: string): TeamRosterMember[] {
  return members
    .filter((m) => normalizeDesignationCode(m.designationCode) === code)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function membersWithSkillAndCode(
  members: TeamRosterMember[],
  skill: string,
  code: string,
): TeamRosterMember[] {
  return members
    .filter(
      (m) =>
        normalizeDesignationCode(m.designationCode) === code &&
        (m.skillNames ?? []).some((n) => n.trim() === skill),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function CountLink({
  value,
  emptyAsDash = false,
  onClick,
  className = '',
}: {
  value: number;
  emptyAsDash?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  if (!value) {
    return <span className={className}>{emptyAsDash ? '—' : ''}</span>;
  }
  if (!onClick) {
    return <span className={className}>{value}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title="View people"
      className={`cursor-pointer underline decoration-dotted underline-offset-2 hover:font-bold hover:decoration-solid focus:outline-none focus-visible:ring-1 focus-visible:ring-accent ${className}`}
    >
      {value}
    </button>
  );
}

/** Shared left gutter so designation codes line up; code columns flex to fill page width. */
const VP_COL = 'w-[10rem] min-w-[10rem]';
const EM_COL = 'w-[32rem] min-w-[32rem]';
/** Org / VP label = VP + EM so code columns stay aligned. */
const LABEL_COL = 'w-[42rem] min-w-[42rem]';
/** Narrower EM column when skill blocks take horizontal space. */
const SKILL_EM_COL = 'w-[14rem] min-w-[14rem]';
const SKILL_CODE_MIN = '2.6rem';
const GROUP_LABEL_COL = 'w-[14rem] min-w-[14rem]';
const CODE_COL = 'min-w-[3.5rem]';
const TOTAL_STICKY =
  'sticky right-0 z-[2] min-w-[4.75rem] bg-bg2 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.2)]';

function StatsTable({
  title,
  description,
  rowLabel,
  rows,
  codes,
  showVpColumn = false,
  columnGroups,
  codesByGroup,
  managementById,
  onOpenPeople,
}: {
  title: string;
  description: string;
  rowLabel: string;
  rows: StatsRow[];
  codes: string[];
  showVpColumn?: boolean;
  columnGroups?: string[];
  codesByGroup?: Record<string, string[]>;
  managementById?: Map<string, TeamManagement>;
  onOpenPeople?: (drill: StatsPeopleDrill) => void;
}) {
  const grouped = (columnGroups?.length ?? 0) > 0 && !!managementById;
  const groups = grouped ? columnGroups! : [];
  const codesFor = (group: string) => codesByGroup?.[group] ?? [];
  const byId = managementById ?? new Map<string, TeamManagement>();
  const detailRows = rows;
  const columnTotals = codes.map((code) =>
    detailRows.reduce((sum, row) => sum + (row.counts[code] ?? 0), 0),
  );
  const grandTotal = detailRows.reduce((sum, row) => sum + row.total, 0);

  const peopleIn = (members: TeamRosterMember[], group: string, code?: string) => {
    const inGroup = membersInDepartment(members, group, byId);
    return code ? membersWithCode(inGroup, code) : inGroup;
  };

  const openRowCode = (row: StatsRow, code: string, group?: string) => {
    if (!onOpenPeople) return;
    const people = group ? peopleIn(row.members, group, code) : membersWithCode(row.members, code);
    if (people.length === 0) return;
    onOpenPeople({
      title: row.label,
      subtitle: `${group ? `${group} · ` : ''}${code} · ${people.length} people`,
      members: people,
    });
  };

  const openRowTotal = (row: StatsRow) => {
    if (!onOpenPeople || row.members.length === 0) return;
    const people = [...row.members].sort((a, b) => a.fullName.localeCompare(b.fullName));
    onOpenPeople({
      title: row.label,
      subtitle: `All · ${people.length} people`,
      members: people,
    });
  };

  const openColumnTotal = (code: string, group?: string) => {
    if (!onOpenPeople) return;
    const people = uniqueMembers(
      detailRows.map((row) =>
        group ? peopleIn(row.members, group, code) : membersWithCode(row.members, code),
      ),
    );
    if (people.length === 0) return;
    onOpenPeople({
      title: `${title} · ${group ? `${group} · ` : ''}${code}`,
      subtitle: `Total · ${people.length} people`,
      members: people,
    });
  };

  const openGrandTotal = () => {
    if (!onOpenPeople) return;
    const people = uniqueMembers(detailRows.map((row) => row.members));
    if (people.length === 0) return;
    onOpenPeople({
      title: title,
      subtitle: `All · ${people.length} people`,
      members: people,
    });
  };

  const vpRowSpans: number[] = [];
  if (showVpColumn) {
    let i = 0;
    while (i < rows.length) {
      const vp = rows[i].vpName ?? '';
      let span = 1;
      while (i + span < rows.length && (rows[i + span].vpName ?? '') === vp) {
        span += 1;
      }
      vpRowSpans[i] = span;
      for (let j = 1; j < span; j++) vpRowSpans[i + j] = 0;
      i += span;
    }
  }

  if (rows.length === 0) {
    return (
      <section className="w-full space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
        <p className="text-sm text-text2">No data yet.</p>
      </section>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
      </div>
      <div className="w-full min-w-0 max-h-[min(62vh,38rem)] overflow-x-auto overflow-y-auto overscroll-x-contain rounded-xl border border-border">
        <table
          className={`${
            grouped ? 'w-full min-w-max' : 'w-full table-fixed'
          } border-collapse text-left text-sm`}
        >
          <colgroup>
            {showVpColumn ? (
              <>
                <col style={{ width: '10rem' }} />
                <col style={{ width: grouped ? '14rem' : '32rem' }} />
              </>
            ) : (
              <col style={{ width: grouped ? '14rem' : '42rem' }} />
            )}
            {(grouped
              ? groups.flatMap((group) => codesFor(group).map((code) => `${group}:${code}`))
              : codes
            ).map((key) => (
              <col key={key} style={grouped ? { minWidth: '3.5rem' } : undefined} />
            ))}
            <col style={{ width: '4.75rem', minWidth: '4.75rem' }} />
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-bg2">
            {grouped && (
              <tr className="text-text2">
                {showVpColumn ? (
                  <>
                    <th
                      rowSpan={2}
                      className={`sticky left-0 z-[3] border-b border-border bg-bg2 px-2 py-2 font-medium ${VP_COL}`}
                    >
                      VP
                    </th>
                    <th
                      rowSpan={2}
                      className={`sticky left-[10rem] z-[3] border-b border-border bg-bg2 px-2 py-2 font-medium ${SKILL_EM_COL}`}
                    >
                      {rowLabel}
                    </th>
                  </>
                ) : (
                  <th
                    rowSpan={2}
                    className={`sticky left-0 z-[3] min-w-[14rem] border-b border-border bg-bg2 px-3 py-2 font-medium ${GROUP_LABEL_COL}`}
                  >
                    {rowLabel}
                  </th>
                )}
                {groups.map((group, groupIndex) => {
                  const colors = departmentPalette(group, groupIndex);
                  return (
                    <th
                      key={group}
                      colSpan={Math.max(1, codesFor(group).length)}
                      className={`border-b border-l px-1 py-1.5 text-center font-semibold ${colors.header} ${colors.border}`}
                    >
                      {group}
                    </th>
                  );
                })}
                <th
                  rowSpan={2}
                  className={`border-b border-l border-border px-2 py-2 text-center font-semibold ${TOTAL_STICKY}`}
                >
                  Total
                </th>
              </tr>
            )}
            <tr className="border-b border-border text-text2">
              {!grouped &&
                (showVpColumn ? (
                  <>
                    <th className={`sticky left-0 z-[2] bg-bg2 px-2 py-2 font-medium ${VP_COL}`}>VP</th>
                    <th
                      className={`sticky left-[10rem] z-[2] bg-bg2 px-2 py-2 font-medium ${EM_COL}`}
                    >
                      {rowLabel}
                    </th>
                  </>
                ) : (
                  <th className={`sticky left-0 z-[2] bg-bg2 px-3 py-2 font-medium ${LABEL_COL}`}>
                    {rowLabel}
                  </th>
                ))}
              {grouped
                ? groups.flatMap((group, groupIndex) => {
                    const colors = departmentPalette(group, groupIndex);
                    return codesFor(group).map((code) => (
                      <th
                        key={`${group}:${code}`}
                        className={`border-l px-1 py-1 text-center font-medium uppercase ${CODE_COL} ${colors.subheader} ${colors.border}`}
                        title={`${group} · ${code}`}
                      >
                        {code}
                      </th>
                    ));
                  })
                : codes.map((code) => (
                    <th
                      key={code}
                      className="px-1 py-2 text-center font-medium uppercase"
                      title={code}
                    >
                      <span className="block truncate">{code}</span>
                    </th>
                  ))}
              {!grouped && <th className="px-2 py-2 text-center font-semibold">Total</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.key}
                className={`border-b border-border/70 ${
                  row.isGroup ? 'bg-bg2/70 font-semibold' : 'hover:bg-bg2/40'
                }`}
              >
                {showVpColumn ? (
                  <>
                    {(vpRowSpans[index] ?? 0) > 0 && (
                      <td
                        rowSpan={vpRowSpans[index]}
                        className={`sticky left-0 z-[1] border-r border-border px-2 py-2 align-middle font-semibold ${VP_COL} ${
                          row.isGroup ? 'bg-bg2/70' : 'bg-bg'
                        }`}
                      >
                        <span className="block break-words text-xs leading-snug">
                          {row.vpName || '—'}
                        </span>
                      </td>
                    )}
                    <td
                      className={`sticky left-[10rem] z-[1] px-2 py-2 ${grouped ? SKILL_EM_COL : EM_COL} ${
                        row.isGroup ? 'bg-bg2/70 font-semibold' : 'bg-bg font-medium'
                      }`}
                    >
                      <div className="break-words text-xs leading-snug">{row.label}</div>
                      {row.subLabel && (
                        <div className="text-[10px] font-normal leading-snug text-text2 break-words">
                          {row.subLabel}
                        </div>
                      )}
                    </td>
                  </>
                ) : (
                  <td
                    className={`sticky left-0 z-[1] px-3 py-2 ${grouped ? `${GROUP_LABEL_COL} bg-bg` : LABEL_COL} ${
                      row.isGroup ? 'bg-bg2/70 font-semibold' : 'bg-bg font-medium'
                    }`}
                  >
                    <div className="break-words">{row.label}</div>
                    {row.subLabel && (
                      <div className="text-xs font-normal text-text2 break-words">{row.subLabel}</div>
                    )}
                  </td>
                )}
                {grouped
                  ? groups.flatMap((group, groupIndex) => {
                      const colors = departmentPalette(group, groupIndex);
                      return codesFor(group).map((code) => {
                        const people = peopleIn(row.members, group, code);
                        return (
                          <td
                            key={`${row.key}:${group}:${code}`}
                            className={`border-l px-1 py-1.5 text-center tabular-nums text-text2 ${CODE_COL} ${colors.cell} ${colors.border}`}
                          >
                            <CountLink
                              value={people.length}
                              emptyAsDash
                              onClick={
                                onOpenPeople ? () => openRowCode(row, code, group) : undefined
                              }
                            />
                          </td>
                        );
                      });
                    })
                  : codes.map((code) => (
                      <td key={code} className="px-1 py-2 text-center tabular-nums text-text2">
                        <CountLink
                          value={row.counts[code] ?? 0}
                          emptyAsDash
                          onClick={onOpenPeople ? () => openRowCode(row, code) : undefined}
                        />
                      </td>
                    ))}
                <td
                  className={`px-2 py-2 text-center font-semibold tabular-nums ${
                    grouped ? `${TOTAL_STICKY} border-l border-border` : ''
                  }`}
                >
                  <CountLink
                    value={row.total}
                    onClick={onOpenPeople ? () => openRowTotal(row) : undefined}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-bg2/80 font-semibold">
              {showVpColumn ? (
                <>
                  <td className={`sticky left-0 bg-bg2 px-2 py-2 ${VP_COL}`} />
                  <td className={`sticky left-[10rem] bg-bg2 px-2 py-2 ${grouped ? SKILL_EM_COL : EM_COL}`}>
                    Total
                  </td>
                </>
              ) : (
                <td className={`sticky left-0 bg-bg2 px-3 py-2 ${grouped ? GROUP_LABEL_COL : LABEL_COL}`}>
                  Total
                </td>
              )}
              {grouped
                ? groups.flatMap((group, groupIndex) => {
                    const colors = departmentPalette(group, groupIndex);
                    return codesFor(group).map((code) => {
                      const people = uniqueMembers(
                        detailRows.map((row) => peopleIn(row.members, group, code)),
                      );
                      return (
                        <td
                          key={`total:${group}:${code}`}
                          className={`border-l px-1 py-1.5 text-center tabular-nums ${CODE_COL} ${colors.total} ${colors.border}`}
                        >
                          <CountLink
                            value={people.length}
                            emptyAsDash
                            onClick={
                              onOpenPeople ? () => openColumnTotal(code, group) : undefined
                            }
                          />
                        </td>
                      );
                    });
                  })
                : columnTotals.map((value, i) => (
                    <td key={codes[i]} className="px-1 py-2 text-center tabular-nums">
                      <CountLink
                        value={value}
                        emptyAsDash
                        onClick={onOpenPeople ? () => openColumnTotal(codes[i]) : undefined}
                      />
                    </td>
                  ))}
              <td
                className={`px-2 py-2 text-center tabular-nums ${
                  grouped ? `${TOTAL_STICKY} border-l border-border` : ''
                }`}
              >
                <CountLink
                  value={grandTotal}
                  onClick={onOpenPeople ? openGrandTotal : undefined}
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

type SkillEmMatrixRow = {
  key: string;
  emName: string;
  vpName: string;
  subLabel?: string;
  bySkill: Record<string, Record<string, number>>;
  headcount: number;
  isGroup?: boolean;
  members: TeamRosterMember[];
};

/**
 * Spreadsheet-style matrix: VP | EM | [Skill → designation codes…] | Total headcount.
 * Matches DirectFN skill capacity layout (e.g. OMS blocks of SE/SSE/…).
 */
function SkillEmMatrixTable({
  title,
  description,
  skills,
  codes,
  rows,
  onOpenPeople,
}: {
  title: string;
  description: string;
  skills: string[];
  codes: string[];
  rows: SkillEmMatrixRow[];
  onOpenPeople?: (drill: StatsPeopleDrill) => void;
}) {
  const detailRows = rows;

  const vpRowSpans: number[] = [];
  {
    let i = 0;
    while (i < rows.length) {
      const vp = rows[i].vpName;
      let span = 1;
      while (i + span < rows.length && rows[i + span].vpName === vp) {
        span += 1;
      }
      vpRowSpans[i] = span;
      for (let j = 1; j < span; j++) vpRowSpans[i + j] = 0;
      i += span;
    }
  }

  const columnTotals = skills.map((skill) =>
    codes.map((code) =>
      detailRows.reduce((sum, row) => sum + (row.bySkill[skill]?.[code] ?? 0), 0),
    ),
  );
  const grandHeadcount = detailRows.reduce((sum, row) => sum + row.headcount, 0);

  const openCell = (row: SkillEmMatrixRow, skill: string, code: string) => {
    if (!onOpenPeople) return;
    const people = membersWithSkillAndCode(row.members, skill, code);
    if (people.length === 0) return;
    onOpenPeople({
      title: row.emName,
      subtitle: `${skill} · ${code} · ${people.length} people`,
      members: people,
    });
  };

  const openRowTotal = (row: SkillEmMatrixRow) => {
    if (!onOpenPeople || row.members.length === 0) return;
    const people = [...row.members].sort((a, b) => a.fullName.localeCompare(b.fullName));
    onOpenPeople({
      title: row.emName,
      subtitle: `All · ${people.length} people`,
      members: people,
    });
  };

  const openColumnTotal = (skill: string, code: string) => {
    if (!onOpenPeople) return;
    const people = uniqueMembers(
      detailRows.map((row) => membersWithSkillAndCode(row.members, skill, code)),
    );
    if (people.length === 0) return;
    onOpenPeople({
      title: `${skill} · ${code}`,
      subtitle: `Total · ${people.length} people`,
      members: people,
    });
  };

  const openGrandTotal = () => {
    if (!onOpenPeople) return;
    const people = uniqueMembers(detailRows.map((row) => row.members));
    if (people.length === 0) return;
    onOpenPeople({
      title,
      subtitle: `All · ${people.length} people`,
      members: people,
    });
  };

  if (skills.length === 0) {
    return (
      <section className="w-full space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
        <p className="text-sm text-text2">
          No skills on the roster yet. Assign skills under Team → Engineers (or Admin → Skills).
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="w-full space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
        <p className="text-sm text-text2">No data yet.</p>
      </section>
    );
  }

  return (
    <section className="w-full space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
      </div>
      <div className="w-full max-h-[min(50vh,28rem)] overflow-auto rounded-xl border border-border">
        <table className="min-w-max border-collapse text-left text-[11px]">
          <thead className="sticky top-0 z-[1]">
            <tr className="bg-[#d9e1f2] text-[#1c1c1c]">
              <th
                rowSpan={2}
                className={`sticky left-0 z-[3] border border-[#b8b4aa] bg-[#d9e1f2] px-2 py-1.5 align-middle font-semibold ${VP_COL}`}
              >
                VP
              </th>
              <th
                rowSpan={2}
                className={`sticky left-[10rem] z-[3] border border-[#b8b4aa] bg-[#d9e1f2] px-2 py-1.5 align-middle font-semibold ${SKILL_EM_COL}`}
              >
                EM
              </th>
              {skills.map((skill) => (
                <th
                  key={skill}
                  colSpan={codes.length}
                  className="border border-[#b8b4aa] bg-[#d9e1f2] px-1 py-1.5 text-center font-semibold"
                  title={skill}
                >
                  <span className="block truncate px-1">{skill}</span>
                </th>
              ))}
              <th
                rowSpan={2}
                className="border border-[#b8b4aa] bg-[#d9e1f2] px-2 py-1.5 text-center align-middle font-semibold"
              >
                Total
              </th>
            </tr>
            <tr className="bg-[#d9e1f2] text-[#1c1c1c]">
              {skills.map((skill) =>
                codes.map((code) => (
                  <th
                    key={`${skill}:${code}`}
                    className="border border-[#b8b4aa] bg-[#e8eef8] px-0.5 py-1 text-center font-medium uppercase"
                    style={{ minWidth: SKILL_CODE_MIN, width: SKILL_CODE_MIN }}
                    title={`${skill} · ${code}`}
                  >
                    {code}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.key}
                className={`hover:bg-[#f5f8fc] ${row.isGroup ? 'bg-bg2/70 font-semibold' : ''}`}
              >
                {(vpRowSpans[index] ?? 0) > 0 && (
                  <td
                    rowSpan={vpRowSpans[index]}
                    className={`sticky left-0 z-[1] border border-[#b8b4aa] bg-bg px-2 py-1.5 align-middle font-semibold ${VP_COL}`}
                  >
                    <span className="block break-words text-xs leading-snug">
                      {row.vpName || '—'}
                    </span>
                  </td>
                )}
                <td
                  className={`sticky left-[10rem] z-[1] border border-[#b8b4aa] bg-bg px-2 py-1.5 ${SKILL_EM_COL}`}
                >
                  <div className="break-words text-xs font-medium leading-snug">{row.emName}</div>
                  {row.subLabel && (
                    <div className="text-[10px] font-normal leading-snug text-text2 break-words">
                      {row.subLabel}
                    </div>
                  )}
                </td>
                {skills.map((skill) =>
                  codes.map((code) => {
                    const n = row.bySkill[skill]?.[code] ?? 0;
                    return (
                      <td
                        key={`${row.key}:${skill}:${code}`}
                        className="border border-[#b8b4aa] px-0.5 py-1 text-center tabular-nums text-text2"
                      >
                        <CountLink
                          value={n}
                          onClick={onOpenPeople ? () => openCell(row, skill, code) : undefined}
                        />
                      </td>
                    );
                  }),
                )}
                <td className="border border-[#b8b4aa] px-2 py-1 text-center font-semibold tabular-nums">
                  <CountLink
                    value={row.headcount}
                    onClick={onOpenPeople ? () => openRowTotal(row) : undefined}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1e3a5f] font-semibold text-white">
              <td
                className={`sticky left-0 z-[1] border border-[#16304f] bg-[#1e3a5f] px-2 py-1.5 text-white ${VP_COL}`}
              >
                Total
              </td>
              <td
                className={`sticky left-[10rem] z-[1] border border-[#16304f] bg-[#1e3a5f] px-2 py-1.5 text-white ${SKILL_EM_COL}`}
              />
              {columnTotals.map((skillTotals, skillIdx) =>
                skillTotals.map((value, codeIdx) => (
                  <td
                    key={`total:${skills[skillIdx]}:${codes[codeIdx]}`}
                    className="border border-[#16304f] bg-[#1e3a5f] px-0.5 py-1 text-center tabular-nums text-white"
                  >
                    <CountLink
                      value={value}
                      className="text-white"
                      onClick={
                        onOpenPeople
                          ? () => openColumnTotal(skills[skillIdx], codes[codeIdx])
                          : undefined
                      }
                    />
                  </td>
                )),
              )}
              <td className="border border-[#16304f] bg-[#1e3a5f] px-2 py-1 text-center tabular-nums text-white">
                <CountLink
                  value={grandHeadcount}
                  className="text-white"
                  onClick={onOpenPeople ? openGrandTotal : undefined}
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function OrgStructureStats() {
  const { data: managementRows = [], isLoading: managementLoading } = useTeamManagement();
  const { data: memberRows = [], isLoading: membersLoading } = useTeamRosterMembers();
  const management = useMemo(
    () => managementRows.filter((person) => isActiveRosterStatus(person.status)),
    [managementRows],
  );
  const members = useMemo(
    () => memberRows.filter((member) => isActiveRosterStatus(member.status)),
    [memberRows],
  );
  const { data: workTypes = [] } = useQuery({
    queryKey: ['roster-work-types'],
    queryFn: fetchRosterWorkTypes,
  });
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [statsTab, setStatsTab] = useState<'levels' | 'skills' | 'search'>('levels');
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [searchVpId, setSearchVpId] = useState('');
  const [searchEmId, setSearchEmId] = useState('');
  const [searchDepartment, setSearchDepartment] = useState('');
  const [searchDesignation, setSearchDesignation] = useState('');
  const [peopleDrill, setPeopleDrill] = useState<StatsPeopleDrill | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamRosterMember | null>(null);

  const { byId } = useMemo(() => buildManagementIndex(management), [management]);

  const workTypeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const workType of workTypes) {
      const name = workType.name.trim();
      if (name) names.add(name);
    }
    for (const member of members) {
      const name = (member.workType ?? '').trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [workTypes, members]);

  const activeMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          (!m.status || m.status.toUpperCase() === 'ACTIVE') && matchesWorkType(m, workTypeFilter),
      ),
    [members, workTypeFilter],
  );
  const hideEmptyTeams = !!workTypeFilter;

  const deptLayout = useMemo(() => {
    const groups = departmentGroups(activeMembers, byId);
    const codesByGroup = departmentCodesByGroup(activeMembers, groups, byId);
    return {
      groups: groups.filter((group) => (codesByGroup[group]?.length ?? 0) > 0),
      codesByGroup,
    };
  }, [activeMembers, byId]);
  const deptGroups = deptLayout.groups;
  const deptCodesByGroup = deptLayout.codesByGroup;

  /** Same engineer designation columns for all three grids (software ladder, then QA). */
  const alignedCodes = useMemo(() => {
    const { codes } = countByDesignationCode(activeMembers);
    return codes;
  }, [activeMembers]);

  const orgRows = useMemo(() => buildCategoryRows(activeMembers), [activeMembers]);

  const searchVpOptions = useMemo(
    () =>
      management
        .filter((person) => person.status === 'ACTIVE' && isVpRole(person.roleTitle))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [management],
  );

  const searchManagerOptions = useMemo(() => {
    let list = management.filter(
      (person) => person.status === 'ACTIVE' && isStatsLineManager(person.roleTitle),
    );
    if (searchVpId) {
      const allowed = lineManagerIdsUnderVp(management, searchVpId);
      list = list.filter((person) => allowed.has(person.id));
    }
    return list.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [management, searchVpId]);

  const searchManagerGroups = useMemo(
    () => partitionManagersByType(searchManagerOptions),
    [searchManagerOptions],
  );

  const searchDesignationOptions = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const member of activeMembers) {
      const code = normalizeDesignationCode(member.designationCode);
      if (!byCode.has(code)) {
        byCode.set(code, member.designation?.trim() || code);
      }
    }
    return [...byCode.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, name]) => ({ code, name }));
  }, [activeMembers]);

  useEffect(() => {
    if (!searchEmId) return;
    if (!searchManagerOptions.some((person) => person.id === searchEmId)) {
      setSearchEmId('');
    }
  }, [searchEmId, searchManagerOptions]);

  const searchMembers = useMemo(() => {
    let list = activeMembers;
    if (searchVpId) {
      const managerIds = lineManagerIdsUnderVp(management, searchVpId);
      managerIds.add(searchVpId);
      list = membersForManagerIds(list, managerIds, byId);
    }
    if (searchEmId) {
      list = membersForManagerIds(list, new Set([searchEmId]), byId);
    }
    if (searchDepartment) {
      list = list.filter((member) => memberDepartment(member, byId) === searchDepartment);
    }
    if (searchDesignation) {
      list = list.filter(
        (member) => normalizeDesignationCode(member.designationCode) === searchDesignation,
      );
    }
    return list;
  }, [
    activeMembers,
    searchVpId,
    searchEmId,
    searchDepartment,
    searchDesignation,
    management,
    byId,
  ]);

  const searchOrgRows = useMemo(() => buildCategoryRows(searchMembers), [searchMembers]);

  const searchDeptLayout = useMemo(() => {
    const groups = departmentGroups(searchMembers, byId);
    const codesByGroup = departmentCodesByGroup(searchMembers, groups, byId);
    return {
      groups: groups.filter((group) => (codesByGroup[group]?.length ?? 0) > 0),
      codesByGroup,
    };
  }, [searchMembers, byId]);
  const searchAlignedCodes = useMemo(
    () => countByDesignationCode(searchMembers).codes,
    [searchMembers],
  );

  const searchHasFilters = !!(searchVpId || searchEmId || searchDepartment || searchDesignation);

  const vpStats = useMemo(() => {
    const vps = management
      .filter((person) => person.status === 'ACTIVE' && isVpRole(person.roleTitle))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const rows: StatsRow[] = [];
    const assignedIds = new Set<string>();

    for (const vp of vps) {
      const emIds = lineManagerIdsUnderVp(management, vp.id);
      const team = membersForManagerIds(activeMembers, emIds, byId);
      if (hideEmptyTeams && team.length === 0) continue;
      for (const member of team) assignedIds.add(member.id);

      const { counts, total } = countByDesignationCode(team);
      const byTrack = countByTrackAndCode(team);
      rows.push({
        key: vp.id,
        label: vp.fullName,
        subLabel: [vp.roleTitle, ...byTrack.tracks.map((t) => `${t.label}: ${t.total}`)].join(' · '),
        counts,
        total,
        members: team,
      });
    }

    const unassigned = activeMembers.filter((m) => !assignedIds.has(m.id));
    if (unassigned.length > 0) {
      const { counts, total } = countByDesignationCode(unassigned);
      const byTrack = countByTrackAndCode(unassigned);
      rows.push({
        key: 'unassigned',
        label: 'Unassigned / outside VP trees',
        subLabel: byTrack.tracks.map((t) => `${t.label}: ${t.total}`).join(' · '),
        counts,
        total,
        members: unassigned,
      });
    }

    return rows;
  }, [management, activeMembers, byId, hideEmptyTeams]);

  const emStats = useMemo(() => {
    const vps = management
      .filter((person) => person.status === 'ACTIVE' && isVpRole(person.roleTitle))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const ems = management.filter(
      (person) => person.status === 'ACTIVE' && isStatsLineManager(person.roleTitle),
    );

    const rows: StatsRow[] = [];
    const coveredEmIds = new Set<string>();
    const coveredMemberIds = new Set<string>();

    for (const vp of vps) {
      const emIds = lineManagerIdsUnderVp(management, vp.id);
      const vpEms = ems
        .filter((em) => emIds.has(em.id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      if (vpEms.length === 0) continue;

      for (const em of vpEms) {
        coveredEmIds.add(em.id);
        const team = membersForManagerIds(activeMembers, new Set([em.id]), byId);
        for (const member of team) coveredMemberIds.add(member.id);
        if (hideEmptyTeams && team.length === 0) continue;

        const { counts, total } = countByDesignationCode(team);
        const byTrack = countByTrackAndCode(team);

        rows.push({
          key: em.id,
          label: em.fullName,
          vpName: vp.fullName,
          subLabel: [em.roleTitle, ...byTrack.tracks.map((t) => `${t.label}: ${t.total}`)].join(
            ' · ',
          ),
          counts,
          total,
          members: team,
        });
      }
    }

    const orphanEms = ems
      .filter((em) => !coveredEmIds.has(em.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    for (const em of orphanEms) {
      const team = membersForManagerIds(activeMembers, new Set([em.id]), byId);
      for (const member of team) coveredMemberIds.add(member.id);
      if (hideEmptyTeams && team.length === 0) continue;
      const { counts, total } = countByDesignationCode(team);
      const byTrack = countByTrackAndCode(team);
      rows.push({
        key: em.id,
        label: em.fullName,
        vpName: 'No VP linked',
        subLabel: [em.roleTitle, ...byTrack.tracks.map((t) => `${t.label}: ${t.total}`)].join(
          ' · ',
        ),
        counts,
        total,
        members: team,
      });
    }

    const orphanedMembers = activeMembers.filter((m) => !coveredMemberIds.has(m.id));
    if (orphanedMembers.length > 0) {
      const { counts, total } = countByDesignationCode(orphanedMembers);
      const byTrack = countByTrackAndCode(orphanedMembers);
      rows.push({
        key: 'no-em',
        label: 'No EM linked',
        vpName: '—',
        subLabel: byTrack.tracks.map((t) => `${t.label}: ${t.total}`).join(' · '),
        counts,
        total,
        isGroup: true,
        members: orphanedMembers,
      });
    }

    return rows;
  }, [management, activeMembers, byId, hideEmptyTeams]);

  /** Skills present on the active roster (column groups). */
  const skillNames = useMemo(() => {
    const set = new Set<string>();
    for (const member of activeMembers) {
      for (const name of member.skillNames ?? []) {
        const trimmed = name.trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [activeMembers]);

  /**
   * Same EM×VP rows as EM level, but each skill is a block of designation columns
   * (spreadsheet-style OMS / skill capacity matrix).
   */
  const skillEmMatrix = useMemo(() => {
    const vps = management
      .filter((person) => person.status === 'ACTIVE' && isVpRole(person.roleTitle))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const ems = management.filter(
      (person) => person.status === 'ACTIVE' && isStatsLineManager(person.roleTitle),
    );

    const rows: SkillEmMatrixRow[] = [];
    const coveredEmIds = new Set<string>();
    const coveredMemberIds = new Set<string>();

    for (const vp of vps) {
      const emIds = lineManagerIdsUnderVp(management, vp.id);
      const vpEms = ems
        .filter((em) => emIds.has(em.id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      for (const em of vpEms) {
        coveredEmIds.add(em.id);
        const team = membersForManagerIds(activeMembers, new Set([em.id]), byId);
        for (const member of team) coveredMemberIds.add(member.id);
        if (hideEmptyTeams && team.length === 0) continue;
        const byTrack = countByTrackAndCode(team);
        rows.push({
          key: em.id,
          emName: em.fullName,
          vpName: vp.fullName,
          subLabel: [em.roleTitle, ...byTrack.tracks.map((t) => `${t.label}: ${t.total}`)].join(
            ' · ',
          ),
          bySkill: countBySkillAndDesignation(team, skillNames, alignedCodes),
          headcount: team.length,
          members: team,
        });
      }
    }

    const orphanEms = ems
      .filter((em) => !coveredEmIds.has(em.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    for (const em of orphanEms) {
      const team = membersForManagerIds(activeMembers, new Set([em.id]), byId);
      for (const member of team) coveredMemberIds.add(member.id);
      if (hideEmptyTeams && team.length === 0) continue;
      const byTrack = countByTrackAndCode(team);
      rows.push({
        key: em.id,
        emName: em.fullName,
        vpName: 'No VP linked',
        subLabel: [em.roleTitle, ...byTrack.tracks.map((t) => `${t.label}: ${t.total}`)].join(
          ' · ',
        ),
        bySkill: countBySkillAndDesignation(team, skillNames, alignedCodes),
        headcount: team.length,
        members: team,
      });
    }

    const orphanedMembers = activeMembers.filter((m) => !coveredMemberIds.has(m.id));
    if (orphanedMembers.length > 0) {
      const byTrack = countByTrackAndCode(orphanedMembers);
      rows.push({
        key: 'no-em',
        emName: 'No EM linked',
        vpName: '—',
        subLabel: byTrack.tracks.map((t) => `${t.label}: ${t.total}`).join(' · '),
        bySkill: countBySkillAndDesignation(orphanedMembers, skillNames, alignedCodes),
        headcount: orphanedMembers.length,
        isGroup: true,
        members: orphanedMembers,
      });
    }

    return rows;
  }, [management, activeMembers, byId, skillNames, alignedCodes, hideEmptyTeams]);

  /** One row per skill — designation counts of people who have that skill. */
  const skillStats = useMemo(() => {
    const bySkill = new Map<string, TeamRosterMember[]>();
    const noSkill: TeamRosterMember[] = [];

    for (const member of activeMembers) {
      const names = (member.skillNames ?? []).map((name) => name.trim()).filter(Boolean);
      if (names.length === 0) {
        noSkill.push(member);
        continue;
      }
      for (const name of names) {
        const list = bySkill.get(name) ?? [];
        list.push(member);
        bySkill.set(name, list);
      }
    }

    const rows: StatsRow[] = [...bySkill.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([skillName, team]) => {
        const { counts, total } = countByDesignationCode(team);
        const byTrack = countByTrackAndCode(team);
        return {
          key: `skill:${skillName}`,
          label: skillName,
          subLabel: byTrack.tracks.map((t) => `${t.label}: ${t.total}`).join(' · '),
          counts,
          total,
          members: team,
        };
      });

    if (noSkill.length > 0) {
      const { counts, total } = countByDesignationCode(noSkill);
      const byTrack = countByTrackAndCode(noSkill);
      rows.push({
        key: 'no-skill',
        label: 'No skill linked',
        subLabel: byTrack.tracks.map((t) => `${t.label}: ${t.total}`).join(' · '),
        counts,
        total,
        isGroup: true,
        members: noSkill,
      });
    }

    return rows;
  }, [activeMembers]);

  if (managementLoading || membersLoading) {
    return <p className="text-text2">Loading stats…</p>;
  }

  const exportTables = (): OrgStatsExportTable[] => {
    const toExportRows = (
      rows: StatsRow[],
      groups: string[],
      codesByGroup: Record<string, string[]>,
    ): OrgStatsExportTable['rows'] =>
      rows.map((row) => ({
        label: row.label,
        subLabel: row.subLabel,
        vpName: row.vpName,
        counts: row.counts,
        total: row.total,
        groupCounts: Object.fromEntries(
          groups.map((group) => [
            group,
            Object.fromEntries(
              (codesByGroup[group] ?? []).map((code) => [
                code,
                membersWithCode(membersInDepartment(row.members, group, byId), code).length,
              ]),
            ),
          ]),
        ),
      }));

    if (statsTab === 'search') {
      const { codes } = countByDesignationCode(searchMembers);
      return [
        {
          title: 'Search',
          primaryLabel: 'Category',
          secondaryLabel: '',
          codes,
          columnGroups: searchDeptLayout.groups,
          codesByGroup: searchDeptLayout.codesByGroup,
          rows: toExportRows(searchOrgRows, searchDeptLayout.groups, searchDeptLayout.codesByGroup),
        },
      ];
    }

    return [
      {
        title: 'Organization level',
        primaryLabel: 'Category',
        secondaryLabel: '',
        codes: alignedCodes,
        columnGroups: deptGroups,
        codesByGroup: deptCodesByGroup,
        rows: toExportRows(orgRows, deptGroups, deptCodesByGroup),
      },
      {
        title: 'VP level',
        primaryLabel: 'VP',
        secondaryLabel: '',
        codes: alignedCodes,
        columnGroups: deptGroups,
        codesByGroup: deptCodesByGroup,
        rows: toExportRows(vpStats, deptGroups, deptCodesByGroup),
      },
      {
        title: 'EM level',
        primaryLabel: 'VP',
        secondaryLabel: 'EM',
        codes: alignedCodes,
        columnGroups: deptGroups,
        codesByGroup: deptCodesByGroup,
        rows: toExportRows(emStats, deptGroups, deptCodesByGroup),
        includeVpColumn: true,
      },
      {
        title: 'Skill level',
        primaryLabel: 'Skill',
        secondaryLabel: '',
        codes: alignedCodes,
        rows: skillStats,
      },
    ];
  };

  const skillMatrixExport = (): SkillEmMatrixExport => ({
    title: 'Skill matrix by EM',
    skills: skillNames,
    codes: alignedCodes,
    rows: skillEmMatrix.map((row) => ({
      vpName: row.vpName,
      emName: row.emName,
      subLabel: row.subLabel,
      bySkill: row.bySkill,
      headcount: row.headcount,
    })),
  });

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExportError(null);
    setExporting(format);
    try {
      const tables = exportTables();
      const skillMatrix = statsTab === 'search' ? undefined : skillMatrixExport();
      if (format === 'excel') await downloadOrgStatsExcel(tables, skillMatrix);
      else downloadOrgStatsPdf(tables, skillMatrix);
    } catch (err) {
      console.error(err);
      setExportError('Could not export stats. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-border bg-bg3 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setStatsTab('levels')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statsTab === 'levels' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
              }`}
            >
              Levels
            </button>
            <button
              type="button"
              onClick={() => setStatsTab('skills')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statsTab === 'skills' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
              }`}
            >
              Skills
            </button>
            <button
              type="button"
              onClick={() => setStatsTab('search')}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                statsTab === 'search' ? 'bg-bg2 text-text shadow-sm' : 'text-text2 hover:text-text'
              }`}
            >
              Search
            </button>
          </div>
          <label className="inline-flex items-center overflow-hidden rounded-full border border-accent/40 bg-bg text-sm">
            <span className="border-r border-border bg-bg3 px-3 py-1.5 text-text2">NTP/GBL</span>
            <span className="relative inline-flex items-center">
              <select
                value={workTypeFilter}
                onChange={(e) => setWorkTypeFilter(e.target.value)}
                aria-label="Filter by NTP/GBL"
                className="min-w-[9rem] cursor-pointer appearance-none bg-transparent py-1.5 pl-3 pr-8 font-medium text-accent focus:outline-none"
              >
                <option value="">All NTP/GBL</option>
                {workTypeOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 text-accent"
              />
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Download size={14} className="text-text2" />
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => handleExport('excel')}
            className="text-accent hover:underline disabled:opacity-50"
          >
            {exporting === 'excel' ? 'Preparing…' : 'Excel'}
          </button>
          <span className="text-text2">/</span>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => handleExport('pdf')}
            className="text-accent hover:underline disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
        </div>
      </div>

      {exportError && <p className="text-sm text-danger">{exportError}</p>}

      {statsTab === 'search' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-bg2 p-4">
            <label className="min-w-[11rem] flex-1 text-sm sm:max-w-[16rem]">
              <span className="text-text2">Search by VP</span>
              <select
                value={searchVpId}
                onChange={(e) => setSearchVpId(e.target.value)}
                className={searchSelectClass}
              >
                <option value="">All VPs</option>
                {searchVpOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[11rem] flex-1 text-sm sm:max-w-[16rem]">
              <span className="text-text2">Search by Engineering Manager</span>
              <select
                value={searchEmId}
                onChange={(e) => setSearchEmId(e.target.value)}
                className={searchSelectClass}
              >
                <option value="">All managers</option>
                {searchManagerGroups.engineering.length > 0 && (
                  <optgroup label="Engineering managers">
                    {searchManagerGroups.engineering.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {searchManagerGroups.delivery.length > 0 && (
                  <optgroup label="Delivery managers">
                    {searchManagerGroups.delivery.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {searchManagerGroups.coe.length > 0 && (
                  <optgroup label="COE managers">
                    {searchManagerGroups.coe.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {searchManagerGroups.other.length > 0 && (
                  <optgroup label="Other managers">
                    {searchManagerGroups.other.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            <label className="min-w-[11rem] flex-1 text-sm sm:max-w-[16rem]">
              <span className="text-text2">Search by department</span>
              <select
                value={searchDepartment}
                onChange={(e) => setSearchDepartment(e.target.value)}
                className={searchSelectClass}
              >
                <option value="">All departments</option>
                {deptGroups.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[11rem] flex-1 text-sm sm:max-w-[16rem]">
              <span className="text-text2">Search by designation</span>
              <select
                value={searchDesignation}
                onChange={(e) => setSearchDesignation(e.target.value)}
                className={searchSelectClass}
              >
                <option value="">All designations</option>
                {searchDesignationOptions.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code === item.name ? item.code : `${item.code} — ${item.name}`}
                  </option>
                ))}
              </select>
            </label>
            {searchHasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchVpId('');
                  setSearchEmId('');
                  setSearchDepartment('');
                  setSearchDesignation('');
                }}
                className="mb-0.5 text-sm text-accent hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <StatsTable
            title="Organization level"
            description={`${searchMembers.length} people matching the current search. Designation codes under each department.`}
            rowLabel="Category"
            rows={searchOrgRows}
            codes={searchAlignedCodes}
            columnGroups={searchDeptLayout.groups}
            codesByGroup={searchDeptLayout.codesByGroup}
            managementById={byId}
            onOpenPeople={setPeopleDrill}
          />
        </div>
      )}

      {statsTab === 'levels' && (
        <>
          <StatsTable
            title="Organization level"
            description="Designation codes under each department — only the codes used in that department."
            rowLabel="Category"
            rows={orgRows}
            codes={alignedCodes}
            columnGroups={deptGroups}
            codesByGroup={deptCodesByGroup}
            managementById={byId}
            onOpenPeople={setPeopleDrill}
          />

          <StatsTable
            title="VP level"
            description="Designation code counts by department for engineers under each VP (via their Engineering, Delivery, and COE Managers)."
            rowLabel="VP"
            rows={vpStats}
            codes={alignedCodes}
            columnGroups={deptGroups}
            codesByGroup={deptCodesByGroup}
            managementById={byId}
            onOpenPeople={setPeopleDrill}
          />

          <StatsTable
            title="EM level"
            description="Engineering, Delivery, and COE Managers grouped under each VP, with designation counts by department."
            rowLabel="EM"
            rows={emStats}
            codes={alignedCodes}
            columnGroups={deptGroups}
            codesByGroup={deptCodesByGroup}
            managementById={byId}
            showVpColumn
            onOpenPeople={setPeopleDrill}
          />
        </>
      )}

      {statsTab === 'skills' && (
        <>
          <StatsTable
            title="Skill level"
            description="Designation code counts per skill. People with multiple skills are counted under each skill."
            rowLabel="Skill"
            rows={skillStats}
            codes={alignedCodes}
            onOpenPeople={setPeopleDrill}
          />

          <SkillEmMatrixTable
            title="Skill matrix by EM"
            description="Each skill is a column group of designation codes (like OMS in the capacity sheet). Counts are people under that EM who have the skill."
            skills={skillNames}
            codes={alignedCodes}
            rows={skillEmMatrix}
            onOpenPeople={setPeopleDrill}
          />
        </>
      )}

      <p className="text-xs text-text3">
        Categories: {Object.values(TRACK_LABELS).join(' · ')}. Software codes ordered ASE → SE → SSE
        → ATL → TL → STL → AArch → ARCH → SArch. People with multiple skills appear under each skill;
        Skill matrix Total is unique headcount under the EM. Click a count to see names.
      </p>

      {peopleDrill && !selectedMember && (
        <SlideOverPanel
          title={peopleDrill.title}
          subtitle={peopleDrill.subtitle}
          onClose={() => setPeopleDrill(null)}
          wide
          protectUnsaved={false}
        >
          <ul className="divide-y divide-border rounded-xl border border-border">
            {peopleDrill.members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => setSelectedMember(member)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-bg3"
                >
                  <ResourceAvatar
                    name={member.fullName}
                    size="sm"
                    imageUrl={member.profilePictureUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{member.fullName}</div>
                    <div className="truncate text-xs text-text2">
                      {[member.designationCode, member.designation, member.engineeringManagerName]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </SlideOverPanel>
      )}

      {selectedMember && (
        <TeamRosterMemberPanel
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
