import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AttendancePage,
  AttendanceManagerContext,
  AttendanceMember,
  AttendanceRecord,
  AttendanceAlert,
  AttendancePolicy,
  AttendanceSession,
  AttendanceSessionType,
  MemberAttendanceHistory,
  AttendanceWeeklyReport,
  ExpectedParticipant,
} from '../models/attendance';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly apiUrl = `${environment.apiBaseUrl}/attendance`;

  constructor(private http: HttpClient) {}

  managerContext(): Observable<AttendanceManagerContext> {
    return this.http.get<AttendanceManagerContext>(`${this.apiUrl}/context/`);
  }

  listMembers(filters: { church_id?: string } = {}): Observable<AttendanceMember[]> {
    let params = new HttpParams();
    if (filters.church_id) params = params.set('church_id', filters.church_id);
    return this.http.get<AttendanceMember[]>(`${this.apiUrl}/members/`, { params });
  }

  listSessions(filters: { status?: string; from?: string; to?: string } = {}): Observable<AttendancePage<AttendanceSession>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });
    return this.http.get<AttendancePage<AttendanceSession>>(`${this.apiUrl}/sessions/`, { params });
  }

  expected(sessionId: string): Observable<ExpectedParticipant[]> {
    return this.http.get<ExpectedParticipant[]>(`${this.apiUrl}/sessions/${sessionId}/expected/`);
  }

  listTypes(): Observable<AttendancePage<AttendanceSessionType>> {
    return this.http.get<AttendancePage<AttendanceSessionType>>(`${this.apiUrl}/types/`);
  }

  createType(payload: Pick<AttendanceSessionType, 'name' | 'population_rule' | 'default_methods' | 'tolerance_minutes'>): Observable<AttendanceSessionType> {
    return this.http.post<AttendanceSessionType>(`${this.apiUrl}/types/`, payload);
  }

  createSession(payload: {
    title: string;
    church_id: string;
    campus_id: string | null;
    session_type_id?: string | null;
    ministry_id?: string | null;
    tribe_id?: string | null;
    member_ids?: string[];
    starts_at: string;
    ends_at: string;
    population_rule: 'ALL_MEMBERS' | 'MINISTRY' | 'TRIBE' | 'MANUAL';
    allowed_methods: string[];
    tolerance_minutes: number;
    recurrence_frequency: 'NONE' | 'WEEKLY' | 'MONTHLY';
    recurrence_until?: string | null;
  }): Observable<{ session: AttendanceSession; generated_sessions: AttendanceSession[] }> {
    return this.http.post<{ session: AttendanceSession; generated_sessions: AttendanceSession[] }>(
      `${this.apiUrl}/sessions/`,
      payload,
    );
  }

  transition(sessionId: string, action: 'open' | 'close' | 'cancel' | 'reopen', reason = ''): Observable<AttendanceSession> {
    return this.http.post<AttendanceSession>(`${this.apiUrl}/sessions/${sessionId}/actions/${action}/`, { reason });
  }

  checkIn(sessionId: string, expectedParticipantId: string, method: 'MANUAL' | 'LIST' | 'QR'): Observable<{
    result: string;
    detail: string;
    attendance: AttendanceRecord;
  }> {
    return this.http.post<{ result: string; detail: string; attendance: AttendanceRecord }>(
      `${this.apiUrl}/sessions/${sessionId}/check-ins/`,
      { expected_participant_id: expectedParticipantId, method },
    );
  }

  report(from: string, to: string, churchId?: string): Observable<AttendanceWeeklyReport> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (churchId) params = params.set('church_id', churchId);
    return this.http.get<AttendanceWeeklyReport>(`${this.apiUrl}/reports/weekly/`, { params });
  }

  listAlerts(): Observable<AttendanceAlert[]> {
    return this.http.get<AttendanceAlert[]>(`${this.apiUrl}/alerts/`);
  }

  alertAction(alertId: string, action: 'seen' | 'take' | 'resolve' | 'note' | 'contact', note = ''): Observable<{ alert: AttendanceAlert }> {
    return this.http.post<{ alert: AttendanceAlert }>(`${this.apiUrl}/alerts/${alertId}/actions/${action}/`, { note });
  }

  listPolicies(): Observable<AttendancePolicy[]> {
    return this.http.get<AttendancePolicy[]>(`${this.apiUrl}/policies/`);
  }

  savePolicy(churchId: string, policy: Omit<AttendancePolicy, 'id' | 'church'>): Observable<AttendancePolicy> {
    return this.http.put<AttendancePolicy>(`${this.apiUrl}/policies/${churchId}/`, policy);
  }

  addVisitor(sessionId: string, visitor: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    reusable: boolean;
  }): Observable<ExpectedParticipant> {
    return this.http.post<ExpectedParticipant>(`${this.apiUrl}/sessions/${sessionId}/visitors/`, visitor);
  }

  addExpectedMember(sessionId: string, memberId: string, reason: string): Observable<ExpectedParticipant> {
    return this.http.post<ExpectedParticipant>(`${this.apiUrl}/sessions/${sessionId}/expected/`, {
      member_id: memberId,
      reason,
    });
  }

  removeExpectedParticipant(sessionId: string, participantId: string, reason: string): Observable<ExpectedParticipant> {
    return this.http.delete<ExpectedParticipant>(`${this.apiUrl}/sessions/${sessionId}/expected/${participantId}/`, {
      body: { reason },
    });
  }

  submitExcuse(attendanceId: string, reason: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/records/${attendanceId}/excuses/`, { reason });
  }

  decideExcuse(excuseId: string, decision: 'approve' | 'reject'): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/excuses/${excuseId}/${decision}/`, {});
  }

  earlyDeparture(attendanceId: string, reason: string): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/records/${attendanceId}/early-departure/`, {
      departed_at: new Date().toISOString(),
      reason,
    });
  }

  correctAttendance(attendanceId: string, nextStatus: string, reason: string): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/records/${attendanceId}/corrections/`, {
      status: nextStatus,
      reason,
    });
  }

  attendanceHistory(memberId: string): Observable<AttendancePage<MemberAttendanceHistory>> {
    return this.http.get<AttendancePage<MemberAttendanceHistory>>(`${this.apiUrl}/members/${memberId}/history/`);
  }
}
