export interface Church {
  church_id: string;
  name: string;
  slug?: string;
  pastor_name?: string;
  organization?: string;
  phone?: string;
  address?: string;
  email?: string;
  country?: string;
  is_active?: boolean;
}

export interface Campus {
  campus_id: string;
  name: string;
  slug?: string;
  church?: string;
  phone?: string;
  address?: string;
  email?: string;
  country?: string;
  is_active?: boolean;
}

export interface ChurchContext {
  churches: Church[];
  campuses: Campus[];
  default_church_id: string | null;
  church_selection_fixed: boolean;
}

export interface Organization {
  tenant_id: string;
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  is_active?: boolean;
}

export interface TenantSiteWriteRequest {
  name: string;
  slug: string;
  phone?: string;
  address?: string;
  email?: string;
  country?: string;
  pastor_name?: string;
  organization?: string;
  church?: string;
  is_active?: boolean;
}

export interface OrganizationWriteRequest {
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  is_active?: boolean;
}
