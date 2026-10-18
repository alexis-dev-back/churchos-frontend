export interface ConfigurationPermission {
  id: number;
  code: string;
  module: string;
  action: string;
  label: string;
  description: string;
}

export interface ConfigurationRole {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  permission_codes: string[];
  assigned_users: number;
  created_at: string;
  updated_at: string;
}

export interface ConfigurationMembership {
  membership_id: number;
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'admin' | 'member';
  is_active: boolean;
  account_is_active: boolean;
  date_created: string;
}

export interface ConfigurationAssignment {
  id: string;
  membership_id: number;
  username: string;
  email: string;
  role_id: string;
  role_name: string;
  role_code: string;
  scope: 'ORGANIZATION' | 'CHURCH' | 'CAMPUS';
  church_id: string | null;
  church_name: string | null;
  campus_id: string | null;
  campus_name: string | null;
  starts_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ConfigurationAuditEntry {
  id: string;
  actor: string | null;
  action: string;
  object_type: string;
  object_id: string;
  scope: string;
  result: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChurchSettings {
  church_id: string;
  church_name: string;
  short_name: string;
  description: string;
  denomination: string;
  pastor_name: string | null;
  address: string | null;
  city: string;
  region: string;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string;
  logo_primary: string | null;
  logo_secondary: string | null;
  social_links: Record<string, string>;
  motto: string;
  registration_number: string;
  language: string;
  timezone: string | null;
  currency: string | null;
  additional_information: Record<string, unknown>;
  updated_at: string;
}

export interface ConfigurationPage<T> {
  count: number;
  page: number;
  page_size: number;
  results: T[];
}
