export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  notes?: string | null;
  user?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersonCreateRequest {
  first_name: string;
  last_name: string;
  middle_name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  notes?: string;
}

export interface PersonMembershipRequest {
  church: string;
  campus?: string;
  marital_status?: string;
  address?: string;
  email?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
}
