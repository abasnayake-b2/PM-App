import type { TeamRosterMember } from '@/api/teamRoster.api';

export type EngineerTrack = 'project' | 'software' | 'qa' | 'other';

export const TRACK_ORDER: EngineerTrack[] = ['project', 'software', 'qa', 'other'];

export const TRACK_LABELS: Record<EngineerTrack, string> = {
  project: 'Project Managers',
  software: 'Software Engineers',
  qa: 'QA Engineers',
  other: 'Other',
};

/** Software ladder left → right: ASE-SE-SSE-ATL-TL-STL-AArch-ARCH-SArch */
export const SOFTWARE_CODE_ORDER = [
  'ASE',
  'SE',
  'SSE',
  'ATL',
  'TL',
  'STL',
  'AARCH',
  'ARCH',
  'SARCH',
] as const;

/** QA ladder left → right */
export const QA_CODE_ORDER = [
  'JQA',
  'AQA',
  'QA',
  'QAE',
  'QE',
  'SQA',
  'SQAE',
  'AQAL',
  'QTL',
  'QAL',
] as const;

export const DESIGNATION_CODE_LEVEL: Record<string, number> = {
  ASE: 10,
  SE: 20,
  SSE: 30,
  ATL: 40,
  TL: 50,
  STL: 60,
  AARCH: 70,
  ARCH: 80,
  SARCH: 90,
  SARCK: 90,
  AARH: 70,
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
  AQAL: 45,
  QTL: 40,
  QAL: 50,
};

function normalizeCodeKey(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function ladderIndex(code: string, ladder: readonly string[]): number {
  const key = normalizeCodeKey(code);
  const exact = ladder.indexOf(key);
  if (exact >= 0) return exact;
  // aliases
  if (ladder === SOFTWARE_CODE_ORDER) {
    if (key === 'SARCK') return ladder.indexOf('SARCH');
    if (key === 'AARH') return ladder.indexOf('AARCH');
  }
  return -1;
}

export function classifyEngineerTrack(member: TeamRosterMember): EngineerTrack {
  const designation = (member.designation ?? '').toLowerCase();
  const code = (member.designationCode ?? '').trim().toLowerCase();
  const team = (member.teamName ?? '').toLowerCase();
  const haystack = `${designation} ${code} ${team}`;
  const codeKey = code.replace(/[^a-z0-9]/g, '');

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
    ['spm', 'pjm', 'pm', 'pgm', 'pgmm'].includes(codeKey) ||
    /project\s*manager|programme\s*manager|program\s*manager/.test(designation)
  ) {
    return 'project';
  }

  if (
    designation.includes('software') ||
    designation.includes('developer') ||
    designation.includes('tech lead') ||
    designation.includes('engineer') ||
    /^(se|sse|ase|jse|stl|tl|atl|sde|dev|arch|aarch|sarch)/i.test(code)
  ) {
    return 'software';
  }

  return code || designation ? 'software' : 'other';
}

export function normalizeDesignationCode(code?: string | null): string {
  const raw = (code ?? '').trim();
  return raw || '—';
}

export function designationLevelRank(code: string, designationName?: string): number {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized) {
    if (DESIGNATION_CODE_LEVEL[normalized] != null) {
      return DESIGNATION_CODE_LEVEL[normalized];
    }
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
  return 999;
}

export function sortDesignationCodes(
  codes: string[],
  nameByCode?: Map<string, string>,
): string[] {
  return [...codes].sort((a, b) => {
    const aSoft = ladderIndex(a, SOFTWARE_CODE_ORDER);
    const bSoft = ladderIndex(b, SOFTWARE_CODE_ORDER);
    const aQa = ladderIndex(a, QA_CODE_ORDER);
    const bQa = ladderIndex(b, QA_CODE_ORDER);

    // Software engineer codes first (fixed ladder), then QA, then everything else
    const band = (soft: number, qa: number) => (soft >= 0 ? 0 : qa >= 0 ? 1 : 2);
    const bandDiff = band(aSoft, aQa) - band(bSoft, bQa);
    if (bandDiff !== 0) return bandDiff;

    if (aSoft >= 0 && bSoft >= 0) return aSoft - bSoft;
    if (aQa >= 0 && bQa >= 0) return aQa - bQa;

    return (
      designationLevelRank(a, nameByCode?.get(a)) - designationLevelRank(b, nameByCode?.get(b)) ||
      a.localeCompare(b)
    );
  });
}

export function countByDesignationCode(members: TeamRosterMember[]): {
  codes: string[];
  counts: Record<string, number>;
  total: number;
} {
  const counts: Record<string, number> = {};
  const nameByCode = new Map<string, string>();
  for (const member of members) {
    const code = normalizeDesignationCode(member.designationCode);
    counts[code] = (counts[code] ?? 0) + 1;
    if (member.designation && !nameByCode.has(code)) {
      nameByCode.set(code, member.designation);
    }
  }
  const codes = sortDesignationCodes(Object.keys(counts), nameByCode);
  const total = members.length;
  return { codes, counts, total };
}

export function countByTrackAndCode(members: TeamRosterMember[]): {
  tracks: { track: EngineerTrack; label: string; codes: string[]; counts: Record<string, number>; total: number }[];
  allCodes: string[];
} {
  const byTrack = new Map<EngineerTrack, TeamRosterMember[]>();
  for (const member of members) {
    const track = classifyEngineerTrack(member);
    const list = byTrack.get(track) ?? [];
    list.push(member);
    byTrack.set(track, list);
  }

  const tracks = TRACK_ORDER.filter((track) => (byTrack.get(track)?.length ?? 0) > 0).map((track) => {
    const group = countByDesignationCode(byTrack.get(track) ?? []);
    return {
      track,
      label: TRACK_LABELS[track],
      codes: group.codes,
      counts: group.counts,
      total: group.total,
    };
  });

  const allCodeSet = new Set<string>();
  for (const track of tracks) {
    for (const code of track.codes) allCodeSet.add(code);
  }
  const nameByCode = new Map<string, string>();
  for (const member of members) {
    const code = normalizeDesignationCode(member.designationCode);
    if (member.designation && !nameByCode.has(code)) nameByCode.set(code, member.designation);
  }

  return { tracks, allCodes: sortDesignationCodes([...allCodeSet], nameByCode) };
}
