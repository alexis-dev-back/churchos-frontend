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
  nationality?: string | null;
  profession?: string | null;
  education_level?: string | null;
  marital_status?: string | null;
  baptism_status?: string;
  person_type?: 'INVITED' | 'NON_INVITED';
  invited_by_member?: string | null;
  invited_by_member_name?: string | null;
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
  nationality?: string;
  profession?: string;
  education_level?: string;
  marital_status?: string;
  baptism_status?: string;
  person_type?: 'INVITED' | 'NON_INVITED';
  invited_by_member?: string | null;
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

export interface InvitingMember {
  id: string;
  first_name: string;
  last_name: string;
}
