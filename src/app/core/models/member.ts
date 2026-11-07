export interface Member {
  id: string;
  user?: string;
  has_account?: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  marital_status?: string;
  nationality?: string;
  profession?: string;
  education_level?: string;
  baptism_status?: string;
  baptism_date?: string | null;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  photo?: string | null;
  address?: string;
  status?: string;
  church?: string | { church_id?: string; name?: string } | null;
  campus?: string | { campus_id?: string; name?: string } | null;
  organization?: { tenant_id?: string; name?: string } | null;
  created_at?: string;
  updated_at?: string;
  member_since?: string;
}

export interface MemberCreateRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  church: string;
  campus?: string | null;
  marital_status?: string;
  address?: string;
  nationality?: string;
  profession?: string;
  education_level?: string;
  baptism_status?: string;
  baptism_date?: string | null;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  photo_upload?: File;
  status?: string;
}

export interface MemberHistoryEntry {
  id: string;
  event_type: 'BAPTISM' | 'MARRIAGE' | 'TRAINING' | 'FUNCTION' | 'OTHER';
  event_type_label: string;
  title: string;
  event_date: string | null;
  description: string;
  created_by_name: string;
  created_at: string;
}

export interface MemberHistoryPayload {
  event_type: MemberHistoryEntry['event_type'];
  title: string;
  event_date?: string | null;
  description?: string;
}
