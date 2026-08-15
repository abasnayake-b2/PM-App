/** Employment category for roster employees and management. */
export const EMPLOYMENT_TYPE_OPTIONS = [
  'Permanent',
  'Contract',
  'Intern',
  'Consultant',
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPE_OPTIONS)[number];
