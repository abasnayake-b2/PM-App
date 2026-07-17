import api from './axios';

export interface CrStatusColumn {
  id: string;
  name: string;
  sequence: number;
  terminal: boolean;
  colour: string;
}

export interface CrStatusMatrixRow {
  projectId: string;
  projectName: string;
  emName?: string;
  architectName?: string;
  countryName?: string;
  clientName?: string;
  product?: string;
  pmName?: string;
  dmName?: string;
  totalCr: number;
  activeCr: number;
  statusCounts: Record<string, number>;
}

export interface CrStatusMatrix {
  statuses: CrStatusColumn[];
  rows: CrStatusMatrixRow[];
  totals: {
    totalCr: number;
    activeCr: number;
    statusCounts: Record<string, number>;
  };
}

export async function fetchCrStatusMatrix(projectId?: string): Promise<CrStatusMatrix> {
  const { data } = await api.get<CrStatusMatrix>('/issues/cr-status-matrix', {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}
