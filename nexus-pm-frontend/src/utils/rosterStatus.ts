/** People counted in org views and grids. Inactive appear only on Admin → Employees. */
export function isActiveRosterStatus(status?: string | null): boolean {
  if (!status || !status.trim()) return true;
  return status.trim().toUpperCase() !== 'INACTIVE';
}
