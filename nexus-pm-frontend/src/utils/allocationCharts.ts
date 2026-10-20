import type { Allocation, Capacity } from '@/types';
import {
  allocationFunctionalUnitLabel,
  capacityAllocations,
  inclusiveDayCount,
  monthsBetween,
} from '@/utils/allocationUi';

export type MonthlyAllocationPerson = {
  name: string;
  designation?: string;
  manager?: string;
  functionalUnits: string[];
};

export type MonthlyAllocationPoint = {
  key: string;
  label: string;
  from: string;
  to: string;
  allocated: number;
  notAllocated: number;
  allocatedNames: string[];
  notAllocatedNames: string[];
  allocatedPeople: MonthlyAllocationPerson[];
  notAllocatedPeople: MonthlyAllocationPerson[];
};

function monthBounds(key: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${key}-01`,
    to: `${key}-${String(lastDay).padStart(2, '0')}`,
  };
}

function allocationOverlaps(allocation: Allocation, from: string, to: string): boolean {
  if (allocation.percentage <= 0) return false;
  const end = allocation.toDate ?? '9999-12-31';
  return allocation.fromDate <= to && end >= from;
}

type MonthWindow = {
  key: string;
  label: string;
  from: string;
  to: string;
};

function monthWindows(rangeFrom: string, rangeTo: string): MonthWindow[] {
  if (!rangeFrom || !rangeTo || rangeTo < rangeFrom) return [];
  if (inclusiveDayCount(rangeFrom, rangeTo) <= 0) return [];
  return monthsBetween(rangeFrom, rangeTo, true).flatMap((month) => {
    const bounds = monthBounds(month.key);
    if (!bounds) return [];
    const from = bounds.from < rangeFrom ? rangeFrom : bounds.from;
    const to = bounds.to > rangeTo ? rangeTo : bounds.to;
    if (to < from) return [];
    return [{ key: month.key, label: month.label, from, to }];
  });
}

function personFrom(row: Capacity, functionalUnits: string[]): MonthlyAllocationPerson {
  return {
    name: row.employeeName?.trim() || 'Unnamed',
    designation: row.designationName?.trim() || undefined,
    manager: row.engineeringManagerName?.trim() || undefined,
    functionalUnits,
  };
}

const NO_FUNCTIONAL_UNIT = 'No functional unit';

export type FunctionalUnitMonthUnit = {
  name: string;
  managers?: { id: string; name: string }[];
};

export type FunctionalUnitMonthCell = {
  allocatedPeople: MonthlyAllocationPerson[];
  notAllocatedPeople: MonthlyAllocationPerson[];
};

export type FunctionalUnitMonthRow = {
  name: string;
  cells: FunctionalUnitMonthCell[];
};

export type FunctionalUnitMonthGrid = {
  months: MonthWindow[];
  rows: FunctionalUnitMonthRow[];
};

function norm(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function managerMatches(row: Capacity, manager: { id: string; name: string }): boolean {
  if (row.engineeringManagerManagementId && manager.id === row.engineeringManagerManagementId) {
    return true;
  }
  const rowName = norm(row.engineeringManagerName);
  const managerName = norm(manager.name);
  return rowName.length > 0 && rowName === managerName;
}

/** Functional units a person with no allocation that month is counted under. */
function homeUnitNames(row: Capacity, units: FunctionalUnitMonthUnit[]): string[] {
  const names = units
    .filter(
      (unit) =>
        unit.name.trim() &&
        (unit.managers ?? []).some((manager) => managerMatches(row, manager)),
    )
    .map((unit) => unit.name.trim());
  const unique = [...new Set(names)];
  return unique.length > 0 ? unique : [NO_FUNCTIONAL_UNIT];
}

function overlappingUnitNames(row: Capacity, from: string, to: string): string[] {
  return [
    ...new Set(
      capacityAllocations(row)
        .filter((allocation) => allocationOverlaps(allocation, from, to))
        .map((allocation) => allocationFunctionalUnitLabel(allocation)),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** People with any overlapping allocation in each month of the selected range. */
export function monthlyAllocationSeries(
  rows: Capacity[],
  rangeFrom: string,
  rangeTo: string,
): MonthlyAllocationPoint[] {
  return monthWindows(rangeFrom, rangeTo).map((window) => {
    const { from, to } = window;
    const allocatedPeople: MonthlyAllocationPerson[] = [];
    const notAllocatedPeople: MonthlyAllocationPerson[] = [];
    for (const row of rows) {
      const functionalUnits = overlappingUnitNames(row, from, to);
      const person = personFrom(row, functionalUnits);
      if (functionalUnits.length > 0) allocatedPeople.push(person);
      else notAllocatedPeople.push(person);
    }
    const byName = (a: MonthlyAllocationPerson, b: MonthlyAllocationPerson) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    allocatedPeople.sort(byName);
    notAllocatedPeople.sort(byName);
    return {
      key: window.key,
      label: window.label,
      from,
      to,
      allocated: allocatedPeople.length,
      notAllocated: notAllocatedPeople.length,
      allocatedNames: allocatedPeople.map((person) => person.name),
      notAllocatedNames: notAllocatedPeople.map((person) => person.name),
      allocatedPeople,
      notAllocatedPeople,
    };
  });
}

/**
 * Functional unit × month counts. Allocated people are counted on each functional unit
 * they have an allocation in that month. People with no allocation are counted on each
 * functional unit their manager is assigned to.
 */
export function monthlyFunctionalUnitGrid(
  rows: Capacity[],
  rangeFrom: string,
  rangeTo: string,
  units: FunctionalUnitMonthUnit[],
): FunctionalUnitMonthGrid {
  const months = monthWindows(rangeFrom, rangeTo);
  const catalog = [...new Set(units.map((unit) => unit.name.trim()).filter(Boolean))];
  const canonical = new Map(catalog.map((name) => [name.toLowerCase(), name]));
  const resolve = (name: string) => canonical.get(name.toLowerCase()) ?? name;
  const byName = (a: MonthlyAllocationPerson, b: MonthlyAllocationPerson) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const buckets = months.map(() => new Map<string, FunctionalUnitMonthCell>());
  const ensure = (monthIndex: number, name: string) => {
    const key = resolve(name);
    const map = buckets[monthIndex];
    let cell = map.get(key);
    if (!cell) {
      cell = { allocatedPeople: [], notAllocatedPeople: [] };
      map.set(key, cell);
    }
    return cell;
  };

  months.forEach((window, monthIndex) => {
    for (const row of rows) {
      const functionalUnits = overlappingUnitNames(row, window.from, window.to);
      const person = personFrom(row, functionalUnits);
      if (functionalUnits.length > 0) {
        for (const unit of functionalUnits) ensure(monthIndex, unit).allocatedPeople.push(person);
      } else {
        for (const unit of homeUnitNames(row, units)) {
          ensure(monthIndex, unit).notAllocatedPeople.push(person);
        }
      }
    }
  });

  const catalogKeys = new Set(catalog.map((name) => name.toLowerCase()));
  const seen = new Set<string>();
  for (const map of buckets) {
    for (const name of map.keys()) seen.add(name);
  }
  const extras = [...seen]
    .filter((name) => name !== NO_FUNCTIONAL_UNIT && !catalogKeys.has(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const ordered = [...catalog, ...extras];
  if (seen.has(NO_FUNCTIONAL_UNIT)) ordered.push(NO_FUNCTIONAL_UNIT);

  const empty = (): FunctionalUnitMonthCell => ({ allocatedPeople: [], notAllocatedPeople: [] });
  return {
    months,
    rows: ordered.map((name) => ({
      name,
      cells: months.map((_, monthIndex) => {
        const cell = buckets[monthIndex].get(name) ?? empty();
        cell.allocatedPeople.sort(byName);
        cell.notAllocatedPeople.sort(byName);
        return cell;
      }),
    })),
  };
}
