import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/pages/Login/LoginPage';
import { ForgotPasswordPage } from '@/pages/Login/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/Login/ResetPasswordPage';
import { ChangePasswordPage } from '@/pages/Account/ChangePasswordPage';
import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
import { ProjectsPage } from '@/pages/Projects/ProjectsPage';
import { ProjectCreatePage } from '@/pages/Projects/ProjectCreatePage';
import { ProjectDetailPage } from '@/pages/ProjectDetail/ProjectDetailPage';
import { OrganisationPage } from '@/pages/Organisation/OrganisationPage';
import { IssuesPage } from '@/pages/Issues/IssuesPage';
import { IssueCreatePage } from '@/pages/Issues/IssueCreatePage';
import { IssueDetailPage } from '@/pages/IssueDetail/IssueDetailPage';
import { ResourcesPage } from '@/pages/Resources/ResourcesPage';
import { TeamPage } from '@/pages/Team/TeamPage';
import { TeamLayout } from '@/pages/Team/TeamLayout';
import { ManagementPage } from '@/pages/Team/ManagementPage';
import { TeamEmployeesPage } from '@/pages/Team/TeamEmployeesPage';
import { ResourceDetailPage } from '@/pages/Resources/ResourceDetailPage';
import { TimePage } from '@/pages/Time/TimePage';
import { NotificationsPage } from '@/pages/Notifications/NotificationsPage';
import { AdminPage } from '@/pages/Admin/AdminPage';
import { OrgStructurePage } from '@/pages/Admin/OrgStructurePage';
import { UserManagementPage } from '@/pages/Admin/UserManagementPage';
import { AssistantPage } from '@/pages/Assistant/AssistantPage';
import { AdminRoute } from '@/router/AdminRoute';
import { PermissionRoute } from '@/router/PermissionRoute';
import { AppShell } from '@/components/layout/AppShell';
import { P } from '@/utils/permissions';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/account/change-password" element={<ChangePasswordPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route element={<PermissionRoute permission={P.AI_ASSISTANT_VIEW} />}>
              <Route path="/assistant" element={<AssistantPage />} />
            </Route>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ProjectCreatePage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/issues" element={<IssuesPage />} />
            <Route path="/issues/new" element={<IssueCreatePage />} />
            <Route path="/issues/:id" element={<IssueDetailPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/reports" element={<Navigate to="/" replace />} />
            <Route path="/resources/:id" element={<ResourceDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route element={<PermissionRoute permission={P.ORG_STRUCTURE_VIEW} />}>
              <Route path="/organization" element={<OrgStructurePage />} />
            </Route>
            <Route path="/admin/org-structure" element={<Navigate to="/organization" replace />} />
            <Route element={<AdminRoute />}>
              <Route path="/organisation" element={<OrganisationPage />} />
              <Route path="/team" element={<TeamLayout />}>
                <Route index element={<Navigate to="/team/management" replace />} />
                <Route path="management" element={<ManagementPage />} />
                <Route path="employees" element={<TeamEmployeesPage />} />
                <Route path="directory" element={<TeamPage />} />
              </Route>
              <Route path="/resources/team" element={<Navigate to="/team" replace />} />
              <Route path="/resources/new" element={<Navigate to="/team" replace />} />
              <Route path="/time" element={<TimePage />} />
              <Route path="/admin/users" element={<UserManagementPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
