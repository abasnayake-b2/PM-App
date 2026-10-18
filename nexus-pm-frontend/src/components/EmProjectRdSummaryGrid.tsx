import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { RD_STATUS_BUCKETS, rdStatusBarFontColor } from '@/utils/allocationUi';
import type { EmProjectRdItem, EmProjectRdRow } from '@/api/issues.api';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { EmCrMatrixPopup } from '@/components/EmCrMatrixTab';

export const PROJECT_RD_GRID_WIDTH = 620;
export const PROJECT_RD_ROW_PX = 22;
const PROJECT_COL_PX = 92;
const RD_COL_PX = 32;
const EST_COL_PX = 56;

function rdBucketSubtitle(key: string, fallback: string): string {
  const bucket = RD_STATUS_BUCKETS.find((item) => item.key === key);
  if (!bucket) return fallback;
  return `${bucket.name} (${bucket.sequences})`;
}

function cell(n: number | undefined): string {
  if (!n) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function statusLabel(rd: EmProjectRdItem): string {
  const seq = String(rd.statusSequence ?? '').padStart(2, '0');
  return rd.statusName?.trim() ? `${seq} ${rd.statusName.trim()}` : seq;
}

type RdPopup = {
  title: string;
  subtitle: string;
  rows: EmProjectRdItem[];
};

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: PROJECT_COL_PX }} />
      {RD_STATUS_BUCKETS.flatMap((bucket) => [
        <col key={`${bucket.key}-rd`} style={{ width: RD_COL_PX }} />,
        <col key={`${bucket.key}-est`} style={{ width: EST_COL_PX }} />,
      ])}
      <col style={{ width: RD_COL_PX }} />
      <col style={{ width: EST_COL_PX }} />
    </colgroup>
  );
}

function PairHeads({ border }: { border?: boolean }) {
  return (
    <>
      <th className={`px-0.5 font-normal text-text3 ${border ? 'border-r border-border/70' : ''}`}>RD</th>
      <th className={`px-0.5 font-semibold text-text2 ${border ? 'border-r border-border' : ''}`}>
        Et
      </th>
    </>
  );
}

export function EmProjectRdSummaryHeader({ onCollapse }: { onCollapse?: () => void }) {
  return (
    <table className="h-full w-full table-fixed border-collapse text-[9px] leading-tight">
      <ColGroup />
      <thead>
        <tr className="text-center">
          <th
            rowSpan={2}
            className="border-r border-border px-1 text-left text-[10px] font-medium text-text2"
          >
            <div className="flex items-center justify-between gap-0.5">
              <span>Projects</span>
              {onCollapse && (
                <button
                  type="button"
                  onClick={onCollapse}
                  className="rounded p-0.5 text-text3 hover:bg-bg3 hover:text-accent"
                  title="Collapse"
                  aria-label="Collapse project RD grid"
                >
                  <ChevronLeft size={12} />
                </button>
              )}
            </div>
          </th>
          {RD_STATUS_BUCKETS.map((bucket) => (
            <th
              key={bucket.key}
              colSpan={2}
              className="border-r border-border px-0.5 text-[10px] font-semibold"
              style={{ color: bucket.color }}
            >
              <span className="block leading-tight">{bucket.name}</span>
              <span className="block text-[8px] font-normal leading-tight opacity-80">
                ({bucket.sequences})
              </span>
            </th>
          ))}
          <th colSpan={2} className="px-0.5 text-[10px] font-medium text-text2">
            Total
          </th>
        </tr>
        <tr className="text-center">
          {RD_STATUS_BUCKETS.map((bucket) => (
            <PairHeads key={`${bucket.key}-sub`} border />
          ))}
          <PairHeads />
        </tr>
      </thead>
    </table>
  );
}

function RdCountButton({
  count,
  rows,
  onOpen,
}: {
  count: number;
  rows: EmProjectRdItem[];
  onOpen: () => void;
}) {
  const label = cell(count);
  if (!label) return null;
  if (!rows.length) return <>{label}</>;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="font-medium text-accent hover:underline"
    >
      {label}
    </button>
  );
}

export function EmProjectRdSummaryRows({ projects }: { projects: EmProjectRdRow[] }) {
  const [popup, setPopup] = useState<RdPopup | null>(null);
  const [matrixProject, setMatrixProject] = useState<{ id: string; name: string } | null>(null);

  if (projects.length === 0) {
    return <p className="px-2 py-1 text-[10px] text-text3">No RDs</p>;
  }

  return (
    <>
      <table className="w-full table-fixed border-collapse text-[10px] tabular-nums">
        <ColGroup />
        <tbody>
          {projects.map((project) => {
            const allRds = (project.buckets ?? []).flatMap((bucket) => bucket.rds ?? []);
            return (
              <tr key={project.projectId} className="border-b border-border/70 last:border-b-0">
                <td className="truncate border-r border-border px-1 py-0.5 text-left font-medium">
                  {project.projectId ? (
                    <button
                      type="button"
                      title={project.projectName}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMatrixProject({ id: project.projectId, name: project.projectName });
                      }}
                      className="block w-full truncate text-left font-medium text-accent hover:underline"
                    >
                      {project.projectName}
                    </button>
                  ) : (
                    project.projectName
                  )}
                </td>
                {(project.buckets ?? []).map((bucket) => (
                  <Fragment key={bucket.key}>
                    <td className="border-r border-border/70 px-0.5 text-center">
                      <RdCountButton
                        count={bucket.rdCount}
                        rows={bucket.rds ?? []}
                        onOpen={() =>
                          setPopup({
                            title: project.projectName,
                            subtitle: rdBucketSubtitle(bucket.key, bucket.label),
                            rows: bucket.rds ?? [],
                          })
                        }
                      />
                    </td>
                    <td className="border-r border-border px-0.5 text-center font-bold">
                      {cell(bucket.effort)}
                    </td>
                  </Fragment>
                ))}
                <td className="border-r border-border/70 px-0.5 text-center">
                  <RdCountButton
                    count={project.totalRd}
                    rows={allRds}
                    onOpen={() =>
                      setPopup({
                        title: project.projectName,
                        subtitle: 'All statuses',
                        rows: allRds,
                      })
                    }
                  />
                </td>
                <td className="px-0.5 text-center font-bold">{cell(project.totalEffort)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {matrixProject && (
        <EmCrMatrixPopup
          projectId={matrixProject.id}
          projectName={matrixProject.name}
          onClose={() => setMatrixProject(null)}
        />
      )}
      {popup && (
        <SlideOverPanel
          title={popup.title}
          subtitle={popup.subtitle}
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
                    <td
                      className="px-3 py-2 font-medium"
                      style={{ color: rdStatusBarFontColor(rd.statusSequence) }}
                    >
                      {statusLabel(rd)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{cell(rd.effort) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SlideOverPanel>
      )}
    </>
  );
}
