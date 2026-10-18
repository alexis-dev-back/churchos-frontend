export interface Family {
  id: string;
  name: string;
  address?: string;
  neighborhood?: string;
  ministry?: string;
  phone?: string;
  email?: string;
  notes?: string;
  status?: string;
  member_count?: number;
  primary_contact_name?: string | null;
  primary_contact_phone?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FamilyCreateRequest {
  name: string;
  status?: string;
  address?: string;
  neighborhood?: string;
  ministry?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface FamilyMemberRequest {
  person?: string;
  member?: string;
  relationship_type: 'HEAD' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
  is_primary_contact?: boolean;
}

export interface FamilyMemberRecord {
  id: string;
  family: string;
  person: string | null;
  member: string | null;
  person_name: string | null;
  member_name: string | null;
  email: string | null;
  phone: string | null;
  relationship_type: FamilyMemberRequest['relationship_type'];
  is_primary_contact: boolean;
  joined_at: string;
}
