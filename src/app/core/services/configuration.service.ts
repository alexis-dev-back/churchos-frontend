import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChurchSettings,
  ConfigurationAssignment,
  ConfigurationAuditEntry,
  ConfigurationMembership,
  ConfigurationPage,
  ConfigurationPermission,
  ConfigurationRole,
} from '../models/configuration';

@Injectable({ providedIn: 'root' })
export class ConfigurationService {
  private readonly apiUrl = `${environment.apiBaseUrl}/configuration`;

  constructor(private http: HttpClient) {}

  getAccess(): Observable<{ permission_codes: string[]; is_organization_admin: boolean }> {
    return this.http.get<{ permission_codes: string[]; is_organization_admin: boolean }>(`${this.apiUrl}/access/`);
  }

  getChurchSettings(churchId: string): Observable<ChurchSettings> {
    return this.http.get<ChurchSettings>(`${this.apiUrl}/church/`, { params: { church_id: churchId } });
  }

  updateChurchSettings(churchId: string, payload: Partial<ChurchSettings>): Observable<ChurchSettings> {
    return this.http.patch<ChurchSettings>(`${this.apiUrl}/church/`, payload, { params: { church_id: churchId } });
  }

  uploadChurchLogo(churchId: string, field: 'logo_primary' | 'logo_secondary', file: File | null): Observable<ChurchSettings> {
    const params = { church_id: churchId };
    if (!file) return this.http.patch<ChurchSettings>(`${this.apiUrl}/church/`, { [field]: null }, { params });
    const body = new FormData();
    body.append(field, file);
    return this.http.patch<ChurchSettings>(`${this.apiUrl}/church/`, body, { params });
  }

  listPermissions(): Observable<ConfigurationPermission[]> {
    return this.http.get<ConfigurationPermission[]>(`${this.apiUrl}/permissions/`);
  }

  listRoles(): Observable<ConfigurationPage<ConfigurationRole>> {
    return this.http.get<ConfigurationPage<ConfigurationRole>>(`${this.apiUrl}/roles/`);
  }

  createRole(payload: Pick<ConfigurationRole, 'name' | 'code' | 'description'>): Observable<ConfigurationRole> {
    return this.http.post<ConfigurationRole>(`${this.apiUrl}/roles/`, payload);
  }

  updateRole(roleId: string, payload: Partial<ConfigurationRole>): Observable<ConfigurationRole> {
    return this.http.patch<ConfigurationRole>(`${this.apiUrl}/roles/${roleId}/`, payload);
  }

  updateRolePermissions(roleId: string, permissionCodes: string[]): Observable<ConfigurationRole> {
    return this.http.post<ConfigurationRole>(`${this.apiUrl}/roles/${roleId}/permissions/`, {
      permission_codes: permissionCodes,
    });
  }

  listUsers(search = ''): Observable<ConfigurationPage<ConfigurationMembership>> {
    const params = search ? new HttpParams().set('search', search) : undefined;
    return this.http.get<ConfigurationPage<ConfigurationMembership>>(`${this.apiUrl}/users/`, { params });
  }

  addUser(username: string): Observable<ConfigurationMembership> {
    return this.http.post<ConfigurationMembership>(`${this.apiUrl}/users/`, { username });
  }

  updateUser(membershipId: number, payload: Partial<ConfigurationMembership>): Observable<ConfigurationMembership> {
    return this.http.patch<ConfigurationMembership>(`${this.apiUrl}/users/${membershipId}/`, payload);
  }

  resetUserPassword(membershipId: number, password: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(
      `${this.apiUrl}/users/${membershipId}/reset-password/`,
      { password },
    );
  }

  listAssignments(membershipId?: number): Observable<ConfigurationPage<ConfigurationAssignment>> {
    let params = new HttpParams();
    if (membershipId) params = params.set('membership_id', membershipId);
    return this.http.get<ConfigurationPage<ConfigurationAssignment>>(`${this.apiUrl}/user-roles/`, { params });
  }

  assignRole(payload: {
    membership_id: number;
    role_id: string;
    scope: ConfigurationAssignment['scope'];
    church_id?: string;
    campus_id?: string;
    expires_at?: string | null;
  }): Observable<ConfigurationAssignment> {
    return this.http.post<ConfigurationAssignment>(`${this.apiUrl}/user-roles/`, payload);
  }

  revokeAssignment(assignmentId: string): Observable<ConfigurationAssignment> {
    return this.http.post<ConfigurationAssignment>(`${this.apiUrl}/user-roles/${assignmentId}/revoke/`, {});
  }

  listAuditLogs(): Observable<ConfigurationPage<ConfigurationAuditEntry>> {
    return this.http.get<ConfigurationPage<ConfigurationAuditEntry>>(`${this.apiUrl}/audit-logs/`);
  }
}
