import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChurchStructure,
  LeadershipRole,
  StructureAssignment,
  StructureKind,
  StructureLeadership,
  StructureWriteRequest,
} from '../models/ministry-tribe';

@Injectable({ providedIn: 'root' })
export class MinistryTribeService {
  private readonly apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  list(kind: StructureKind, churchId: string): Observable<ChurchStructure[]> {
    return this.http.get<ChurchStructure[]>(`${this.apiUrl}/${kind}/`, {
      params: new HttpParams().set('church_id', churchId),
    });
  }

  get(kind: StructureKind, id: string): Observable<ChurchStructure> {
    return this.http.get<ChurchStructure>(`${this.apiUrl}/${kind}/${id}/`);
  }

  create(kind: StructureKind, payload: StructureWriteRequest): Observable<ChurchStructure> {
    return this.http.post<ChurchStructure>(`${this.apiUrl}/${kind}/`, payload);
  }

  update(kind: StructureKind, id: string, payload: Partial<StructureWriteRequest>): Observable<ChurchStructure> {
    return this.http.patch<ChurchStructure>(`${this.apiUrl}/${kind}/${id}/`, payload);
  }

  listAssignments(kind: StructureKind, id: string, history = false): Observable<StructureAssignment[]> {
    const params = history ? new HttpParams().set('history', '1') : undefined;
    return this.http.get<StructureAssignment[]>(`${this.apiUrl}/${kind}/${id}/assignments/`, { params });
  }

  assign(kind: StructureKind, id: string, member: string, replaceActive = false): Observable<StructureAssignment> {
    return this.http.post<StructureAssignment>(`${this.apiUrl}/${kind}/${id}/assignments/`, {
      member,
      ...(replaceActive ? { replace_active: true } : {}),
    });
  }

  closeAssignment(kind: StructureKind, assignmentId: string, endedReason = ''): Observable<StructureAssignment> {
    return this.http.post<StructureAssignment>(`${this.apiUrl}/${kind}/assignments/${assignmentId}/close/`, {
      ended_reason: endedReason,
    });
  }

  listLeadership(kind: StructureKind, id: string, history = false): Observable<StructureLeadership[]> {
    const params = history ? new HttpParams().set('history', '1') : undefined;
    return this.http.get<StructureLeadership[]>(`${this.apiUrl}/${kind}/${id}/leadership/`, { params });
  }

  appoint(kind: StructureKind, id: string, member: string, role: LeadershipRole): Observable<StructureLeadership> {
    return this.http.post<StructureLeadership>(`${this.apiUrl}/${kind}/${id}/leadership/`, { member, role });
  }

  closeLeadership(kind: StructureKind, leadershipId: string, endedReason = ''): Observable<StructureLeadership> {
    return this.http.post<StructureLeadership>(`${this.apiUrl}/${kind}/leadership/${leadershipId}/close/`, {
      ended_reason: endedReason,
    });
  }
}
