export interface EcodimChurch {
  church_id: string;
  name: string;
}

export interface EcodimContext {
  churches: EcodimChurch[];
  default_church_id: string | null;
  is_organization_admin: boolean;
  can_manage: boolean;
}

export interface EcodimChild {
  id: string;
  reference: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string;
  photo_url: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  family: string | null;
  family_name: string | null;
  member: string | null;
  person: string | null;
  current_class_id: string | null;
  current_class_name: string | null;
  primary_guardian_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface EcodimMember {
  id: string;
  first_name: string;
  last_name: string;
}

export interface EcodimFamily {
  id: string;
  name: string;
}

export interface EcodimGuardian {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  is_legal_guardian: boolean;
  is_primary_contact: boolean;
  member: string | null;
  person: string | null;
  created_at: string;
}

export interface EcodimPickupAuthorization {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  valid_from: string;
  valid_until: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  member: string | null;
  person: string | null;
  created_at: string;
  updated_at: string;
}

export interface EcodimHandoff {
  id: string;
  picked_up_by_name: string;
  handed_off_at: string;
  verification_note: string;
  authorization: string;
  authorization_name: string;
  confirmed_by: number | string | null;
}

export interface EcodimChildDetail extends EcodimChild {
  guardians: EcodimGuardian[];
  pickup_authorizations: EcodimPickupAuthorization[];
  handoffs: EcodimHandoff[];
}

export interface EcodimClass {
  id: string;
  name: string;
  description: string;
  level: string;
  minimum_age: number | null;
  maximum_age: number | null;
  capacity: number | null;
  status: 'ACTIVE' | 'ARCHIVED';
  active_children_count?: number;
  created_at: string;
  updated_at: string;
}

export interface EcodimStaffAssignment {
  id: string;
  member: string;
  member_name: string;
  role: 'DIRECTOR' | 'CHILD_SAFETY' | 'CHECK_IN';
  is_active: boolean;
  created_at: string;
}

export interface EcodimSessionSummary {
  id: string;
  title: string;
  starts_at: string;
  location: string;
  class_name: string | null;
}

export interface EcodimDashboard {
  summary: {
    active_children: number;
    children_3_11: number;
    adolescents_12_17: number;
    new_children_this_month: number;
    active_classes: number;
    responsibles: number;
    activities_in_progress: number;
    upcoming_sessions: number;
  };
  age_distribution: Array<{ label: '3-5' | '6-11' | '12-14' | '15-17' | 'other' | 'unknown'; count: number }>;
  registrations_by_month: Array<{ label: string; children: number; adolescents: number }>;
  classes: EcodimClass[];
  upcoming_sessions: EcodimSessionSummary[];
  recent_children: EcodimChild[];
}

export interface EcodimPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}