import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { Campus, Church, ChurchContext, Organization, OrganizationWriteRequest, PlatformUser, TenantSiteWriteRequest } from '../models/tenant';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly apiUrl = environment.apiBaseUrl;
  private readonly currentOrganizationSubject = new BehaviorSubject<Organization | null>(null);
  private readonly currentChurchSubject = new BehaviorSubject<Church | null>(null);
  private readonly currentCampusSubject = new BehaviorSubject<Campus | null>(null);

  currentOrganization$ = this.currentOrganizationSubject.asObservable();
  currentChurch$ = this.currentChurchSubject.asObservable();
  currentCampus$ = this.currentCampusSubject.asObservable();

  constructor(private http: HttpClient) {}

  listChurches(): Observable<Church[]> {
    return this.http.get<Church[]>(`${this.apiUrl}/churches/`);
  }

  churchContext(): Observable<ChurchContext> {
    return this.http.get<ChurchContext>(`${this.apiUrl}/churches/context/`);
  }

  createChurch(payload: TenantSiteWriteRequest): Observable<Church> {
    return this.http.post<Church>(`${this.apiUrl}/churches/create/`, payload);
  }

  updateChurch(id: string, payload: Partial<TenantSiteWriteRequest>): Observable<Church> {
    return this.http.put<Church>(`${this.apiUrl}/churches/${id}/update/`, payload);
  }

  deleteChurch(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/churches/${id}/delete/`);
  }

  listCampuses(): Observable<Campus[]> {
    return this.http.get<Campus[]>(`${this.apiUrl}/campuses/`);
  }

  createCampus(payload: TenantSiteWriteRequest): Observable<Campus> {
    return this.http.post<Campus>(`${this.apiUrl}/campuses/create/`, payload);
  }

  updateCampus(id: string, payload: Partial<TenantSiteWriteRequest>): Observable<Campus> {
    return this.http.put<Campus>(`${this.apiUrl}/campuses/${id}/update/`, payload);
  }

  deleteCampus(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/campuses/${id}/delete/`);
  }

  listPlatformOrganizations(): Observable<Organization[]> {
    return this.http.get<Organization[]>(`${this.apiUrl}/superadmin/organizations/`);
  }

  createPlatformOrganization(payload: OrganizationWriteRequest): Observable<Organization> {
    return this.http.post<Organization>(`${this.apiUrl}/superadmin/organizations/`, payload);
  }

  updatePlatformOrganization(id: string, payload: Partial<OrganizationWriteRequest>): Observable<Organization> {
    return this.http.put<Organization>(`${this.apiUrl}/superadmin/organizations/${id}/`, payload);
  }

  deletePlatformOrganization(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/superadmin/organizations/${id}/`);
  }

  listAllPlatformChurches(): Observable<Church[]> {
    return this.http.get<Church[]>(`${this.apiUrl}/superadmin/churches/`);
  }

  listPlatformChurches(organizationId: string): Observable<Church[]> {
    return this.http.get<Church[]>(`${this.apiUrl}/superadmin/organizations/${organizationId}/churches/`);
  }

  listPlatformUsers(): Observable<PlatformUser[]> {
    return this.http.get<PlatformUser[]>(`${this.apiUrl}/superadmin/users/`);
  }

  createPlatformChurch(organizationId: string, payload: TenantSiteWriteRequest): Observable<Church> {
    return this.http.post<Church>(`${this.apiUrl}/superadmin/organizations/${organizationId}/churches/`, payload);
  }

  updatePlatformChurch(id: string, payload: Partial<TenantSiteWriteRequest>): Observable<Church> {
    return this.http.put<Church>(`${this.apiUrl}/superadmin/churches/${id}/`, payload);
  }

  deletePlatformChurch(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/superadmin/churches/${id}/`);
  }

  createPlatformUser(payload: { username: string; email: string; password: string; tenant_id?: string; role?: 'admin' | 'member' }): Observable<{ id: number | string; username: string; email: string; organization_id: string | null; role: string | null }> {
    return this.http.post<{ id: number | string; username: string; email: string; organization_id: string | null; role: string | null }>(`${this.apiUrl}/superadmin/users/`, payload);
  }

  setOrganization(org: Organization | null): void {
    this.currentOrganizationSubject.next(org);
  }

  setChurch(church: Church | null): void {
    this.currentChurchSubject.next(church);
  }

  setCampus(campus: Campus | null): void {
    this.currentCampusSubject.next(campus);
  }

  getCurrentOrganization(): Organization | null {
    return this.currentOrganizationSubject.value;
  }

  getCurrentChurch(): Church | null {
    return this.currentChurchSubject.value;
  }
}
