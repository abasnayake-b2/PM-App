import type { Allocation, Capacity } from '@/types';

export type CapacityManagerGroup = {
  manager: string;
  rows: Capacity[];
};

export const UNASSIGNED_FUNCTIONAL_UNIT = 'No functional unit';
export const UNASSIGNED_PROJECT = 'Unassigned';

export type CapacityTimelineLeaf = {
  employeeId: string;
  employeeName: string;
  row: Capacity;
  items: Allocation[];
};

export type CapacityProjectGroup = {
  projectKey: string;
  projectName: string;
  leaves: CapacityTimelineLeaf[];
};

export type CapacityManagerProjectGroup = {
  manager: string;
  projects: CapacityProjectGroup[];
};

export type CapacityFuGroup = {
  functionalUnit: string;
  managers: CapacityManagerProjectGroup[];
};

export type CapacityProjectHint = {
  projectId?: string;
  projectName: string;
  manager: string;
  functionalUnit: string;
};

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

function sortLabel(a: string, b: string, lastValues: string[]): number {
  const aLast = lastValues.includes(a);
  const bLast = lastValues.includes(b);
  if (aLast !== bLast) return aLast ? 1 : -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function allocationFunctionalUnit(
  allocation: Allocation,
  fuByProjectId: Map<string, string>,
  fuByProjectName: Map<string, string>,
): string {
  const fromAllocation = allocation.workCategoryName?.trim();
  if (fromAllocation) return fromAllocation;
  if (allocation.projectId && fuByProjectId.has(allocation.projectId)) {
    return fuByProjectId.get(allocation.projectId)!;
  }
  const fromName = fuByProjectName.get(normKey(allocation.projectName ?? ''));
  return fromName || UNASSIGNED_FUNCTIONAL_UNIT;
}

function allocationProjectName(allocation: Allocation): string {
  return allocation.projectName?.trim() || allocation.workCategoryName?.trim() || UNASSIGNED_PROJECT;
}

export function groupCapacityByEngineeringManager(rows: Capacity[]): CapacityManagerGroup[] {
  const groups: CapacityManagerGroup[] = [];
  const byKey = new Map<string, CapacityManagerGroup>();
  for (const row of rows) {
    const manager = row.engineeringManagerName?.trim() || 'Unassigned';
    const key = manager.toLowerCase();
    let group = byKey.get(key);
    if (!group) {
      group = { manager, rows: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

type LeafAcc = { employeeName: string; row: Capacity; items: Allocation[] };
type ProjectAcc = { projectName: string; leaves: Map<string, LeafAcc> };
type ManagerAcc = { manager: string; projects: Map<string, ProjectAcc> };
type FuAcc = { functionalUnit: string; managers: Map<string, ManagerAcc> };

function ensureProject(
  fuMap: Map<string, FuAcc>,
  functionalUnit: string,
  manager: string,
  projectName: string,
): ProjectAcc {
  const fuKey = normKey(functionalUnit);
  let fu = fuMap.get(fuKey);
  if (!fu) {
    fu = { functionalUnit, managers: new Map() };
    fuMap.set(fuKey, fu);
  }
  const managerKey = normKey(manager);
  let mgr = fu.managers.get(managerKey);
  if (!mgr) {
    mgr = { manager, projects: new Map() };
    fu.managers.set(managerKey, mgr);
  }
  const projectKey = normKey(projectName);
  let project = mgr.projects.get(projectKey);
  if (!project) {
    project = { projectName, leaves: new Map() };
    mgr.projects.set(projectKey, project);
  }
  return project;
}

function addLeaf(
  fuMap: Map<string, FuAcc>,
  functionalUnit: string,
  manager: string,
  projectName: string,
  row: Capacity,
  items: Allocation[],
) {
  const project = ensureProject(fuMap, functionalUnit, manager, projectName);
  let leaf = project.leaves.get(row.employeeId);
  if (!leaf) {
    leaf = { employeeName: row.employeeName, row, items: [] };
    project.leaves.set(row.employeeId, leaf);
  }
  leaf.items.push(...items);
}

export function groupCapacityByFuManagerProject(
  rows: Capacity[],
  projectHints: CapacityProjectHint[] = [],
): CapacityFuGroup[] {
  const fuMap = new Map<string, FuAcc>();
  const fuByProjectId = new Map<string, string>();
  const fuByProjectName = new Map<string, string>();
  for (const hint of projectHints) {
    const functionalUnit = hint.functionalUnit.trim() || UNASSIGNED_FUNCTIONAL_UNIT;
    const projectName = hint.projectName.trim();
    if (!projectName) continue;
    if (hint.projectId) fuByProjectId.set(hint.projectId, functionalUnit);
    fuByProjectName.set(normKey(projectName), functionalUnit);
  }
  for (const row of rows) {
    const manager = row.engineeringManagerName?.trim() || 'Unassigned';
    const allocations = row.periodAllocations ?? row.allocations ?? [];
    if (allocations.length === 0) {
      addLeaf(fuMap, UNASSIGNED_FUNCTIONAL_UNIT, manager, UNASSIGNED_PROJECT, row, []);
      continue;
    }
    for (const allocation of allocations) {
      addLeaf(
        fuMap,
        allocationFunctionalUnit(allocation, fuByProjectId, fuByProjectName),
        manager,
        allocationProjectName(allocation),
        row,
        [allocation],
      );
    }
  }

  return [...fuMap.values()]
    .map((fu) => ({
      functionalUnit: fu.functionalUnit,
      managers: [...fu.managers.values()]
        .map((mgr) => ({
          manager: mgr.manager,
          projects: [...mgr.projects.values()]
            .map((project) => ({
              projectKey: normKey(project.projectName),
              projectName: project.projectName,
              leaves: [...project.leaves.values()]
                .map((leaf) => ({
                  employeeId: leaf.row.employeeId,
                  employeeName: leaf.employeeName,
                  row: leaf.row,
                  items: leaf.items,
                }))
                .sort((a, b) =>
                  a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
                ),
            }))
            .filter((project) => project.leaves.length > 0)
            .sort((a, b) =>
              sortLabel(a.projectName, b.projectName, [UNASSIGNED_PROJECT, 'Non-project']),
            ),
        }))
        .filter((mgr) => mgr.projects.length > 0)
        .sort((a, b) => sortLabel(a.manager, b.manager, ['Unassigned'])),
    }))
    .filter((fu) => fu.managers.length > 0)
    .sort((a, b) => sortLabel(a.functionalUnit, b.functionalUnit, [UNASSIGNED_FUNCTIONAL_UNIT]));
}
