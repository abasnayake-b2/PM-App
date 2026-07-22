import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useTeamManagement, useTeamRosterMembers } from '@/hooks/useTeamRoster';
import type { TeamManagement, TeamRosterMember } from '@/api/teamRoster.api';
import {
  engineeringManagerIdsUnderVp,
  isEngineeringManagerRole,
  isVpRole,
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

function StatsTable({
  title,
  description,
  rowLabel,
  rows,
  codes,
  showVpColumn = false,
  onOpenPeople,
}: {
  title: string;
  description: string;
  rowLabel: string;
  rows: StatsRow[];
  codes: string[];
  showVpColumn?: boolean;
  onOpenPeople?: (drill: StatsPeopleDrill) => void;
}) {
  const detailRows = rows.filter((row) => !row.isGroup);
  const columnTotals = codes.map((code) =>
    detailRows.reduce((sum, row) => sum + (row.counts[code] ?? 0), 0),
  );
  const grandTotal = detailRows.reduce((sum, row) => sum + row.total, 0);

  const openRowCode = (row: StatsRow, code: string) => {
    if (!onOpenPeople) return;
    const people = membersWithCode(row.members, code);
    if (people.length === 0) return;
    onOpenPeople({
      title: row.label,
      subtitle: `${code} · ${people.length} people`,
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

  const openColumnTotal = (code: string) => {
    if (!onOpenPeople) return;
    const people = uniqueMembers(detailRows.map((row) => membersWithCode(row.members, code)));
    if (people.length === 0) return;
    onOpenPeople({
      title: `${title} · ${code}`,
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
    <section className="w-full space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
      </div>
      <div className="w-full max-h-[min(50vh,28rem)] overflow-auto rounded-xl border border-border">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            {showVpColumn ? (
              <>
                <col style={{ width: '10rem' }} />
                <col style={{ width: '32rem' }} />
              </>
            ) : (
              <col style={{ width: '42rem' }} />
            )}
            {codes.map((code) => (
              <col key={code} />
            ))}
            <col style={{ width: '4.5rem' }} />
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-bg2">
            <tr className="border-b border-border text-text2">
              {showVpColumn ? (
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
              )}
              {codes.map((code) => (
                <th
                  key={code}
                  className="px-1 py-2 text-center font-medium uppercase"
                  title={code}
                >
                  <span className="block truncate">{code}</span>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-semibold">Total</th>
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
                      className={`sticky left-[10rem] z-[1] px-2 py-2 ${EM_COL} ${
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
                    className={`sticky left-0 z-[1] px-3 py-2 ${LABEL_COL} ${
                      row.isGroup ? 'bg-bg2/70 font-semibold' : 'bg-bg font-medium'
                    }`}
                  >
                    <div className="break-words">{row.label}</div>
                    {row.subLabel && (
                      <div className="text-xs font-normal text-text2 break-words">{row.subLabel}</div>
                    )}
                  </td>
                )}
                {codes.map((code) => (
                  <td key={code} className="px-1 py-2 text-center tabular-nums text-text2">
                    <CountLink
                      value={row.counts[code] ?? 0}
                      emptyAsDash
                      onClick={
                        onOpenPeople ? () => openRowCode(row, code) : undefined
                      }
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-semibold tabular-nums">
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
                  <td className={`sticky left-[10rem] bg-bg2 px-2 py-2 ${EM_COL}`}>Total</td>
                </>
              ) : (
                <td className={`sticky left-0 bg-bg2 px-3 py-2 ${LABEL_COL}`}>Total</td>
              )}
              {columnTotals.map((value, i) => (
                <td key={codes[i]} className="px-1 py-2 text-center tabular-nums">
                  <CountLink
                    value={value}
                    emptyAsDash
                    onClick={onOpenPeople ? () => openColumnTotal(codes[i]) : undefined}
                  />
                </td>
              ))}
              <td className="px-2 py-2 text-center tabular-nums">
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
  const detailRows = rows.filter((row) => !row.isGroup);

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
  const { data: management = [], isLoading: managementLoading } = useTeamManagement();
  const { data: members = [], isLoading: membersLoading } = useTeamRosterMembers();
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [statsTab, setStatsTab] = useState<'levels' | 'skills'>('levels');
  const [peopleDrill, setPeopleDrill] = useState<StatsPeopleDrill | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamRosterMember | null>(null);

  const { byId } = useMemo(() => buildManagementIndex(management), [management]);

  const activeMembers = useMemo(
    () => members.filter((m) => !m.status || m.status.toUpperCase() === 'ACTIVE'),
    [members],
  );

  /** Same engineer designation columns for all three grids (software ladder, then QA). */
  const alignedCodes = useMemo(() => {
    const { codes } = countByDesignationCode(activeMembers);
    return codes;
  }, [activeMembers]);

  const orgRows = useMemo(() => {
    const byTrack = new Map<string, TeamRosterMember[]>();
    for (const member of activeMembers) {
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
  }, [activeMembers]);

  const vpStats = useMemo(() => {
    const vps = management
      .filter((person) => person.status === 'ACTIVE' && isVpRole(person.roleTitle))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const rows: StatsRow[] = [];
    const assignedIds = new Set<string>();

    for (const vp of vps) {
      const emIds = engineeringManagerIdsUnderVp(management, vp.id);
      const team = membersForManagerIds(activeMembers, emIds, byId);
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
  }, [management, activeMembers, byId]);

  const emStats = useMemo(() => {
    const vps = management
      .filter((person) => person.status === 'ACTIVE' && isVpRole(person.roleTitle))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const ems = management.filter(
      (person) => person.status === 'ACTIVE' && isEngineeringManagerRole(person.roleTitle),
    );

    const rows: StatsRow[] = [];
    const coveredEmIds = new Set<string>();
    const coveredMemberIds = new Set<string>();

    for (const vp of vps) {
      const emIds = engineeringManagerIdsUnderVp(management, vp.id);
      const vpEms = ems
        .filter((em) => emIds.has(em.id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      if (vpEms.length === 0) continue;

      for (const em of vpEms) {
        coveredEmIds.add(em.id);
        const team = membersForManagerIds(activeMembers, new Set([em.id]), byId);
        for (const member of team) coveredMemberIds.add(member.id);

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
  }, [management, activeMembers, byId]);

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
      (person) => person.status === 'ACTIVE' && isEngineeringManagerRole(person.roleTitle),
    );

    const rows: SkillEmMatrixRow[] = [];
    const coveredEmIds = new Set<string>();
    const coveredMemberIds = new Set<string>();

    for (const vp of vps) {
      const emIds = engineeringManagerIdsUnderVp(management, vp.id);
      const vpEms = ems
        .filter((em) => emIds.has(em.id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      for (const em of vpEms) {
        coveredEmIds.add(em.id);
        const team = membersForManagerIds(activeMembers, new Set([em.id]), byId);
        for (const member of team) coveredMemberIds.add(member.id);
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
  }, [management, activeMembers, byId, skillNames, alignedCodes]);

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

  const exportTables = (): OrgStatsExportTable[] => [
    {
      title: 'Organization level',
      primaryLabel: 'Category',
      secondaryLabel: '',
      codes: alignedCodes,
      rows: orgRows,
    },
    {
      title: 'VP level',
      primaryLabel: 'VP',
      secondaryLabel: '',
      codes: alignedCodes,
      rows: vpStats,
    },
    {
      title: 'EM level',
      primaryLabel: 'VP',
      secondaryLabel: 'EM',
      codes: alignedCodes,
      rows: emStats,
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
      const skillMatrix = skillMatrixExport();
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
    <div className="w-full space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {statsTab === 'levels' && (
        <>
          <StatsTable
            title="Organization level"
            description="Designation code counts across the roster, grouped by Software Engineers / QA Engineers."
            rowLabel="Category"
            rows={orgRows}
            codes={alignedCodes}
            onOpenPeople={setPeopleDrill}
          />

          <StatsTable
            title="VP level"
            description="Designation code counts for engineers under each VP (via their Engineering Managers)."
            rowLabel="VP"
            rows={vpStats}
            codes={alignedCodes}
            onOpenPeople={setPeopleDrill}
          />

          <StatsTable
            title="EM level"
            description="Engineering Managers grouped under each VP, with designation code counts per EM."
            rowLabel="EM"
            rows={emStats}
            codes={alignedCodes}
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
