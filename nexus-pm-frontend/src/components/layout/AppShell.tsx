import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Link, Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import {
  Bug,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Network,
  Settings,
  Shield,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { logout } from '@/api/auth.api';

const PROJECT_MANAGEMENT_PATHS = ['/projects', '/issues', '/resources'];
const ORGANIZATION_PATHS = ['/organization'];
const ADMIN_PATHS = ['/team', '/time', '/admin', '/organisation'];

function pathInGroup(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function NavCollapsibleGroup({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="nav-group-btn"
      >
        {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
        <span>{title}</span>
      </button>
      {open && <div className="mt-1 space-y-1 pl-2">{children}</div>}
    </div>
  );
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const { can, showAdminNav } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const showDashboardNav = can(P.REPORTS_VIEW);
  const showPlanningNav = can(P.PROJECTS_VIEW) || can(P.ISSUES_VIEW) || can(P.ALLOCATIONS_VIEW);
  const showOrganizationMenu = can(P.ORG_STRUCTURE_VIEW);
  const showAdminMenu = showAdminNav;

  const [projectManagementOpen, setProjectManagementOpen] = useState(() =>
    pathInGroup(location.pathname, PROJECT_MANAGEMENT_PATHS),
  );
  const [organizationOpen, setOrganizationOpen] = useState(() =>
    pathInGroup(location.pathname, ORGANIZATION_PATHS),
  );
  const [adminOpen, setAdminOpen] = useState(() =>
    pathInGroup(location.pathname, ADMIN_PATHS),
  );
  const [dismissPasswordBanner, setDismissPasswordBanner] = useState(false);

  const showPasswordBanner =
    !!user?.passwordChangeDue &&
    !dismissPasswordBanner &&
    location.pathname !== '/account/change-password';

  useEffect(() => {
    if (pathInGroup(location.pathname, PROJECT_MANAGEMENT_PATHS)) {
      setProjectManagementOpen(true);
    }
    if (pathInGroup(location.pathname, ORGANIZATION_PATHS)) {
      setOrganizationOpen(true);
    }
    if (pathInGroup(location.pathname, ADMIN_PATHS)) {
      setAdminOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    setDismissPasswordBanner(false);
  }, [user?.userId, user?.passwordChangeDue]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      clearSession();
      navigate('/login');
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx('nav-link', isActive && 'nav-link-active');

  return (
    <div className="flex min-h-screen">
      <aside className="app-sidebar flex w-64 flex-col border-r">
        <div className="border-b px-6 py-5" style={{ borderColor: 'var(--sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <span className="brand-mark">DF</span>
            <div>
              <h1 className="text-lg font-semibold leading-tight">DFN-PlaniX</h1>
              <p className="app-sidebar-muted text-sm">Planning</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {showDashboardNav && (
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          )}

          {showPlanningNav && (
          <NavCollapsibleGroup
            title="Planning"
            open={projectManagementOpen}
            onToggle={() => setProjectManagementOpen((current) => !current)}
          >
            {can(P.PROJECTS_VIEW) && (
            <NavLink to="/projects" className={linkClass}>
              <FolderKanban size={18} />
              Projects
            </NavLink>
            )}
            {can(P.ISSUES_VIEW) && (
            <NavLink to="/issues" className={linkClass}>
              <Bug size={18} />
              Main Backlog
            </NavLink>
            )}
            {can(P.ALLOCATIONS_VIEW) && (
            <NavLink to="/resources" className={linkClass}>
              <Users size={18} />
              Resource Utilization
            </NavLink>
            )}
          </NavCollapsibleGroup>
          )}

          {showOrganizationMenu && (
          <NavCollapsibleGroup
            title="Organization"
            open={organizationOpen}
            onToggle={() => setOrganizationOpen((current) => !current)}
          >
            <NavLink to="/organization" className={linkClass}>
              <Network size={18} />
              Org structure
            </NavLink>
          </NavCollapsibleGroup>
          )}

          {showAdminMenu && (
          <NavCollapsibleGroup
            title="Admin"
            open={adminOpen}
            onToggle={() => setAdminOpen((current) => !current)}
          >
            {can(P.ORGANISATIONS_VIEW) && (
            <NavLink to="/organisation" className={linkClass}>
              <Building2 size={18} />
              Organisation
            </NavLink>
            )}
            {can(P.TEAM_VIEW) && (
            <>
            <NavLink to="/team/management" className={linkClass}>
              <UserCircle size={18} />
              Management
            </NavLink>
            <NavLink to="/team/employees" className={linkClass}>
              <UserCircle size={18} />
              Employee
            </NavLink>
            </>
            )}
            {can(P.ADMIN_VIEW) && (
            <NavLink to="/time" className={linkClass}>
              <Clock size={18} />
              Time
            </NavLink>
            )}
            {can(P.USERS_VIEW) && (
            <NavLink to="/admin/users" className={linkClass}>
              <Shield size={18} />
              User management
            </NavLink>
            )}
            {can(P.ADMIN_VIEW) && (
            <NavLink to="/admin" className={linkClass}>
              <Settings size={18} />
              Admin
            </NavLink>
            )}
          </NavCollapsibleGroup>
          )}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="app-header flex items-center justify-end gap-3 border-b px-6 py-2.5 sm:px-8"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <NotificationBell />
          <div className="hidden h-8 w-px bg-border sm:block" aria-hidden />
          <ThemeToggle compact />
          <div className="hidden h-8 w-px bg-border md:block" aria-hidden />
          <div className="hidden text-right md:block">
            <div className="text-sm font-medium leading-tight">{user?.name}</div>
            <div className="text-xs text-text2">{user?.role}</div>
          </div>
          <Link
            to="/account/change-password"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg3 px-3 py-2 text-sm font-medium text-text2 transition hover:bg-bg hover:text-text"
            title="Change password"
          >
            <KeyRound size={16} />
            <span className="hidden sm:inline">Password</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg3 px-3 py-2 text-sm font-medium text-text2 transition hover:bg-bg hover:text-text"
            title="Sign out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-bg p-8">
          {showPasswordBanner && (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-text">Please change your password</p>
                <p className="mt-1 text-text2">
                  Your password is {user?.passwordAgeDays ?? 90}+ days old. For security, change it
                  every 3 months.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/account/change-password"
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium"
                  style={{ color: 'var(--accent-fg)' }}
                >
                  Change password
                </Link>
                <button
                  type="button"
                  onClick={() => setDismissPasswordBanner(true)}
                  className="rounded-lg p-1.5 text-text2 hover:bg-bg3"
                  aria-label="Dismiss password reminder"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
