import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Member, MemberCreateRequest, MemberHistoryEntry, MemberHistoryPayload } from '../models/member';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly apiUrl = `${environment.apiBaseUrl}`;

  constructor(private http: HttpClient) {}

  getMembers(): Observable<Member[]> {
    return this.http.get<Member[]>(`${this.apiUrl}/members/`);
  }

  getMember(id: string): Observable<Member> {
    return this.http.get<Member>(`${this.apiUrl}/members/${id}/`);
  }

  createMember(payload: MemberCreateRequest): Observable<Member & { invitation_token?: string }> {
    return this.http.post<Member & { invitation_token?: string }>(`${this.apiUrl}/members/`, this.requestBody(payload));
  }

  updateMember(id: string, payload: Partial<MemberCreateRequest>): Observable<Member> {
    return this.http.patch<Member>(`${this.apiUrl}/members/${id}/`, this.requestBody(payload));
  }

  getHistory(id: string): Observable<MemberHistoryEntry[]> {
    return this.http.get<MemberHistoryEntry[]>(`${this.apiUrl}/members/${id}/history/`);
  }

  addHistory(id: string, payload: MemberHistoryPayload): Observable<MemberHistoryEntry> {
    return this.http.post<MemberHistoryEntry>(`${this.apiUrl}/members/${id}/history/`, payload);
  }

  updateHistory(id: string, entryId: string, payload: Partial<MemberHistoryPayload>): Observable<MemberHistoryEntry> {
    return this.http.patch<MemberHistoryEntry>(`${this.apiUrl}/members/${id}/history/${entryId}/`, payload);
  }

  removeHistory(id: string, entryId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/members/${id}/history/${entryId}/`);
  }

  suspendMember(id: string): Observable<{ detail: string; status: string }> {
    return this.http.post<{ detail: string; status: string }>(`${this.apiUrl}/members/${id}/suspend/`, {});
  }

  archiveMember(id: string): Observable<{ detail: string; status: string }> {
    return this.http.post<{ detail: string; status: string }>(`${this.apiUrl}/members/${id}/archive/`, {});
  }

  sendInvitation(id: string): Observable<{ member_id: string; invitation_token: string }> {
    return this.http.post<{ member_id: string; invitation_token: string }>(`${this.apiUrl}/members/${id}/invite/`, {});
  }

  resendInvitation(id: string): Observable<{ member_id: string; invitation_token: string }> {
    return this.http.post<{ member_id: string; invitation_token: string }>(`${this.apiUrl}/members/${id}/resend-invitation/`, {});
  }

  getMe(): Observable<Member> {
    return this.http.get<Member>(`${this.apiUrl}/members/me/`);
  }

  private requestBody(payload: Partial<MemberCreateRequest>): Partial<MemberCreateRequest> | FormData {
    if (!payload.photo_upload) return payload;
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || key === 'photo_upload') return;
      formData.append(key, value === null ? '' : String(value));
    });
    formData.append('photo_upload', payload.photo_upload);
    return formData;
  }
}
