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
}
