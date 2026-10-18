import { Member } from './member';

export type StructureKind = 'ministries' | 'tribes';
export type StructureStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type LeadershipRole = 'LEADER' | 'ADJOINT' | 'SECRETARY' | 'TREASURER';

export interface ChurchStructure {
  id: string;
  church: string;
  church_name: string;
  name: string;
  sector: string;
  description: string;
  status: StructureStatus;
  active_members_count?: number;
  leader_name?: string;
  created_at: string;
  updated_at: string;
}

export interface StructureWriteRequest {
  church_id: string;
  name: string;
  sector?: string;
  description?: string;
  status?: StructureStatus;
}

export interface StructureAssignment {
  id: string;
  member: string;
  member_name: string;
  structure_name: string;
  joined_at: string;
  left_at: string | null;
  ended_reason: string;
  created_by: number | string | null;
  ended_by: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface StructureLeadership {
  id: string;
  member: string;
  member_name: string;
  structure_name: string;
  role: LeadershipRole;
  started_at: string;
  ended_at: string | null;
  ended_reason: string;
  appointed_by: number | string | null;
  ended_by: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface StructureMember extends Member {}
