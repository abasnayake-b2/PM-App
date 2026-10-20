import type { Allocation, Capacity } from '@/types';
import type { WorkCategory } from '@/api/lookup.api';
import { capacityAllocations, inclusiveDayCount } from '@/utils/allocationUi';

export type SummaryPerson = {
  employeeId: string;
  employeeName: string;
  designationName?: string;
  engineeringManagerManagementId?: string;
  engineeringManagerName: string;
  allocatedPct: number;
  availablePct: number;
  fte: number;
  personDays: number;
  allocations: Allocation[];
};

export type ProjectAllocationSummary = {
  key: string;
  projectId: string;
  projectName: string;
  peopleCount: number;
  allocationCount: number;
  fte: number;
  personDays: number;
  avgPct: number;
  people: SummaryPerson[];
  allocations: Allocation[];
};

export type ManagerAllocationSummary = {
  key: string;
  managerName: string;
  teamSize: number;
  allocatedCount: number;
  projectCount: number;
  avgPct: number;
  allocatedFte: number;
  availableFte: number;
  personDays: number;
  people: SummaryPerson[];
  projects: { name: string; fte: number }[];
};

export type AllocationSummaryTotals = {
  teamSize: number;
  allocatedCount: number;
  unallocatedCount: number;
  allocatedFte: number;
  availableFte: number;
  projectCount: number;
  rangeDays: number;
};

export type AllocationSummaryFilters = {
  taskCategoryId?: string;
  taskTypeId?: string;
  projectTypeId?: string;
  workCategoryIds?: string[];
};

function matchesSummaryFilters(
  allocation: Allocation,
  filters?: AllocationSummaryFilters,
): boolean {
  if (filters?.taskCategoryId && allocation.taskCategoryId !== filters.taskCategoryId) {
    return false;
  }
  if (filters?.taskTypeId && allocation.taskTypeId !== filters.taskTypeId) {
    return false;
  }
  if (filters?.projectTypeId && allocation.projectTypeId !== filters.projectTypeId) {
    return false;
  }
  if (filters?.workCategoryIds && !filters.workCategoryIds.includes(allocation.workCategoryId ?? '')) {
    return false;
  }
  return true;
}

function overlapDays(allocation: Allocation, rangeFrom: string, rangeTo: string): number {
  const start = allocation.fromDate > rangeFrom ? allocation.fromDate : rangeFrom;
  const endRaw = allocation.toDate ?? rangeTo;
  const end = endRaw < rangeTo ? endRaw : rangeTo;
  return inclusiveDayCount(start, end);
}

export function buildAllocationSummary(
  rows: Capacity[],
  rangeFrom: string,
  rangeTo: string,
  filters?: AllocationSummaryFilters,
): {
  totals: AllocationSummaryTotals;
  projects: ProjectAllocationSummary[];
  managers: ManagerAllocationSummary[];
  allocatedPeople: SummaryPerson[];
  unallocatedPeople: SummaryPerson[];
} {
  const rangeDays = inclusiveDayCount(rangeFrom, rangeTo);
  const projectMap = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      allocationCount: number;
      personDays: number;
      people: Map<string, SummaryPerson>;
      allocations: Allocation[];
    }
  >();
  const managerPeople = new Map<string, SummaryPerson[]>();
  const managerProjects = new Map<string, Map<string, number>>();

  const people: SummaryPerson[] = rows.map((row) => {
    const allocations = capacityAllocations(row).filter((allocation) =>
      matchesSummaryFilters(allocation, filters),
    );
    let personDays = 0;
    const inRange: Allocation[] = [];
    const managerName = row.engineeringManagerName?.trim() || 'Unassigned';

    for (const allocation of allocations) {
      const days = overlapDays(allocation, rangeFrom, rangeTo);
      if (days <= 0) continue;
      inRange.push(allocation);
      const contrib = (allocation.percentage * days) / 100;
      personDays += contrib;
      const projectId = allocation.projectId || allocation.projectName;
      const projectName = allocation.projectName?.trim() || 'Unassigned project';
      const existing = projectMap.get(projectId) ?? {
        projectId,
        projectName,
        allocationCount: 0,
        personDays: 0,
        people: new Map<string, SummaryPerson>(),
        allocations: [],
      };
      existing.allocationCount += 1;
      existing.personDays += contrib;
      existing.allocations.push(allocation);
      const prior = existing.people.get(row.employeeId);
      const projectPersonDays = (prior?.personDays ?? 0) + contrib;
      existing.people.set(row.employeeId, {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        designationName: row.designationName,
        engineeringManagerManagementId: row.engineeringManagerManagementId,
        engineeringManagerName: managerName,
        allocatedPct: rangeDays > 0 ? Math.round((projectPersonDays / rangeDays) * 100) : 0,
        availablePct: 0,
        fte: rangeDays > 0 ? projectPersonDays / rangeDays : 0,
        personDays: projectPersonDays,
        allocations: [],
      });
      projectMap.set(projectId, existing);

      const byProject = managerProjects.get(managerName) ?? new Map<string, number>();
      byProject.set(projectName, (byProject.get(projectName) ?? 0) + contrib);
      managerProjects.set(managerName, byProject);
    }

    const fte = rangeDays > 0 ? personDays / rangeDays : 0;
    const allocatedPct = Math.round(fte * 100);
    const person: SummaryPerson = {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      designationName: row.designationName,
      engineeringManagerManagementId: row.engineeringManagerManagementId,
      engineeringManagerName: managerName,
      allocatedPct,
      availablePct: Math.max(0, 100 - allocatedPct),
      fte,
      personDays,
      allocations: inRange.sort(
        (a, b) =>
          a.projectName.localeCompare(b.projectName, undefined, { sensitivity: 'base' }) ||
          a.fromDate.localeCompare(b.fromDate),
      ),
    };
    const list = managerPeople.get(managerName) ?? [];
    list.push(person);
    managerPeople.set(managerName, list);
    return person;
  });

  const allocatedFte = people.reduce((sum, person) => sum + person.fte, 0);
  const availableFte = people.reduce(
    (sum, person) => sum + Math.max(0, 1 - person.fte),
    0,
  );

  const projects = [...projectMap.values()]
    .map((project) => {
      const peopleList = [...project.people.values()].sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
      );
      const allocations = [...project.allocations].sort(
        (a, b) =>
          a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }) ||
          a.fromDate.localeCompare(b.fromDate),
      );
      const fte = rangeDays > 0 ? project.personDays / rangeDays : 0;
      return {
        key: project.projectId,
        projectId: project.projectId,
        projectName: project.projectName,
        peopleCount: peopleList.length,
        allocationCount: project.allocationCount,
        fte,
        personDays: project.personDays,
        avgPct: peopleList.length ? Math.round((fte / peopleList.length) * 100) : 0,
        people: peopleList,
        allocations,
      };
    })
    .sort((a, b) => b.fte - a.fte || a.projectName.localeCompare(b.projectName));

  const managers = [...managerPeople.entries()]
    .map(([managerName, team]) => {
      const allocated = team.filter((person) => person.fte > 0);
      const allocatedFteForTeam = team.reduce((sum, person) => sum + person.fte, 0);
      const availableFteForTeam = team.reduce(
        (sum, person) => sum + Math.max(0, 1 - person.fte),
        0,
      );
      const projectEntries = [...(managerProjects.get(managerName) ?? new Map()).entries()]
        .map(([name, days]) => ({
          name,
          fte: rangeDays > 0 ? days / rangeDays : 0,
        }))
        .sort((a, b) => b.fte - a.fte || a.name.localeCompare(b.name));
      const avgPct = team.length
        ? Math.round(team.reduce((sum, person) => sum + person.allocatedPct, 0) / team.length)
        : 0;
      return {
        key: managerName,
        managerName,
        teamSize: team.length,
        allocatedCount: allocated.length,
        projectCount: projectEntries.length,
        avgPct,
        allocatedFte: allocatedFteForTeam,
        availableFte: availableFteForTeam,
        personDays: team.reduce((sum, person) => sum + person.personDays, 0),
        people: [...team].sort((a, b) =>
          a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
        ),
        projects: projectEntries,
      };
    })
    .sort((a, b) => b.allocatedFte - a.allocatedFte || a.managerName.localeCompare(b.managerName));

  const allocatedPeople = people
    .filter((person) => person.fte > 0)
    .sort(
      (a, b) =>
        b.fte - a.fte || a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
    );
  const unallocatedPeople = people
    .filter((person) => person.fte <= 0)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }));

  return {
    totals: {
      teamSize: people.length,
      allocatedCount: allocatedPeople.length,
      unallocatedCount: unallocatedPeople.length,
      allocatedFte,
      availableFte,
      projectCount: projects.length,
      rangeDays,
    },
    projects,
    managers,
    allocatedPeople,
    unallocatedPeople,
  };
}

export type WorkCategoryManagerNode = {
  key: string;
  managerId: string;
  managerName: string;
  team: SummaryPerson[];
  projects: { name: string; fte: number }[];
  teamSize: number;
  allocatedCount: number;
  projectCount: number;
  allocatedFte: number;
  availableFte: number;
};

export type WorkCategoryTree = {
  id: string;
  name: string;
  sortOrder?: number;
  managers: WorkCategoryManagerNode[];
  teamSize: number;
  allocatedCount: number;
  projectCount: number;
  allocatedFte: number;
  availableFte: number;
};

function normName(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function priorityValue(value?: number | null): number {
  if (value == null || !Number.isFinite(Number(value))) return Number.MAX_SAFE_INTEGER;
  return Number(value);
}

export function compareByPriority(
  a: { sortOrder?: number | null; name: string },
  b: { sortOrder?: number | null; name: string },
): number {
  const order = priorityValue(a.sortOrder) - priorityValue(b.sortOrder);
  return order !== 0
    ? order
    : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function personScopedToWorkCategory(
  person: SummaryPerson,
  workCategoryId: string | null,
  rangeFrom: string,
  rangeTo: string,
  rangeDays: number,
): SummaryPerson | null {
  const scoped = person.allocations.filter((allocation) =>
    workCategoryId
      ? allocation.workCategoryId === workCategoryId
      : !allocation.workCategoryId,
  );
  let personDays = 0;
  const inRange: Allocation[] = [];
  for (const allocation of scoped) {
    const days = overlapDays(allocation, rangeFrom, rangeTo);
    if (days <= 0) continue;
    inRange.push(allocation);
    personDays += (allocation.percentage * days) / 100;
  }
  if (inRange.length === 0) return null;
  const fte = rangeDays > 0 ? personDays / rangeDays : 0;
  const allocatedPct = Math.round(fte * 100);
  return {
    ...person,
    allocations: inRange,
    personDays,
    fte,
    allocatedPct,
    availablePct: Math.max(0, 100 - allocatedPct),
  };
}

function projectsFromPeople(
  people: SummaryPerson[],
  rangeFrom: string,
  rangeTo: string,
  rangeDays: number,
): { name: string; fte: number }[] {
  const byName = new Map<string, number>();
  for (const person of people) {
    for (const allocation of person.allocations) {
      const days = overlapDays(allocation, rangeFrom, rangeTo);
      if (days <= 0) continue;
      const name = allocation.projectName?.trim() || allocation.workCategoryName || 'Unassigned';
      byName.set(name, (byName.get(name) ?? 0) + (allocation.percentage * days) / 100);
    }
  }
  return [...byName.entries()]
    .map(([name, days]) => ({
      name,
      fte: rangeDays > 0 ? days / rangeDays : 0,
    }))
    .sort((a, b) => b.fte - a.fte || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function managerNodeFromTeam(
  key: string,
  managerId: string,
  managerName: string,
  team: SummaryPerson[],
  rangeFrom: string,
  rangeTo: string,
  rangeDays: number,
): WorkCategoryManagerNode {
  const unique = [...new Map(team.map((person) => [person.employeeId, person])).values()].sort(
    (a, b) => a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
  );
  const projects = projectsFromPeople(unique, rangeFrom, rangeTo, rangeDays);
  const allocatedFte = unique.reduce((sum, person) => sum + person.fte, 0);
  const availableFte = unique.reduce((sum, person) => sum + Math.max(0, 1 - person.fte), 0);
  return {
    key,
    managerId,
    managerName,
    team: unique,
    projects,
    teamSize: unique.length,
    allocatedCount: unique.filter((person) => person.fte > 0).length,
    projectCount: projects.length,
    allocatedFte,
    availableFte,
  };
}

function addPersonToManagerBucket(
  byManager: Map<string, { id: string; name: string; team: SummaryPerson[] }>,
  managerId: string,
  managerName: string,
  person: SummaryPerson,
) {
  const existing = byManager.get(managerId);
  if (existing) {
    existing.team.push(person);
    return;
  }
  byManager.set(managerId, { id: managerId, name: managerName, team: [person] });
}

/** Manager rows follow the functional unit's assigned managers. People allocated to the unit are placed under the assigned manager they report to. */
function managerBucketsForCategory(
  category: WorkCategory,
  scopedPeople: SummaryPerson[],
): Map<string, { id: string; name: string; team: SummaryPerson[] }> {
  const assigned = category.engineeringManagers ?? [];
  const byManager = new Map<string, { id: string; name: string; team: SummaryPerson[] }>();
  if (assigned.length === 0) {
    for (const person of scopedPeople) {
      const managerId =
        person.engineeringManagerManagementId ||
        normName(person.engineeringManagerName) ||
        'unassigned';
      const managerName = person.engineeringManagerName?.trim() || 'Unassigned';
      addPersonToManagerBucket(byManager, managerId, managerName, person);
    }
    return byManager;
  }

  const assignedIds = new Set(assigned.map((manager) => manager.id));
  const assignedIdByName = new Map(assigned.map((manager) => [normName(manager.name), manager.id]));
  for (const manager of assigned) {
    byManager.set(manager.id, { id: manager.id, name: manager.name, team: [] });
  }
  for (const person of scopedPeople) {
    const matchedId =
      (person.engineeringManagerManagementId &&
        assignedIds.has(person.engineeringManagerManagementId) &&
        person.engineeringManagerManagementId) ||
      assignedIdByName.get(normName(person.engineeringManagerName));
    if (matchedId && byManager.has(matchedId)) {
      byManager.get(matchedId)!.team.push(person);
      continue;
    }
    if (assigned.length === 1) {
      byManager.get(assigned[0].id)!.team.push(person);
      continue;
    }
    const managerId =
      person.engineeringManagerManagementId ||
      normName(person.engineeringManagerName) ||
      'unassigned';
    const managerName = person.engineeringManagerName?.trim() || 'Unassigned';
    addPersonToManagerBucket(byManager, managerId, managerName, person);
  }
  return byManager;
}

export function buildWorkCategoryTrees(
  people: SummaryPerson[],
  managers: ManagerAllocationSummary[],
  workCategories: WorkCategory[],
  rangeFrom: string,
  rangeTo: string,
  options?: { includeUnassigned?: boolean },
): WorkCategoryTree[] {
  const rangeDays = inclusiveDayCount(rangeFrom, rangeTo);

  const trees = workCategories
    .map((category) => {
      const scopedPeople = people
        .map((person) =>
          personScopedToWorkCategory(person, category.id, rangeFrom, rangeTo, rangeDays),
        )
        .filter((person): person is SummaryPerson => person != null);
      const byManager = managerBucketsForCategory(category, scopedPeople);
      const managerNodes = [...byManager.values()]
        .map((group) =>
          managerNodeFromTeam(
            `${category.id}:${group.id}`,
            group.id,
            group.name,
            group.team,
            rangeFrom,
            rangeTo,
            rangeDays,
          ),
        )
        .sort((a, b) =>
          a.managerName.localeCompare(b.managerName, undefined, { sensitivity: 'base' }),
        );
      return {
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        managers: managerNodes,
        teamSize: managerNodes.reduce((sum, node) => sum + node.teamSize, 0),
        allocatedCount: managerNodes.reduce((sum, node) => sum + node.allocatedCount, 0),
        projectCount: new Set(managerNodes.flatMap((node) => node.projects.map((project) => project.name))).size,
        allocatedFte: managerNodes.reduce((sum, node) => sum + node.allocatedFte, 0),
        availableFte: managerNodes.reduce((sum, node) => sum + node.availableFte, 0),
      };
    })
    .sort(compareByPriority);

  if (options?.includeUnassigned !== false) {
    const leftoverNodes: WorkCategoryManagerNode[] = managers
      .map((manager) => {
        const team = manager.people
          .map((person) =>
            personScopedToWorkCategory(person, null, rangeFrom, rangeTo, rangeDays),
          )
          .filter((person): person is SummaryPerson => person != null);
        return managerNodeFromTeam(
          `unassigned:${manager.key}`,
          manager.key,
          manager.managerName,
          team,
          rangeFrom,
          rangeTo,
          rangeDays,
        );
      })
      .filter((node) => node.teamSize > 0);
    leftoverNodes.sort((a, b) =>
      a.managerName.localeCompare(b.managerName, undefined, { sensitivity: 'base' }),
    );
    if (leftoverNodes.length > 0) {
      trees.push({
        id: 'unassigned',
        name: 'No functional unit',
        managers: leftoverNodes,
        teamSize: leftoverNodes.reduce((sum, node) => sum + node.teamSize, 0),
        allocatedCount: leftoverNodes.reduce((sum, node) => sum + node.allocatedCount, 0),
        projectCount: new Set(leftoverNodes.flatMap((node) => node.projects.map((project) => project.name))).size,
        allocatedFte: leftoverNodes.reduce((sum, node) => sum + node.allocatedFte, 0),
        availableFte: leftoverNodes.reduce((sum, node) => sum + node.availableFte, 0),
      });
    }
  }
  return trees;
}

export function formatFte(value: number): string {
  return value.toFixed(1);
}

export function formatPersonDays(value: number): string {
  return value.toFixed(1);
}
