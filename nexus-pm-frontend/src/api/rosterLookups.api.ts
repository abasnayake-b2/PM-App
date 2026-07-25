import api from './axios';

export interface RosterStream {
  id: string;
  name: string;
  departmentId?: string;
  departmentName?: string;
}

export interface RosterWorkType {
  id: string;
  name: string;
}

export interface RosterDesignation {
  id: string;
  name: string;
  code?: string;
  departmentId?: string;
  departmentName?: string;
  streamId?: string;
  streamName?: string;
  management?: boolean;
}

export interface RosterSkill {
  id: string;
  name: string;
  description?: string;
}

export async function fetchRosterStreams(): Promise<RosterStream[]> {
  const { data } = await api.get<RosterStream[]>('/streams');
  return data;
}

export async function fetchRosterWorkTypes(): Promise<RosterWorkType[]> {
  const { data } = await api.get<RosterWorkType[]>('/work-types');
  return data;
}

export async function fetchRosterDesignations(): Promise<RosterDesignation[]> {
  const { data } = await api.get<RosterDesignation[]>('/designations');
  return data;
}

export async function fetchRosterSkills(): Promise<RosterSkill[]> {
  const { data } = await api.get<RosterSkill[]>('/skills');
  return data;
}
