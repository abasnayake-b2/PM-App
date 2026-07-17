import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Users } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useTeamManagement, useTeamRosterMembers } from '@/hooks/useTeamRoster';
import type { TeamManagement, TeamRosterMember } from '@/api/teamRoster.api';
import {
  isCxoRole,
  isEngineeringManagerRole,
  isVpRole,
  resolveSupervisorId,
  shortCxoLabel,
} from '@/utils/managementRoles';

function normalizeName(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function exportFilename(ext: 'jpg' | 'pdf') {
  const stamp = new Date().toISOString().slice(0, 10);
  return `org-chart-${stamp}.${ext}`;
}

function resolveExportBackground(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  return raw || '#ffffff';
}

type Band = 'cxo' | 'vp' | 'manager' | 'engineer' | 'other';

function roleBand(roleTitle: string): Band {
  if (isCxoRole(roleTitle)) return 'cxo';
  if (isVpRole(roleTitle)) return 'vp';
  if (isEngineeringManagerRole(roleTitle)) return 'manager';
  return 'other';
}

const bandStyles: Record<Band, string> = {
  cxo: 'border-amber-500/40 bg-amber-500/10',
  vp: 'border-sky-500/40 bg-sky-500/10',
  manager: 'border-emerald-500/40 bg-emerald-500/10',
  engineer: 'border-slate-400/40 bg-bg3',
  other: 'border-border bg-bg2',
};

function buildManagementIndex(management: TeamManagement[]) {
  const byId = new Map(management.map((person) => [person.id, person]));
  const byName = new Map<string, TeamManagement>();
  for (const person of management) {
    byName.set(normalizeName(person.fullName), person);
  }
  return { byId, byName };
}

function shortManagementLabel(roleTitle: string): string {
  if (isCxoRole(roleTitle)) return shortCxoLabel(roleTitle);
  if (isVpRole(roleTitle)) return 'VP';
  if (isEngineeringManagerRole(roleTitle)) return 'EM';
  const token = roleTitle.match(/\b([A-Z]{2,5})\b/);
  return token?.[1] ?? roleTitle.split(/\s+/)[0] ?? '';
}

type EngineerTrack = 'software' | 'qa' | 'other';

const TRACK_ORDER: EngineerTrack[] = ['software', 'qa', 'other'];

const TRACK_LABELS: Record<EngineerTrack, string> = {
  software: 'Software Engineers',
  qa: 'QA Engineers',
  other: 'Other',
};

function classifyEngineerTrack(member: TeamRosterMember): EngineerTrack {
  const designation = (member.designation ?? '').toLowerCase();
  const code = (member.designationCode ?? '').trim().toLowerCase();
  const team = (member.teamName ?? '').toLowerCase();
  const haystack = `${designation} ${code} ${team}`;

  if (
    /\bqa\b/.test(haystack) ||
    haystack.includes('quality') ||
    haystack.includes('test engineer') ||
    haystack.includes('sdet') ||
    code.startsWith('qa') ||
    code === 'qe' ||
    code === 'qae'
  ) {
    return 'qa';
  }

  if (
    designation.includes('software') ||
    designation.includes('developer') ||
    designation.includes('tech lead') ||
    designation.includes('engineer') ||
    /^(se|sse|ase|jse|stl|tl|sde|dev)/i.test(code)
  ) {
    return 'software';
  }

  // Default engineering roster people without a clear QA signal to Software
  return code || designation ? 'software' : 'other';
}

/** Lower number = more junior; Software ladder left → right. */
const DESIGNATION_CODE_LEVEL: Record<string, number> = {
  // Software Engineers (requested order)
  ASE: 10,
  SE: 20,
  SSE: 30,
  ATL: 40,
  TL: 50,
  STL: 60,
  AARCH: 70,
  ARCH: 80,
  SARCH: 90,
  // Common aliases / typos
  SARCK: 90,
  AARH: 70,
  // QA Engineers (junior → senior)
  INT: 5,
  INTERN: 5,
  TRAINEE: 5,
  JQA: 10,
  AQA: 15,
  QA: 20,
  QAE: 20,
  QE: 20,
  SQA: 30,
  SQAE: 30,
  QTL: 40,
  QAL: 50,
};

function designationLevelRank(code: string, designationName?: string): number {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized && normalized !== '') {
    if (DESIGNATION_CODE_LEVEL[normalized] != null) {
      return DESIGNATION_CODE_LEVEL[normalized];
    }
    // e.g. SE1 / SSE2 → base code + step
    const numbered = normalized.match(/^([A-Z]+)(\d+)$/);
    if (numbered) {
      const base = DESIGNATION_CODE_LEVEL[numbered[1]];
      if (base != null) return base + Number(numbered[2]);
    }
  }

  const name = (designationName ?? '').toLowerCase();
  if (/associate\s*architect|asst\.?\s*architect|a-?arch/.test(name)) return 70;
  if (/senior\s*architect|s-?arch/.test(name)) return 90;
  if (/architect/.test(name)) return 80;
  if (/senior\s*tech\s*lead|stl/.test(name)) return 60;
  if (/associate\s*tech\s*lead|atl/.test(name)) return 40;
  if (/tech\s*lead|\blead\b/.test(name)) return 50;
  if (/senior\s*software|sse/.test(name)) return 30;
  if (/associate\s*software|ase/.test(name)) return 10;
  if (/software\s*engineer|\bse\b/.test(name)) return 20;
  if (/intern|trainee/.test(name)) return 5;
  if (/junior|associate|entry/.test(name)) return 15;
  if (/senior|\bsr\.?\b/.test(name)) return 30;
  return 999; // unknown codes go to the right
}

function groupTeamByDesignation(team: TeamRosterMember[]) {
  const groups = new Map<string, TeamRosterMember[]>();
  for (const member of team) {
    const code = (member.designationCode ?? '').trim() || '—';
    const list = groups.get(code) ?? [];
    list.push(member);
    groups.set(code, list);
  }
  return [...groups.entries()]
    .map(([code, members]) => ({
      code,
      members: [...members].sort((x, y) => x.fullName.localeCompare(y.fullName)),
      level: designationLevelRank(code, members[0]?.designation),
    }))
    .sort((a, b) => a.level - b.level || a.code.localeCompare(b.code))
    .map(({ code, members }) => ({ code, members }));
}

function groupTeamByTrack(team: TeamRosterMember[]) {
  const byTrack = new Map<EngineerTrack, TeamRosterMember[]>();
  for (const member of team) {
    const track = classifyEngineerTrack(member);
    const list = byTrack.get(track) ?? [];
    list.push(member);
    byTrack.set(track, list);
  }
  return TRACK_ORDER.filter((track) => (byTrack.get(track)?.length ?? 0) > 0).map((track) => ({
    track,
    label: TRACK_LABELS[track],
    members: byTrack.get(track) ?? [],
    codeGroups: groupTeamByDesignation(byTrack.get(track) ?? []),
  }));
}

function DesignationCodeColumn({
  code,
  members,
}: {
  code: string;
  members: TeamRosterMember[];
}) {
  return (
    <li className="org-chart-team-leaf">
      <div className="flex min-w-[88px] flex-col items-center gap-1">
        <div
          className="w-full rounded-md border border-slate-400/50 bg-slate-500/15 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-text"
          title={members[0]?.designation ?? code}
        >
          {code} ({members.length})
        </div>
        <div className="flex w-full flex-col gap-1">
          {members.map((member) => (
            <div
              key={member.id}
              className={`rounded-md border px-1.5 py-1 text-center text-[11px] font-semibold leading-tight text-text ${bandStyles.engineer}`}
              title={member.fullName}
            >
              {member.fullName}
            </div>
          ))}
        </div>
      </div>
    </li>
  );
}

function EngineerTrackBranch({
  label,
  count,
  codeGroups,
}: {
  label: string;
  count: number;
  codeGroups: ReturnType<typeof groupTeamByDesignation>;
}) {
  return (
    <li className="org-chart-team-leaf">
      <div className="mx-auto min-w-[120px] rounded-lg border border-slate-500/40 bg-slate-500/10 px-2 py-1.5 text-center shadow-sm">
        <p className="text-[11px] font-semibold leading-tight text-text">{label}</p>
        <p className="mt-0.5 text-[10px] font-medium text-text2">{count}</p>
      </div>
      <ul>
        {codeGroups.map(({ code, members }) => (
          <DesignationCodeColumn key={code} code={code} members={members} />
        ))}
      </ul>
    </li>
  );
}

function PersonCard({
  name,
  role,
  band,
  reportCount,
  expanded,
  hasChildren,
  onToggle,
}: {
  name: string;
  role?: string;
  band: Band;
  reportCount?: number;
  expanded?: boolean;
  hasChildren?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`relative mx-auto w-[112px] rounded-lg border px-1.5 py-1.5 text-center shadow-sm ${bandStyles[band]}`}
      title={[name, role].filter(Boolean).join(' · ')}
    >
      <p className="text-[11px] font-semibold leading-tight text-text">{name}</p>
      {role && (
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-text2">{role}</p>
      )}
      {typeof reportCount === 'number' && reportCount > 0 && (
        <p className="mt-0.5 text-[9px] text-text3">{reportCount}</p>
      )}
      {hasChildren && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          data-org-chart-export-hide
          className="absolute -bottom-2.5 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-bg2 text-text2 shadow-sm hover:bg-bg3"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      )}
    </div>
  );
}

function ChartBranch({
  person,
  childrenBySupervisor,
  employeesByManager,
  showEmployees,
  expanded,
  onToggle,
}: {
  person: TeamManagement;
  childrenBySupervisor: Map<string, TeamManagement[]>;
  employeesByManager: Map<string, TeamRosterMember[]>;
  showEmployees: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const reports = childrenBySupervisor.get(person.id) ?? [];
  const team =
    employeesByManager.get(person.id) ??
    employeesByManager.get(normalizeName(person.fullName)) ??
    [];
  const showTeam = showEmployees && team.length > 0;
  const hasChildren = reports.length > 0 || showTeam;
  const isExpanded = expanded.has(person.id);
  const band = roleBand(person.roleTitle);
  const reportCount = reports.length + (showEmployees ? team.length : 0);
  const trackGroups = showTeam ? groupTeamByTrack(team) : [];

  return (
    <li>
      <PersonCard
        name={person.fullName}
        role={shortManagementLabel(person.roleTitle)}
        band={band}
        reportCount={hasChildren ? reportCount : undefined}
        expanded={isExpanded}
        hasChildren={hasChildren}
        onToggle={hasChildren ? () => onToggle(person.id) : undefined}
      />

      {hasChildren && isExpanded && (
        <ul>
          {reports.map((child) => (
            <ChartBranch
              key={child.id}
              person={child}
              childrenBySupervisor={childrenBySupervisor}
              employeesByManager={employeesByManager}
              showEmployees={showEmployees}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
          {trackGroups.map(({ track, label, members, codeGroups }) => (
            <EngineerTrackBranch
              key={track}
              label={label}
              count={members.length}
              codeGroups={codeGroups}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ManagementOrgChart() {
  const { data: management = [], isLoading: managementLoading } = useTeamManagement();
  const { data: members = [], isLoading: membersLoading } = useTeamRosterMembers();
  const [showEmployees, setShowEmployees] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState<'jpeg' | 'pdf' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const seededRef = useRef(false);
  const chartContentRef = useRef<HTMLDivElement>(null);
  const pendingExportRef = useRef<'jpeg' | 'pdf' | null>(null);

  const { byId, byName } = useMemo(() => buildManagementIndex(management), [management]);

  const childrenBySupervisor = useMemo(() => {
    const map = new Map<string, TeamManagement[]>();
    for (const person of management) {
      const supervisorId = resolveSupervisorId(person, byId, byName);
      if (!supervisorId) continue;
      const list = map.get(supervisorId) ?? [];
      list.push(person);
      map.set(supervisorId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return map;
  }, [management, byId, byName]);

  const employeesByManager = useMemo(() => {
    const map = new Map<string, TeamRosterMember[]>();
    for (const member of members) {
      const key = member.engineeringManagerManagementId ?? normalizeName(member.engineeringManagerName);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(member);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return map;
  }, [members]);

  const roots = useMemo(
    () =>
      management
        .filter((person) => !resolveSupervisorId(person, byId, byName))
        .sort(
          (a, b) => a.roleTitle.localeCompare(b.roleTitle) || a.fullName.localeCompare(b.fullName),
        ),
    [management, byId, byName],
  );

  // Expand full management tree by default so engineers are visible under managers
  useEffect(() => {
    if (management.length === 0 || seededRef.current) return;
    seededRef.current = true;
    setExpanded(new Set(management.map((person) => person.id)));
  }, [management]);

  useEffect(() => {
    const format = pendingExportRef.current;
    if (!format || !exporting) return;

    let cancelled = false;

    const run = async () => {
      // Let expand-all layout settle before capture
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (cancelled) return;

      const node = chartContentRef.current;
      if (!node) {
        setExportError('Chart is not ready to export.');
        pendingExportRef.current = null;
        setExporting(null);
        return;
      }

      try {
        const dataUrl = await toJpeg(node, {
          quality: 0.92,
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: resolveExportBackground(),
          filter: (el) =>
            !(el instanceof HTMLElement && el.hasAttribute('data-org-chart-export-hide')),
        });

        if (cancelled) return;

        if (format === 'jpeg') {
          downloadDataUrl(dataUrl, exportFilename('jpg'));
        } else {
          const image = new Image();
          image.src = dataUrl;
          await image.decode();
          if (cancelled) return;

          const width = image.naturalWidth;
          const height = image.naturalHeight;
          const pdf = new jsPDF({
            orientation: width >= height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [width, height],
            hotfixes: ['px_scaling'],
          });
          pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
          pdf.save(exportFilename('pdf'));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setExportError('Could not export the org chart. Try collapsing some branches and retry.');
        }
      } finally {
        if (!cancelled) {
          pendingExportRef.current = null;
          setExporting(null);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [exporting, expanded]);

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(management.map((person) => person.id)));
  };

  const collapseAll = () => setExpanded(new Set());

  const startExport = (format: 'jpeg' | 'pdf') => {
    setExportError(null);
    pendingExportRef.current = format;
    setExpanded(new Set(management.map((person) => person.id)));
    setExporting(format);
  };

  if (managementLoading || membersLoading) {
    return <p className="text-text2">Loading org chart…</p>;
  }

  if (management.length === 0) {
    return (
      <p className="text-text2">
        No management roster yet. Upload management data under Management &amp; teams, or add people
        under Admin → Management.
      </p>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[28rem] flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-text2">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> C-level
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> VP
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Manager
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Engineer
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-text2">
            <input
              type="checkbox"
              checked={showEmployees}
              onChange={(e) => setShowEmployees(e.target.checked)}
              className="rounded border-border"
            />
            <Users size={14} />
            Show engineers
          </label>
          <button type="button" onClick={expandAll} className="text-accent hover:underline">
            Expand all
          </button>
          <span className="text-text2">·</span>
          <button type="button" onClick={collapseAll} className="text-accent hover:underline">
            Collapse all
          </button>
          <span className="text-text2">·</span>
          <div className="inline-flex items-center gap-1.5">
            <Download size={14} className="text-text2" />
            <button
              type="button"
              disabled={!!exporting}
              onClick={() => startExport('jpeg')}
              className="text-accent hover:underline disabled:opacity-50"
            >
              {exporting === 'jpeg' ? 'Preparing…' : 'JPEG'}
            </button>
            <span className="text-text2">/</span>
            <button
              type="button"
              disabled={!!exporting}
              onClick={() => startExport('pdf')}
              className="text-accent hover:underline disabled:opacity-50"
            >
              {exporting === 'pdf' ? 'Preparing…' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {exportError && <p className="text-sm text-danger">{exportError}</p>}

      <div className="org-chart min-h-0 min-w-0 flex-1 overflow-auto rounded-xl border border-border bg-bg2/40">
        <div ref={chartContentRef} className="inline-block min-h-full min-w-full p-8">
          <ul>
            {roots.map((root) => (
              <ChartBranch
                key={root.id}
                person={root}
                childrenBySupervisor={childrenBySupervisor}
                employeesByManager={employeesByManager}
                showEmployees={showEmployees}
                expanded={expanded}
                onToggle={toggle}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
