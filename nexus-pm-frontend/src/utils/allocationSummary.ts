import type { Allocation, Capacity } from '@/types';
import { capacityAllocations, inclusiveDayCount } from '@/utils/allocationUi';

export type SummaryPerson = {
  employeeId: string;
  employeeName: string;
  designationName?: string;
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

export function formatFte(value: number): string {
  return value.toFixed(1);
}

export function formatPersonDays(value: number): string {
  return value.toFixed(1);
}
