export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user_id?: string | number;
}

export interface OrganizationSummary {
  tenant_id: string;
  name: string;
  role?: string;
}

export interface MeResponse {
  id: string | number;
  username: string;
  email: string;
  is_superuser: boolean;
  active_organization?: OrganizationSummary | null;
  organizations: OrganizationSummary[];
}

export interface SelectOrganizationRequest {
  tenant_id?: string;
}

export interface SelectOrganizationResponse {
  requires_selection: boolean;
  tenant_id?: string;
  organization?: string;
  role?: string;
  refresh?: string;
  access?: string;
  organizations?: OrganizationSummary[];
  detail?: string;
}
