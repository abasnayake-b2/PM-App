import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCountries } from '@/api/organisations.api';
import {
  fetchRosterDesignations,
  fetchRosterStreams,
  fetchRosterWorkTypes,
} from '@/api/rosterLookups.api';
import { fetchEngineeringManagers, type TeamRosterMember } from '@/api/teamRoster.api';

const EMPTY_ROWS: TeamRosterMember[] = [];

const filterSelectClass =
  'mt-1 block w-full min-w-[9rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm';

function mergeOptions(fromLookup: string[], fromRows: (string | undefined | null)[]): string[] {
  const set = new Set<string>();
  for (const value of fromLookup) {
    const trimmed = value.trim();
    if (trimmed) set.add(trimmed);
  }
  for (const value of fromRows) {
    const trimmed = (value ?? '').trim();
    if (trimmed) set.add(trimmed);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function matchesFilter(actual: string | undefined | null, selected: string): boolean {
  if (!selected) return true;
  return (actual ?? '').trim().toLowerCase() === selected.trim().toLowerCase();
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  optionLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
  optionLabel?: (value: string) => string;
}) {
  return (
    <label className="min-w-[9rem] flex-1 text-sm sm:max-w-[14rem]">
      <span className="text-text2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={filterSelectClass}
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {optionLabel ? optionLabel(opt) : opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export function useRosterMemberFilters(rows: TeamRosterMember[] | undefined) {
  const [designationFilter, setDesignationFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [emFilter, setEmFilter] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('');

  const { data: designations = [] } = useQuery({
    queryKey: ['roster-designations'],
    queryFn: fetchRosterDesignations,
  });
  const { data: streams = [] } = useQuery({
    queryKey: ['roster-streams'],
    queryFn: fetchRosterStreams,
  });
  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => fetchCountries(),
  });
  const { data: workTypes = [] } = useQuery({
    queryKey: ['roster-work-types'],
    queryFn: fetchRosterWorkTypes,
  });
  const { data: engineeringManagers = [] } = useQuery({
    queryKey: ['engineering-managers'],
    queryFn: fetchEngineeringManagers,
  });

  const list = rows ?? EMPTY_ROWS;

  const options = useMemo(() => {
    const designationByName = new Map(designations.map((d) => [d.name, d] as const));
    return {
      designations: mergeOptions(
        designations.map((d) => d.name),
        list.map((row) => row.designation),
      ),
      designationLabel: (name: string) => {
        const d = designationByName.get(name);
        return d?.code ? `${d.code} — ${d.name}` : name;
      },
      teams: mergeOptions(
        streams.map((s) => s.name),
        list.map((row) => row.teamName),
      ),
      countries: mergeOptions(
        countries.map((c) => c.name),
        list.map((row) => row.country),
      ),
      products: mergeOptions(
        [],
        list.map((row) => row.product),
      ),
      ems: mergeOptions(engineeringManagers, list.map((row) => row.engineeringManagerName)),
      workTypes: mergeOptions(
        workTypes.map((w) => w.name),
        list.map((row) => row.workType),
      ),
    };
  }, [list, designations, streams, countries, engineeringManagers, workTypes]);

  const filteredRows = useMemo(
    () =>
      list.filter(
        (row) =>
          matchesFilter(row.designation, designationFilter) &&
          matchesFilter(row.teamName, teamFilter) &&
          matchesFilter(row.country, countryFilter) &&
          matchesFilter(row.product, productFilter) &&
          matchesFilter(row.engineeringManagerName, emFilter) &&
          matchesFilter(row.workType, workTypeFilter),
      ),
    [
      list,
      designationFilter,
      teamFilter,
      countryFilter,
      productFilter,
      emFilter,
      workTypeFilter,
    ],
  );

  const hasFilters = !!(
    designationFilter ||
    teamFilter ||
    countryFilter ||
    productFilter ||
    emFilter ||
    workTypeFilter
  );

  return {
    filteredRows,
    hasFilters,
    designationFilter,
    setDesignationFilter,
    teamFilter,
    setTeamFilter,
    countryFilter,
    setCountryFilter,
    productFilter,
    setProductFilter,
    emFilter,
    setEmFilter,
    workTypeFilter,
    setWorkTypeFilter,
    options,
  };
}

export function RosterMemberFilterBar({
  filters,
}: {
  filters: ReturnType<typeof useRosterMemberFilters>;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Designation"
        value={filters.designationFilter}
        onChange={filters.setDesignationFilter}
        options={filters.options.designations}
        allLabel="All designations"
        optionLabel={filters.options.designationLabel}
      />
      <FilterSelect
        label="Team"
        value={filters.teamFilter}
        onChange={filters.setTeamFilter}
        options={filters.options.teams}
        allLabel="All teams"
      />
      <FilterSelect
        label="Country"
        value={filters.countryFilter}
        onChange={filters.setCountryFilter}
        options={filters.options.countries}
        allLabel="All countries"
      />
      <FilterSelect
        label="Product"
        value={filters.productFilter}
        onChange={filters.setProductFilter}
        options={filters.options.products}
        allLabel="All products"
      />
      <FilterSelect
        label="EM"
        value={filters.emFilter}
        onChange={filters.setEmFilter}
        options={filters.options.ems}
        allLabel="All EMs"
      />
      <FilterSelect
        label="NTP/GBL"
        value={filters.workTypeFilter}
        onChange={filters.setWorkTypeFilter}
        options={filters.options.workTypes}
        allLabel="All NTP/GBL"
      />
    </div>
  );
}
