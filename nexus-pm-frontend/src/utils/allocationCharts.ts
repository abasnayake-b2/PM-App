import type { Allocation, Capacity } from '@/types';
import { capacityAllocations, inclusiveDayCount, monthsBetween } from '@/utils/allocationUi';

export type MonthlyAllocationPerson = {
  name: string;
  designation?: string;
  manager?: string;
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

/** People with any overlapping allocation in each month of the selected range. */
export function monthlyAllocationSeries(
  rows: Capacity[],
  rangeFrom: string,
  rangeTo: string,
): MonthlyAllocationPoint[] {
  if (!rangeFrom || !rangeTo || rangeTo < rangeFrom) return [];
  if (inclusiveDayCount(rangeFrom, rangeTo) <= 0) return [];
  return monthsBetween(rangeFrom, rangeTo, true).flatMap((month) => {
    const bounds = monthBounds(month.key);
    if (!bounds) return [];
    const from = bounds.from < rangeFrom ? rangeFrom : bounds.from;
    const to = bounds.to > rangeTo ? rangeTo : bounds.to;
    if (to < from) return [];
    const allocatedPeople: MonthlyAllocationPerson[] = [];
    const notAllocatedPeople: MonthlyAllocationPerson[] = [];
    for (const row of rows) {
      const hit = capacityAllocations(row).some((allocation) =>
        allocationOverlaps(allocation, from, to),
      );
      const person: MonthlyAllocationPerson = {
        name: row.employeeName?.trim() || 'Unnamed',
        designation: row.designationName?.trim() || undefined,
        manager: row.engineeringManagerName?.trim() || undefined,
      };
      if (hit) allocatedPeople.push(person);
      else notAllocatedPeople.push(person);
    }
    const byName = (a: MonthlyAllocationPerson, b: MonthlyAllocationPerson) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    allocatedPeople.sort(byName);
    notAllocatedPeople.sort(byName);
    return [
      {
        key: month.key,
        label: month.label,
        from,
        to,
        allocated: allocatedPeople.length,
        notAllocated: notAllocatedPeople.length,
        allocatedNames: allocatedPeople.map((person) => person.name),
        notAllocatedNames: notAllocatedPeople.map((person) => person.name),
        allocatedPeople,
        notAllocatedPeople,
      },
    ];
  });
}
