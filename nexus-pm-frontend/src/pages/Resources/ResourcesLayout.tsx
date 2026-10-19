import { NavLink, Outlet } from 'react-router-dom';
import { Users } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 pb-3 text-sm font-medium transition ${
    isActive ? 'border-accent text-accent' : 'border-transparent text-text2 hover:text-text'
  }`;

export function ResourcesLayout() {
  const { can } = usePermissions();
  const showSubNav = can(P.ALLOCATIONS_VIEW);

  if (!showSubNav) {
    return <Outlet />;
  }

  return (
    <div className="min-w-0 max-w-full">
      <div className="flex items-center gap-3">
        <Users className="text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Resource Utilization</h1>
          <p className="text-text2">Team capacity, allocations, and timeline</p>
        </div>
      </div>

      <nav className="-mb-px mt-6 flex flex-wrap gap-6 border-b border-border">
        <NavLink to="/resources" end className={tabClass}>
          Utilization
        </NavLink>
        <NavLink to="/resources/timeline" className={tabClass}>
          Timeline
        </NavLink>
        <NavLink to="/resources/summary" className={tabClass}>
          Summary
        </NavLink>
        <NavLink to="/resources/charts" className={tabClass}>
          Charts
        </NavLink>
        <NavLink to="/resources/history" className={tabClass}>
          History
        </NavLink>
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
