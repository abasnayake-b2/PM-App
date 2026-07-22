import api from './axios';

export interface EmCapacityMetricCell {
  emId?: string;
  value?: number;
  blank?: boolean;
}

export interface EmCapacityMetricRow {
  key: string;
  label: string;
  summary: boolean;
  editable: boolean;
  values: EmCapacityMetricCell[];
  total: EmCapacityMetricCell;
}

export interface EmCapacityColumn {
  emId: string;
  emName: string;
  shortName: string;
  projectCount: number;
  existingResources: number;
  additionalResources: number;
  notChargeableCr: number;
  notChargeableEffort: number;
  chargeableCr: number;
  chargeableEffort: number;
  chargeableCrByExisting: number;
  chargeableCrByNew: number;
  totalCr: number;
  totalManDays: number;
}

export interface EmCapacityPlanDashboard {
  weeks: number;
  windowFrom: string;
  windowTo: string;
  engineeringManagers: EmCapacityColumn[];
  rows: EmCapacityMetricRow[];
  totals: {
    projectCount: number;
    existingResources: number;
    additionalResources: number;
    notChargeableCr: number;
    notChargeableEffort: number;
    chargeableCr: number;
    chargeableEffort: number;
    chargeableCrByExisting: number;
    chargeableCrByNew: number;
    totalCr: number;
    totalManDays: number;
  };
}

export async function fetchEmCapacityPlan(weeks = 12): Promise<EmCapacityPlanDashboard> {
  const { data } = await api.get<EmCapacityPlanDashboard>('/reports/dashboard/em-capacity-plan', {
    params: { weeks },
  });
  return data;
}

export async function updateEmAdditionalResources(
  emId: string,
  additionalResources: number,
): Promise<EmCapacityColumn> {
  const { data } = await api.put<EmCapacityColumn>(
    `/reports/dashboard/em-capacity-plan/${emId}/additional-resources`,
    { additionalResources },
  );
  return data;
}
