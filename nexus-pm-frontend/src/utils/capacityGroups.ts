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

export type FunctionalUnitManager = {
  id: string;
  name: string;
};

export type FunctionalUnitAssignment = {
  name: string;
  managers: FunctionalUnitManager[];
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
  if (allocation.projectId && fuByProjectId.has(allocation.projectId)) {
    return fuByProjectId.get(allocation.projectId)!;
  }
  const fromName = fuByProjectName.get(normKey(allocation.projectName ?? ''));
  if (fromName) return fromName;
  return allocation.workCategoryName?.trim() || UNASSIGNED_FUNCTIONAL_UNIT;
}

function allocationProjectName(
  allocation: Allocation,
  projectNameById: Map<string, string>,
): string {
  if (allocation.projectId && projectNameById.has(allocation.projectId)) {
    return projectNameById.get(allocation.projectId)!;
  }
  return allocation.projectName?.trim() || allocation.workCategoryName?.trim() || UNASSIGNED_PROJECT;
}

export function functionalUnitProjects(
  functionalUnit: string,
  hints: CapacityProjectHint[],
): string[] {
  const fuKey = normKey(functionalUnit);
  return [
    ...new Set(
      hints
        .filter((hint) => normKey(hint.functionalUnit) === fuKey)
        .map((hint) => hint.projectName.trim())
        .filter((name) => name && normKey(name) !== fuKey),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function functionalUnitDisplayLabel(
  functionalUnit: string,
  hints: CapacityProjectHint[],
): string {
  const projects = functionalUnitProjects(functionalUnit, hints);
  return projects.length === 0 ? functionalUnit : `${functionalUnit} (${projects.join(', ')})`;
}

export function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Unassigned', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
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

function assignedManagersForUnit(
  functionalUnit: string,
  assignments: FunctionalUnitAssignment[],
): FunctionalUnitManager[] {
  const key = normKey(functionalUnit);
  return assignments.find((assignment) => normKey(assignment.name) === key)?.managers ?? [];
}

function managerMatchesRow(manager: FunctionalUnitManager, row: Capacity): boolean {
  if (row.engineeringManagerManagementId && manager.id === row.engineeringManagerManagementId) {
    return true;
  }
  const rowName = normKey(row.engineeringManagerName ?? '');
  return rowName.length > 0 && normKey(manager.name) === rowName;
}

/** Manager label for a functional unit comes from the managers assigned to that unit. */
function managerForFunctionalUnit(
  functionalUnit: string,
  row: Capacity,
  assignments: FunctionalUnitAssignment[],
): string {
  const assigned = assignedManagersForUnit(functionalUnit, assignments);
  const personal = row.engineeringManagerName?.trim() || 'Unassigned';
  if (assigned.length === 0) return personal;
  const match = assigned.find((manager) => managerMatchesRow(manager, row));
  if (match) return match.name;
  if (assigned.length === 1) return assigned[0].name;
  return personal;
}

function functionalUnitsForManager(
  row: Capacity,
  assignments: FunctionalUnitAssignment[],
): FunctionalUnitAssignment[] {
  return assignments.filter(
    (assignment) =>
      assignment.name.trim() &&
      assignment.managers.some((manager) => managerMatchesRow(manager, row)),
  );
}

export function groupCapacityByFuManagerProject(
  rows: Capacity[],
  projectHints: CapacityProjectHint[] = [],
  assignments: FunctionalUnitAssignment[] = [],
): CapacityFuGroup[] {
  const fuMap = new Map<string, FuAcc>();
  const fuByProjectId = new Map<string, string>();
  const fuByProjectName = new Map<string, string>();
  const projectNameById = new Map<string, string>();
  for (const hint of projectHints) {
    const functionalUnit = hint.functionalUnit.trim() || UNASSIGNED_FUNCTIONAL_UNIT;
    const projectName = hint.projectName.trim();
    if (!projectName) continue;
    if (hint.projectId) {
      fuByProjectId.set(hint.projectId, functionalUnit);
      projectNameById.set(hint.projectId, projectName);
    }
    fuByProjectName.set(normKey(projectName), functionalUnit);
  }
  for (const row of rows) {
    const allocations = row.periodAllocations ?? row.allocations ?? [];
    if (allocations.length === 0) {
      const ownedUnits = functionalUnitsForManager(row, assignments);
      if (ownedUnits.length === 0) {
        addLeaf(
          fuMap,
          UNASSIGNED_FUNCTIONAL_UNIT,
          row.engineeringManagerName?.trim() || 'Unassigned',
          UNASSIGNED_PROJECT,
          row,
          [],
        );
      } else {
        for (const unit of ownedUnits) {
          addLeaf(
            fuMap,
            unit.name,
            managerForFunctionalUnit(unit.name, row, assignments),
            UNASSIGNED_PROJECT,
            row,
            [],
          );
        }
      }
      continue;
    }
    for (const allocation of allocations) {
      const functionalUnit = allocationFunctionalUnit(allocation, fuByProjectId, fuByProjectName);
      addLeaf(
        fuMap,
        functionalUnit,
        managerForFunctionalUnit(functionalUnit, row, assignments),
        allocationProjectName(allocation, projectNameById),
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
