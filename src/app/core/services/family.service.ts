import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Family, FamilyCreateRequest, FamilyMemberRecord, FamilyMemberRequest } from '../models/family';

@Injectable({ providedIn: 'root' })
export class FamilyService {
  private readonly apiUrl = `${environment.apiBaseUrl}`;

  constructor(private http: HttpClient) {}

  listFamilies(): Observable<Family[]> {
    return this.http.get<Family[]>(`${this.apiUrl}/families/`);
  }

  createFamily(payload: FamilyCreateRequest): Observable<Family> {
    return this.http.post<Family>(`${this.apiUrl}/families/`, payload);
  }

  getFamily(id: string): Observable<Family> {
    return this.http.get<Family>(`${this.apiUrl}/families/${id}/`);
  }

  getFamilyMembers(id: string): Observable<FamilyMemberRecord[]> {
    return this.http.get<FamilyMemberRecord[]>(`${this.apiUrl}/families/${id}/members/`);
  }

  updateFamily(id: string, payload: Partial<FamilyCreateRequest>): Observable<Family> {
    return this.http.patch<Family>(`${this.apiUrl}/families/${id}/`, payload);
  }

  deleteFamily(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/families/${id}/`);
  }

  addMemberToFamily(familyId: string, payload: FamilyMemberRequest): Observable<FamilyMemberRecord> {
    return this.http.post<FamilyMemberRecord>(`${this.apiUrl}/families/${familyId}/members/`, payload);
  }
}
