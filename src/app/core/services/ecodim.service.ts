import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EcodimChild,
  EcodimChildDetail,
  EcodimClass,
  EcodimContext,
  EcodimDashboard,
  EcodimFamily,
  EcodimMember,
  EcodimPickupAuthorization,
  EcodimPage,
  EcodimStaffAssignment,
} from '../models/ecodim';

@Injectable({ providedIn: 'root' })
export class EcodimService {
  private readonly apiUrl = `${environment.apiBaseUrl}/ecodim`;

  constructor(private http: HttpClient) {}

  getContext(): Observable<EcodimContext> {
    return this.http.get<EcodimContext>(`${this.apiUrl}/context/`);
  }

  getDashboard(churchId: string): Observable<EcodimDashboard> {
    return this.http.get<EcodimDashboard>(`${this.apiUrl}/dashboard/`, {
      params: new HttpParams().set('church_id', churchId),
    });
  }

  getChildren(churchId: string, page = 1, search = ''): Observable<EcodimPage<EcodimChild>> {
    let params = new HttpParams().set('church_id', churchId).set('page', page);
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<EcodimPage<EcodimChild>>(`${this.apiUrl}/children/`, { params });
  }

  getChild(childId: string): Observable<EcodimChildDetail> {
    return this.http.get<EcodimChildDetail>(`${this.apiUrl}/children/${childId}/`);
  }

  getClasses(churchId: string): Observable<EcodimClass[]> {
    return this.http.get<EcodimClass[]>(`${this.apiUrl}/classes/`, {
      params: new HttpParams().set('church_id', churchId),
    });
  }

  getStaff(churchId: string): Observable<EcodimStaffAssignment[]> {
    return this.http.get<EcodimStaffAssignment[]>(`${this.apiUrl}/staff/`, {
      params: new HttpParams().set('church_id', churchId),
    });
  }

  assignStaff(churchId: string, memberId: string, role: EcodimStaffAssignment['role']): Observable<EcodimStaffAssignment> {
    return this.http.post<EcodimStaffAssignment>(`${this.apiUrl}/staff/`, {
      church_id: churchId,
      member: memberId,
      role,
    });
  }

  updateStaff(assignmentId: string, isActive: boolean): Observable<EcodimStaffAssignment> {
    return this.http.patch<EcodimStaffAssignment>(`${this.apiUrl}/staff/${assignmentId}/`, { is_active: isActive });
  }

  getLinkableMembers(churchId: string): Observable<EcodimMember[]> {
    return this.http.get<EcodimMember[]>(`${this.apiUrl}/members/`, {
      params: new HttpParams().set('church_id', churchId),
    });
  }

  getLinkableFamilies(churchId: string): Observable<EcodimFamily[]> {
    return this.http.get<EcodimFamily[]>(`${this.apiUrl}/families/`, {
      params: new HttpParams().set('church_id', churchId),
    });
  }

  createChild(payload: {
    church_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    gender: string;
    member: string | null;
    family: string | null;
  }): Observable<EcodimChild> {
    return this.http.post<EcodimChild>(`${this.apiUrl}/children/`, payload);
  }

  updateChildIdentity(childId: string, payload: {
    member: string | null;
    family: string | null;
  }): Observable<EcodimChild> {
    return this.http.patch<EcodimChild>(`${this.apiUrl}/children/${childId}/`, payload);
  }

  createClass(payload: {
    church_id: string;
    name: string;
    level: string;
    minimum_age: number | null;
    maximum_age: number | null;
    capacity: number | null;
  }): Observable<EcodimClass> {
    return this.http.post<EcodimClass>(`${this.apiUrl}/classes/`, payload);
  }

  enrollChild(childId: string, classId: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/children/${childId}/enrollment/`, { class_id: classId });
  }

  createSession(payload: {
    church_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location: string;
    ecodim_class: string | null;
  }): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/sessions/`, payload);
  }

  createPickupAuthorization(childId: string, payload: {
    name: string;
    phone: string;
    relationship: string;
    valid_until: string | null;
    member: string | null;
  }): Observable<EcodimPickupAuthorization> {
    return this.http.post<EcodimPickupAuthorization>(
      `${this.apiUrl}/children/${childId}/pickup-authorizations/`,
      payload,
    );
  }

  createGuardian(childId: string, payload: {
    name: string;
    phone: string;
    relationship: string;
    is_legal_guardian: boolean;
    is_primary_contact: boolean;
    member: string | null;
  }): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/children/${childId}/guardians/`, payload);
  }

  revokePickupAuthorization(childId: string, authorizationId: string): Observable<EcodimPickupAuthorization> {
    return this.http.patch<EcodimPickupAuthorization>(
      `${this.apiUrl}/children/${childId}/pickup-authorizations/${authorizationId}/`,
      { status: 'REVOKED' },
    );
  }

  recordHandoff(childId: string, authorizationId: string, verificationNote: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/children/${childId}/handoffs/`, {
      authorization_id: authorizationId,
      verification_note: verificationNote,
    });
  }
}