import type { OrgBreakdownProject } from '@/types';

export type SlideOverEntry = string | { label: string; meta?: string };

export type SlideOverGroup = {
  title: string;
  items: SlideOverEntry[];
};

export function groupBreakdownProjects(projects: OrgBreakdownProject[]): SlideOverGroup[] {
  const sorted = [...projects].sort((a, b) => {
    const region = (a.regionName ?? '').localeCompare(b.regionName ?? '', undefined, {
      sensitivity: 'base',
    });
    if (region !== 0) return region;
    const country = (a.countryName ?? '').localeCompare(b.countryName ?? '', undefined, {
      sensitivity: 'base',
    });
    if (country !== 0) return country;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const groups: SlideOverGroup[] = [];
  let currentKey = '';

  for (const project of sorted) {
    const region = project.regionName?.trim() || 'Unassigned region';
    const country = project.countryName?.trim() || 'Unassigned country';
    const key = `${region}|${country}`;
    if (key !== currentKey) {
      groups.push({
        title: `${region} · ${country}`,
        items: [],
      });
      currentKey = key;
    }
    groups[groups.length - 1].items.push(project.name);
  }

  return groups;
}

export function groupEngineersByDesignation(
  people: { name: string; designation?: string }[],
): SlideOverGroup[] {
  const sorted = [...people].sort((a, b) => {
    const designation = (a.designation ?? '').localeCompare(b.designation ?? '', undefined, {
      sensitivity: 'base',
    });
    if (designation !== 0) return designation;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const groups: SlideOverGroup[] = [];
  let currentDesignation = '';

  for (const person of sorted) {
    const designation = person.designation?.trim() || 'Unassigned';
    if (designation !== currentDesignation) {
      groups.push({
        title: designation,
        items: [],
      });
      currentDesignation = designation;
    }
    groups[groups.length - 1].items.push(person.name);
  }

  return groups;
}
