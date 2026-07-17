const TERMINAL_STATUS_NAMES = new Set(['Completed', 'Cancelled', 'On Hold']);

export function isTerminalIssueStatus(statusName?: string | null): boolean {
  if (!statusName) return false;
  return TERMINAL_STATUS_NAMES.has(statusName.trim());
}

export function isOpenIssueStatus(statusName?: string | null): boolean {
  return !isTerminalIssueStatus(statusName);
}
