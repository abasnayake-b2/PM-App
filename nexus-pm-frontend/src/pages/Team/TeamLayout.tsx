import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { UserCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

export function TeamLayout() {
  const { can } = usePermissions();

  if (!can(P.TEAM_VIEW)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <UserCircle className="text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-text2">Management hierarchy and employee roster</p>
        </div>
      </div>

      <nav className="-mb-px mt-6 flex gap-6 border-b border-border">
        <NavLink
          to="/team/management"
          className={({ isActive }) =>
            `border-b-2 pb-3 text-sm font-medium transition ${
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-text2 hover:text-text'
            }`
          }
        >
          Management
        </NavLink>
        <NavLink
          to="/team/employees"
          className={({ isActive }) =>
            `border-b-2 pb-3 text-sm font-medium transition ${
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-text2 hover:text-text'
            }`
          }
        >
          Employee
        </NavLink>
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
