export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  departmentId?: string;
  passwordChangeDue?: boolean;
  passwordAgeDays?: number;
  permissionCodes: string[];
  /** Manager-only: when true, see org-wide data like a VP. */
  orgWideVisibility?: boolean;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  email: string;
  name: string;
  role: string;
  departmentId?: string;
  passwordChangeDue?: boolean;
  passwordAgeDays?: number;
  permissionCodes?: string[];
  orgWideVisibility?: boolean;
}

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  roleCode: string;
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationName?: string;
  managerId?: string;
  managerName?: string;
}

export interface Client {
  id: string;
  name: string;
  code?: string;
  status: string;
  deleted?: boolean;
  countryId?: string;
  countryName?: string;
  regionId?: string;
  regionName?: string;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  deleted?: boolean;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  regionId: string;
  regionName?: string;
  deleted?: boolean;
}

export interface Project {
  id: string;
  name: string;
  product?: string;
  jiraProjectKey?: string;
  code?: string;
  description?: string;
  status: string;
  ragStatus: string;
  progressPct?: number;
  progressBasis?: 'ISSUES' | 'SCHEDULE' | 'NONE';
  clientId: string;
  clientName?: string;
  regionId?: string;
  regionName?: string;
  countryName?: string;
  leadEmployeeId?: string;
  leadEmployeeName?: string;
  architectEmployeeId?: string;
  architectEmployeeName?: string;
  vpManagementId?: string;
  vpName?: string;
  engineeringManagerManagementId?: string;
  engineeringManagerName?: string;
  teamSize?: number;
  backlogItemCount?: number;
  issuesWithoutUtilizationCount?: number;
  budgetAmount?: number;
  budgetCurrency?: string;
  startDate?: string;
  endDate?: string;
  archived?: boolean;
  deleted?: boolean;
}

export interface ProjectHealthLog {
  id: string;
  ragStatus: string;
  notes?: string;
  changedById?: string;
  changedByName?: string;
  createdAt: string;
}

export interface Release {
  id: string;
  projectId: string;
  name: string;
  version?: string;
  status: string;
  targetDate?: string;
  releasedAt?: string;
  description?: string;
}

export interface Issue {
  id: string;
  /** Human-readable key e.g. SABI-GBL-RD-1 */
  displayKey?: string;
  rdNumber?: number;
  childNumber?: number;
  title: string;
  jiraId?: string;
  description?: string;
  releaseId?: string;
  releaseName?: string;
  parentIssueId?: string;
  parentIssueTitle?: string;
  parentIssueTypeWorkflowCode?: string;
  projectId: string;
  projectName?: string;
  issueTypeId: string;
  issueTypeName?: string;
  issueTypeWorkflowCode?: string;
  priorityId: string;
  priorityLabel?: string;
  priorityColour?: string;
  statusId: string;
  statusName?: string;
  statusColour?: string;
  reportedById?: string;
  reportedByName?: string;
  assignedToId?: string;
  assignedToName?: string;
  allocatedToNames?: string;
  utilizationPct?: number;
  originalEstimation?: number;
  actualEstimation?: number;
  capitalizable?: boolean;
  component?: string;
  customFields?: Record<string, string>;
  deleted?: boolean;
  slaDueAt?: string;
  slaStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface Allocation {
  id: string;
  employeeId: string;
  employeeName: string;
  issueId: string;
  issueTitle: string;
  projectId: string;
  projectName: string;
  roleOnProject?: string;
  percentage: number;
  fromDate: string;
  toDate?: string;
  billable: boolean;
}

export interface Capacity {
  employeeId: string;
  employeeName: string;
  /** Relative API path when set, e.g. /team-roster/members/{id}/photo */
  profilePictureUrl?: string | null;
  departmentName?: string;
  designationName?: string;
  vpName?: string;
  engineeringManagerName?: string;
  benchStatus?: string;
  /** Average daily allocation % over the selected From–To range. */
  totalPercentage: number;
  /** Available capacity % for the same range (max 0, 100 − allocated). */
  availablePercentage?: number;
  overAllocated: boolean;
  allocations: Allocation[];
  periodAllocations?: Allocation[];
}

export interface TimeLog {
  id: string;
  employeeId: string;
  employeeName: string;
  taskId: string;
  taskTitle: string;
  issueId: string;
  issueTitle: string;
  projectId: string;
  projectName: string;
  logDate: string;
  hours: number;
  notes?: string;
}

export interface WeeklyTimeSummary {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  days: { date: string; hours: number }[];
}

export interface TaskSummary {
  id: string;
  title: string;
  issueId: string;
  issueTitle: string;
  projectId: string;
  projectName: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  type?: string;
  read: boolean;
  createdAt?: string;
}

export interface DashboardSummary {
  activeProjects: number;
  openIssues: number;
  teamUtilisationPct: number;
  unreadNotifications: number;
  overAllocatedEmployees: number;
}

export interface ProjectDashboardItem {
  id: string;
  name: string;
  clientName?: string;
  ragStatus: string;
  progressPct?: number;
  status: string;
  openIssues: number;
}

export interface UtilisationSnapshot {
  employeeId: string;
  employeeName: string;
  totalPct: number;
  overAllocated: boolean;
}

export interface OrgWorkforceSummary {
  employeeCount: number;
  cxoCount: number;
  vpCount: number;
  engineeringManagerCount: number;
  projectCount: number;
  employees?: EmOrgEngineerItem[];
  cxos?: EmOrgEngineerItem[];
  vps?: EmOrgEngineerItem[];
  engineeringManagers?: EmOrgEngineerItem[];
  projects?: OrgBreakdownProject[];
}

export interface OrgBreakdownProject {
  name: string;
  regionName?: string;
  countryName?: string;
}

export interface VpOrgBreakdownRow {
  vpId: string;
  vpName: string;
  engineeringManagerCount: number;
  engineerCount: number;
  projectCount: number;
  engineeringManagers?: EmOrgEngineerItem[];
  engineers?: EmOrgEngineerItem[];
  projects?: OrgBreakdownProject[];
}

export interface EmOrgEngineerItem {
  name: string;
  designation: string;
}

export interface EmOrgBreakdownRow {
  emId: string;
  emName: string;
  engineerCount: number;
  projectCount: number;
  engineers?: EmOrgEngineerItem[];
  projects?: OrgBreakdownProject[];
}

export interface DashboardOverview {
  summary: DashboardSummary;
  projects: ProjectDashboardItem[];
  recentNotifications: NotificationItem[];
  utilisation: UtilisationSnapshot[];
  orgWorkforce?: OrgWorkforceSummary;
  vpBreakdown?: VpOrgBreakdownRow[];
  emBreakdown?: EmOrgBreakdownRow[];
  generatedAt: string;
}

export interface UtilisationBand {
  key: string;
  label: string;
  count: number;
  pctOfPeople: number;
}

export interface UtilisationBands {
  zero: UtilisationBand;
  low: UtilisationBand;
  mid: UtilisationBand;
  full: UtilisationBand;
  over: UtilisationBand;
}

export interface OverAllocatedPerson {
  employeeId: string;
  employeeName: string;
  engineeringManagerName?: string;
  teamName?: string;
  totalPct: number;
  projects: string[];
}

export interface AvailablePerson {
  employeeId: string;
  employeeName: string;
  engineeringManagerName?: string;
  teamName?: string;
  allocatedPct: number;
  freePct: number;
}

export interface GroupUtilisationBar {
  name: string;
  avgPct: number;
  peopleCount: number;
  overAllocatedCount: number;
  allocatedMembers?: GroupMember[];
  unallocatedMembers?: GroupMember[];
}

export interface GroupMember {
  employeeId: string;
  employeeName: string;
  teamName?: string;
  engineeringManagerName?: string;
  allocatedPct: number;
  freePct: number;
  projects?: string[];
}

export interface AllocationHeatmapRow {
  label: string;
  values: number[];
}

export interface AllocationHeatmap {
  weekLabels: string[];
  weekStarts: string[];
  rows: AllocationHeatmapRow[];
}

export interface CapacityUtilisationDashboard {
  bands: UtilisationBands;
  overAllocated: OverAllocatedPerson[];
  available: AvailablePerson[];
  byEngineeringManager: GroupUtilisationBar[];
  byTeam: GroupUtilisationBar[];
  heatmap: AllocationHeatmap;
  peopleCount: number;
  asOf: string;
  heatmapFrom: string;
  heatmapTo: string;
}

export interface AuditLogEntry {
  id: string;
  employeeId?: string;
  employeeName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  createdAt?: string;
}

export interface Holiday {
  id: string;
  name: string;
  holidayDate: string;
  countryId?: string;
  countryName?: string;
}

export interface WorkflowRule {
  id: string;
  issueTypeId: string;
  issueTypeName: string;
  fromStatusId: string;
  fromStatusName: string;
  toStatusId: string;
  toStatusName: string;
}

export interface SystemSetting {
  id: string;
  settingKey: string;
  settingValue?: string;
  updatedAt?: string;
}

export interface NotificationTemplate {
  id: string;
  code: string;
  subject: string;
  bodyTemplate: string;
}
