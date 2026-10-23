import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { fetchEmProjectRdSummary, type EmProjectRdItem, type EmProjectRdRow } from '@/api/issues.api';
import { fetchProjects } from '@/api/projects.api';
import { MultiStatusFilter } from '@/components/MultiStatusFilter';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { RD_STATUS_BUCKETS, RD_STATUS_STEPS, rdStatusBarFontColor } from '@/utils/allocationUi';
import { downloadBacklogRegionExcel, type BacklogRegionExcelRow } from '@/utils/backlogRegionExport';

type BucketSum = {
  key: string;
  rdCount: number;
  effort: number;
  rds: EmProjectRdItem[];
};

type CountryGroup = {
  key: string;
  name: string;
  projects: EmProjectRdRow[];
};

type RegionGroup = {
  name: string;
  countries: CountryGroup[];
};

type RdPopup = {
  title: string;
  subtitle: string;
  rows: EmProjectRdItem[];
};

function formatCount(value: number): string {
  if (!value) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function bucketSums(projects: EmProjectRdRow[]): BucketSum[] {
  const sums = RD_STATUS_BUCKETS.map((bucket) => ({
    key: bucket.key,
    rdCount: 0,
    effort: 0,
    rds: [] as EmProjectRdItem[],
  }));
  const indexByKey = new Map(sums.map((bucket, index) => [bucket.key, index]));
  for (const project of projects) {
    for (const bucket of project.buckets ?? []) {
      const index = indexByKey.get(bucket.key);
      if (index == null) continue;
      const target = sums[index];
      target.rdCount += bucket.rdCount ?? 0;
      target.effort += bucket.effort ?? 0;
      target.rds.push(...(bucket.rds ?? []));
    }
  }
  return sums;
}

function totals(buckets: BucketSum[]) {
  return buckets.reduce(
    (sum, bucket) => ({
      rdCount: sum.rdCount + bucket.rdCount,
      effort: sum.effort + bucket.effort,
      rds: sum.rds.concat(bucket.rds),
    }),
    { rdCount: 0, effort: 0, rds: [] as EmProjectRdItem[] },
  );
}

function groupByRegion(projects: EmProjectRdRow[]): RegionGroup[] {
  const regions = new Map<string, Map<string, EmProjectRdRow[]>>();
  for (const project of projects) {
    const region = project.regionName?.trim() || 'Unassigned region';
    const country = project.countryName?.trim() || 'Unassigned country';
    const countries = regions.get(region) ?? new Map<string, EmProjectRdRow[]>();
    const list = countries.get(country) ?? [];
    list.push(project);
    countries.set(country, list);
    regions.set(region, countries);
  }
  return [...regions.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([name, countries]) => ({
      name,
      countries: [...countries.entries()]
        .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .map(([country, list]) => ({
          key: `${name}|${country}`,
          name: country,
          projects: [...list].sort((a, b) =>
            a.projectName.localeCompare(b.projectName, undefined, { sensitivity: 'base' }),
          ),
        })),
    }));
}

const STATUS_COLUMNS = RD_STATUS_STEPS.map((step) => ({
  key: String(step.sequence),
  name: step.name,
  sequences: String(step.sequence).padStart(2, '0'),
  color: rdStatusBarFontColor(step.sequence),
}));

function sequenceSums(projects: EmProjectRdRow[]): BucketSum[] {
  const sums = RD_STATUS_STEPS.map((step) => ({
    key: String(step.sequence),
    rdCount: 0,
    effort: 0,
    rds: [] as EmProjectRdItem[],
  }));
  for (const project of projects) {
    for (const bucket of project.buckets ?? []) {
      for (const rd of bucket.rds ?? []) {
        const index = (rd.statusSequence ?? 0) - 1;
        if (index < 0 || index >= sums.length) continue;
        sums[index].rdCount += 1;
        sums[index].effort += rd.effort ?? 0;
        sums[index].rds.push(rd);
      }
    }
  }
  return sums;
}

function toggleSet(current: Set<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function statusLabel(rd: EmProjectRdItem): string {
  const seq = String(rd.statusSequence ?? '').padStart(2, '0');
  return rd.statusName?.trim() ? `${seq} ${rd.statusName.trim()}` : seq;
}

function RdCell({
  count,
  compact,
  onOpen,
}: {
  count: number;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const label = formatCount(count);
  const size = compact ? 'text-xs' : 'text-sm';
  if (!label) return <span className={size} />;
  if (!onOpen) return <span className={`${size} tabular-nums`}>{label}</span>;
  return (
    <button type="button" onClick={onOpen} className={`${size} tabular-nums text-accent hover:underline`}>
      {label}
    </button>
  );
}

function EffortCell({ value, compact }: { value: number; compact?: boolean }) {
  const label = formatCount(value);
  return <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold tabular-nums`}>{label}</span>;
}

export function BacklogRegionPage() {
  const [openRegions, setOpenRegions] = useState<Set<string>>(() => new Set());
  const [openCountries, setOpenCountries] = useState<Set<string>>(() => new Set());
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [popup, setPopup] = useState<RdPopup | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<'summary' | 'statuses'>('summary');

  const { data, isLoading, error } = useQuery({
    queryKey: ['em-project-rd-summary'],
    queryFn: fetchEmProjectRdSummary,
  });
  const { data: projectPage } = useQuery({
    queryKey: ['projects-for-region'],
    queryFn: () => fetchProjects({ size: 1000 }),
  });

  const allProjects = useMemo(() => {
    const byId = new Map((projectPage?.content ?? []).map((project) => [project.id, project]));
    return (data?.projects ?? []).map((row) => {
      const project = byId.get(row.projectId);
      return {
        ...row,
        regionName: row.regionName?.trim() || project?.regionName,
        countryName: row.countryName?.trim() || project?.countryName,
      };
    });
  }, [data, projectPage]);
  const regionOptions = useMemo(() => {
    const names = new Set(allProjects.map((project) => project.regionName?.trim() || 'Unassigned region'));
    return [...names]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((name) => ({ id: name, name }));
  }, [allProjects]);
  const countryOptions = useMemo(() => {
    const names = new Set(
      allProjects
        .filter((project) => {
          if (selectedRegions.length === 0) return true;
          const region = project.regionName?.trim() || 'Unassigned region';
          return selectedRegions.includes(region);
        })
        .map((project) => project.countryName?.trim() || 'Unassigned country'),
    );
    return [...names]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((name) => ({ id: name, name }));
  }, [allProjects, selectedRegions]);
  useEffect(() => {
    setSelectedCountries((current) => current.filter((name) => countryOptions.some((option) => option.id === name)));
  }, [countryOptions]);
  const filteredProjects = useMemo(
    () =>
      allProjects.filter((project) => {
        const region = project.regionName?.trim() || 'Unassigned region';
        const country = project.countryName?.trim() || 'Unassigned country';
        if (selectedRegions.length > 0 && !selectedRegions.includes(region)) return false;
        if (selectedCountries.length > 0 && !selectedCountries.includes(country)) return false;
        return true;
      }),
    [allProjects, selectedRegions, selectedCountries],
  );
  const regions = useMemo(() => groupByRegion(filteredProjects), [filteredProjects]);
  const sumProjects = tab === 'summary' ? bucketSums : sequenceSums;
  const columns = tab === 'summary' ? RD_STATUS_BUCKETS : STATUS_COLUMNS;
  const grandBuckets = useMemo(() => sumProjects(filteredProjects), [sumProjects, filteredProjects]);
  const grand = useMemo(() => totals(grandBuckets), [grandBuckets]);

  const handleExport = async () => {
    if (exporting || regions.length === 0) return;
    const rows: BacklogRegionExcelRow[] = [];
    for (const region of regions) {
      const regionProjects = region.countries.flatMap((country) => country.projects);
      const regionBuckets = sumProjects(regionProjects);
      const regionTotal = totals(regionBuckets);
      rows.push({
        level: 'region',
        region: region.name,
        country: '',
        project: '',
        buckets: regionBuckets,
        totalRd: regionTotal.rdCount,
        totalEffort: regionTotal.effort,
      });
      for (const country of region.countries) {
        const countryBuckets = sumProjects(country.projects);
        const countryTotal = totals(countryBuckets);
        rows.push({
          level: 'country',
          region: region.name,
          country: country.name,
          project: '',
          buckets: countryBuckets,
          totalRd: countryTotal.rdCount,
          totalEffort: countryTotal.effort,
        });
        for (const project of country.projects) {
          const projectBuckets = sumProjects([project]);
          const projectTotal = totals(projectBuckets);
          rows.push({
            level: 'project',
            region: region.name,
            country: country.name,
            project: project.projectName,
            buckets: projectBuckets,
            totalRd: projectTotal.rdCount,
            totalEffort: projectTotal.effort,
          });
        }
      }
    }
    rows.push({
      level: 'total',
      region: 'Total',
      country: '',
      project: '',
      buckets: grandBuckets,
      totalRd: grand.rdCount,
      totalEffort: grand.effort,
    });
    setExporting(true);
    try {
      await downloadBacklogRegionExcel(
        rows,
        columns.map((column) => ({ name: column.name, color: column.color })),
        tab === 'statuses' ? 'backlog-by-status' : 'backlog-by-region',
      );
    } catch {
      window.alert('Failed to export Excel. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const openRds = (title: string, subtitle: string, rows: EmProjectRdItem[]) => {
    if (rows.length === 0) return;
    setPopup({ title, subtitle, rows });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Backlog by region</h1>
      <p className="mt-1 text-sm text-text2">
        RD count and effort for statuses 1–17, grouped by region, country, and project.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <MultiStatusFilter
          fieldLabel="Region"
          allLabel="All regions"
          menuLabel="Regions"
          noun="region"
          className="z-30"
          statuses={regionOptions}
          selectedIds={selectedRegions}
          onChange={setSelectedRegions}
          disabled={isLoading || regionOptions.length === 0}
        />
        <MultiStatusFilter
          fieldLabel="Country"
          allLabel="All countries"
          menuLabel="Countries"
          noun="country"
          plural="countries"
          className="z-30"
          statuses={countryOptions}
          selectedIds={selectedCountries}
          onChange={setSelectedCountries}
          disabled={isLoading || countryOptions.length === 0}
        />
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || isLoading || regions.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg3 disabled:opacity-60"
        >
          <Download size={16} />
          {exporting ? 'Exporting…' : 'Export Excel'}
        </button>
      </div>

      <nav className="-mb-px mt-6 flex gap-6 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('summary')}
          className={`border-b-2 pb-3 text-sm font-medium ${
            tab === 'summary' ? 'border-accent text-accent' : 'border-transparent text-text2 hover:text-text'
          }`}
        >
          Summary
        </button>
        <button
          type="button"
          onClick={() => setTab('statuses')}
          className={`border-b-2 pb-3 text-sm font-medium ${
            tab === 'statuses' ? 'border-accent text-accent' : 'border-transparent text-text2 hover:text-text'
          }`}
        >
          Statuses
        </button>
      </nav>

      {isLoading && <p className="mt-6 text-sm text-text2">Loading backlog…</p>}
      {error && <p className="mt-6 text-sm text-danger">Failed to load the backlog summary.</p>}
      {!isLoading && !error && allProjects.length === 0 && (
        <p className="mt-6 text-sm text-text2">No projects with backlog items to show.</p>
      )}
      {!isLoading && !error && allProjects.length > 0 && regions.length === 0 && (
        <p className="mt-6 text-sm text-text2">No projects match the selected region and country.</p>
      )}

      {regions.length > 0 && (
        <div className="mt-6 overflow-auto rounded-xl border border-border">
          <table className="w-max min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-bg3 text-center shadow-[0_1px_0_var(--border)]">
              <tr>
                <th rowSpan={2} className="sticky left-0 z-20 bg-bg3 px-3 py-2 text-left text-xs font-semibold text-text2">
                  Region
                </th>
                {columns.map((bucket) => (
                  <th
                    key={bucket.key}
                    colSpan={2}
                    className="min-w-[6.5rem] border-l border-border px-2 py-2 text-[11px] font-semibold"
                    style={{ color: bucket.color }}
                  >
                    <span className="block">{bucket.name}</span>
                    <span className="block text-[10px] font-normal opacity-80">({bucket.sequences})</span>
                  </th>
                ))}
                <th colSpan={2} className="border-l border-border px-2 py-2 text-xs font-semibold text-text2">
                  Total
                </th>
              </tr>
              <tr className="text-[11px] text-text2">
                {columns.map((bucket) => (
                  <Fragment key={`${bucket.key}-sub`}>
                    <th className="border-l border-border px-2 py-1 font-medium">RD</th>
                    <th className="px-2 py-1 font-semibold">Et</th>
                  </Fragment>
                ))}
                <th className="border-l border-border px-2 py-1 font-medium">RD</th>
                <th className="px-2 py-1 font-semibold">Et</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) => {
                const regionOpen = openRegions.has(region.name);
                const regionProjects = region.countries.flatMap((country) => country.projects);
                const regionBuckets = sumProjects(regionProjects);
                const regionTotal = totals(regionBuckets);
                return (
                  <Fragment key={region.name}>
                    <tr className="border-t border-border bg-bg2">
                      <td className="sticky left-0 z-[1] bg-bg2 px-3 py-2 font-semibold">
                        <button
                          type="button"
                          onClick={() => setOpenRegions((prev) => toggleSet(prev, region.name))}
                          className="inline-flex items-center gap-1 text-left"
                          aria-expanded={regionOpen}
                        >
                          {regionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          {region.name}
                        </button>
                      </td>
                      <CountCells
                        buckets={regionBuckets}
                        total={regionTotal}
                        onRd={(bucket) =>
                          openRds(region.name, `${bucketLabel(bucket.key)}`, bucket.rds)
                        }
                        onTotal={() => openRds(region.name, 'All statuses', regionTotal.rds)}
                      />
                    </tr>
                    {regionOpen &&
                      region.countries.map((country) => {
                        const countryOpen = openCountries.has(country.key);
                        const countryBuckets = sumProjects(country.projects);
                        const countryTotal = totals(countryBuckets);
                        return (
                          <Fragment key={country.key}>
                            <tr className="border-t border-border bg-slate-200 dark:bg-slate-700">
                              <td className="sticky left-0 z-[1] bg-slate-200 py-2 pl-8 pr-3 font-medium dark:bg-slate-700">
                                <button
                                  type="button"
                                  onClick={() => setOpenCountries((prev) => toggleSet(prev, country.key))}
                                  className="inline-flex items-center gap-1 text-left"
                                  aria-expanded={countryOpen}
                                >
                                  {countryOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                  {country.name}
                                </button>
                              </td>
                              <CountCells
                                buckets={countryBuckets}
                                total={countryTotal}
                                onRd={(bucket) =>
                                  openRds(
                                    `${region.name} · ${country.name}`,
                                    bucketLabel(bucket.key),
                                    bucket.rds,
                                  )
                                }
                                onTotal={() =>
                                  openRds(`${region.name} · ${country.name}`, 'All statuses', countryTotal.rds)
                                }
                              />
                            </tr>
                            {countryOpen &&
                              country.projects.map((project) => {
                                const projectBuckets = sumProjects([project]);
                                const projectTotal = totals(projectBuckets);
                                return (
                                  <tr key={project.projectId} className="border-t border-border bg-bg">
                                    <td className="sticky left-0 z-[1] bg-bg py-1.5 pl-14 pr-3 text-sm">
                                      {project.projectName}
                                    </td>
                                    <CountCells
                                      compact
                                      buckets={projectBuckets}
                                      total={projectTotal}
                                      onRd={(bucket) =>
                                        openRds(project.projectName, bucketLabel(bucket.key), bucket.rds)
                                      }
                                      onTotal={() =>
                                        openRds(project.projectName, 'All statuses', projectTotal.rds)
                                      }
                                    />
                                  </tr>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
              <tr className="border-t border-border bg-bg3 font-semibold">
                <td className="sticky left-0 z-[1] bg-bg3 px-3 py-2">Total</td>
                <CountCells
                  buckets={grandBuckets}
                  total={grand}
                  onRd={(bucket) => openRds('Total', bucketLabel(bucket.key), bucket.rds)}
                  onTotal={() => openRds('Total', 'All statuses', grand.rds)}
                />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {popup && (
        <SlideOverPanel
          title={popup.title}
          subtitle={`${popup.rows.length} RDs · ${popup.subtitle}`}
          onClose={() => setPopup(null)}
          wide
          protectUnsaved={false}
        >
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-bg2 text-left text-xs font-medium text-text2">
                <tr>
                  <th className="px-3 py-2">RD</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Effort</th>
                </tr>
              </thead>
              <tbody>
                {popup.rows.map((rd, index) => (
                  <tr key={rd.issueId ?? `${rd.displayKey}-${index}`} className="border-t border-border">
                    <td className="px-3 py-2">
                      {rd.issueId ? (
                        <Link to={`/issues/${rd.issueId}`} className="font-medium text-accent hover:underline">
                          {rd.displayKey}
                        </Link>
                      ) : (
                        <span className="font-medium">{rd.displayKey}</span>
                      )}
                      {rd.title && rd.title !== rd.displayKey && (
                        <p className="text-xs text-text2">{rd.title}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium" style={{ color: rdStatusBarFontColor(rd.statusSequence) }}>
                      {statusLabel(rd)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatCount(rd.effort ?? 0) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SlideOverPanel>
      )}
    </div>
  );
}

function bucketLabel(key: string): string {
  const bucket = RD_STATUS_BUCKETS.find((item) => item.key === key);
  if (bucket) return `${bucket.name} (${bucket.sequences})`;
  const status = STATUS_COLUMNS.find((item) => item.key === key);
  return status ? `${status.sequences} ${status.name}` : key;
}

function CountCells({
  buckets,
  total,
  compact,
  onRd,
  onTotal,
}: {
  buckets: BucketSum[];
  total: { rdCount: number; effort: number; rds: EmProjectRdItem[] };
  compact?: boolean;
  onRd: (bucket: BucketSum) => void;
  onTotal: () => void;
}) {
  return (
    <>
      {buckets.map((bucket) => (
        <Fragment key={bucket.key}>
          <td className="border-l border-border px-2 py-2 text-center">
            <RdCell
              count={bucket.rdCount}
              compact={compact}
              onOpen={bucket.rdCount > 0 ? () => onRd(bucket) : undefined}
            />
          </td>
          <td className="px-2 py-2 text-center">
            <EffortCell value={bucket.effort} compact={compact} />
          </td>
        </Fragment>
      ))}
      <td className="border-l border-border px-2 py-2 text-center">
        <RdCell count={total.rdCount} compact={compact} onOpen={total.rdCount > 0 ? onTotal : undefined} />
      </td>
      <td className="px-2 py-2 text-center">
        <EffortCell value={total.effort} compact={compact} />
      </td>
    </>
  );
}
