import { Link } from 'react-router-dom';
import { RAGIndicator } from '@/components/RAGIndicator';
import type { Project } from '@/types';

interface ProjectGridProps {
  projects: Project[];
  showManageActions?: boolean;
}

export function ProjectGrid({ projects, showManageActions = false }: ProjectGridProps) {
  return (
    <div className="max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 z-[1] bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2">
          <tr>
            <th className="w-12 px-3 py-3">#</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">RAG</th>
            <th className="px-4 py-3">Region</th>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">Status</th>
            {showManageActions && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {projects.map((project, index) => (
            <tr key={project.id} className="border-t border-border hover:bg-bg2/50">
              <td className="px-3 py-3 tabular-nums text-text2">{index + 1}</td>
              <td className="px-4 py-3">
                <Link to={`/projects/${project.id}`} className="font-medium hover:text-accent">
                  {project.name}
                </Link>
                {project.archived && (
                  <span className="ml-2 rounded bg-bg3 px-1.5 py-0.5 text-xs text-text2">Archived</span>
                )}
              </td>
              <td className="px-4 py-3 text-text2">{project.clientName ?? '—'}</td>
              <td className="px-4 py-3">
                <RAGIndicator status={project.ragStatus} />
              </td>
              <td className="px-4 py-3 text-text2">{project.regionName ?? '—'}</td>
              <td className="px-4 py-3 tabular-nums text-text2">{project.teamSize ?? 0}</td>
              <td className="px-4 py-3 text-text2">{project.status}</td>
              {showManageActions && (
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/projects/${project.id}`}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Manage
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
