import { Link } from 'react-router-dom';
import { RAGIndicator } from '@/components/RAGIndicator';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
}

function orgPath(project: Project): string {
  const parts = [project.regionName, project.countryName, project.clientName].filter(Boolean);
  return parts.length > 0 ? parts.join(' › ') : '—';
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-xl border border-border bg-bg2 p-5 transition hover:border-accent/50 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{project.name}</h3>
          <p className="mt-1 text-sm text-text2">{orgPath(project)}</p>
          {project.product && (
            <p className="mt-1 text-xs text-text2">Product: {project.product}</p>
          )}
        </div>
        <RAGIndicator status={project.ragStatus} />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-text2">VP</dt>
          <dd className="text-right font-medium">{project.vpName ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text2">EM</dt>
          <dd className="text-right font-medium">{project.engineeringManagerName ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-2">
          <dt className="text-text2"># Backlog item</dt>
          <dd className="tabular-nums font-semibold">{project.backlogItemCount ?? 0}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text2"># Items without Utilization</dt>
          <dd className="tabular-nums font-semibold">{project.issuesWithoutUtilizationCount ?? 0}</dd>
        </div>
      </dl>
    </Link>
  );
}
