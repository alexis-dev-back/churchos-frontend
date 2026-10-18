import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChurchEvent,
  EventAttendance,
  ChurchEventAdministrator,
  EventOccurrence,
  EventRegistration,
  EventRegistrationResult,
  EventScanResult,
  EventStatistics,
  EventManagerAccess,
  PublicEventDetails,
  EventWriteRequest,
} from '../models/event';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly apiUrl = `${environment.apiBaseUrl}/events`;

  constructor(private http: HttpClient) {}

  managerAccess(): Observable<EventManagerAccess> {
    return this.http.get<EventManagerAccess>(`${this.apiUrl}/manager-access/`);
  }

  churchAdministrators(churchId: string): Observable<ChurchEventAdministrator[]> {
    return this.http.get<ChurchEventAdministrator[]>(`${this.apiUrl}/churches/${churchId}/administrators/`);
  }

  assignChurchAdministrator(churchId: string, memberId: string): Observable<ChurchEventAdministrator> {
    return this.http.post<ChurchEventAdministrator>(`${this.apiUrl}/churches/${churchId}/administrators/`, { member_id: memberId });
  }

  removeChurchAdministrator(churchId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/churches/${churchId}/administrators/`, { body: { member_id: memberId } });
  }

  list(filters: { status?: string; scope?: string; search?: string; category?: string; starts_after?: string; starts_before?: string } = {}): Observable<ChurchEvent[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });
    return this.http.get<ChurchEvent[]>(`${this.apiUrl}/`, { params });
  }

  get(id: string): Observable<ChurchEvent> {
    return this.http.get<ChurchEvent>(`${this.apiUrl}/${id}/`);
  }

  create(payload: EventWriteRequest): Observable<ChurchEvent> {
    return this.http.post<ChurchEvent>(`${this.apiUrl}/`, payload);
  }

  update(id: string, payload: Partial<ChurchEvent>): Observable<ChurchEvent> {
    return this.http.patch<ChurchEvent>(`${this.apiUrl}/${id}/`, payload);
  }

  updateOccurrence(eventId: string, occurrenceId: string, payload: Partial<EventOccurrence>): Observable<EventOccurrence> {
    return this.http.patch<EventOccurrence>(`${this.apiUrl}/${eventId}/occurrences/${occurrenceId}/`, payload);
  }

  updateSeries(eventId: string, payload: {
    confirm_future: boolean;
    event?: Partial<ChurchEvent>;
    occurrence?: Partial<EventOccurrence>;
  }): Observable<{ event: ChurchEvent; occurrences_updated: number }> {
    return this.http.post<{ event: ChurchEvent; occurrences_updated: number }>(`${this.apiUrl}/${eventId}/series-update/`, payload);
  }

  changeStatus(id: string, status: string, confirm = false): Observable<ChurchEvent> {
    return this.http.post<ChurchEvent>(`${this.apiUrl}/${id}/status/`, { status, confirm });
  }

  changeOccurrenceStatus(eventId: string, occurrenceId: string, status: string, confirm = false): Observable<EventOccurrence> {
    return this.http.post<EventOccurrence>(`${this.apiUrl}/${eventId}/occurrences/${occurrenceId}/status/`, { status, confirm });
  }

  generateOccurrences(id: string, limit = 50): Observable<EventOccurrence[]> {
    return this.http.post<EventOccurrence[]>(`${this.apiUrl}/${id}/occurrences/generate/`, { limit });
  }

  listRegistrations(eventId: string, occurrenceId: string, history = true): Observable<EventRegistration[]> {
    const params = history ? new HttpParams().set('history', '1') : undefined;
    return this.http.get<EventRegistration[]>(`${this.apiUrl}/${eventId}/occurrences/${occurrenceId}/registrations/`, { params });
  }

  listAttendances(eventId: string, occurrenceId: string): Observable<EventAttendance[]> {
    return this.http.get<EventAttendance[]>(`${this.apiUrl}/${eventId}/occurrences/${occurrenceId}/attendances/`);
  }

  publicEvent(eventId: string): Observable<PublicEventDetails> {
    return this.http.get<PublicEventDetails>(`${this.apiUrl}/public/${eventId}/`);
  }

  register(eventId: string, occurrenceId: string, guest: { first_name?: string; last_name?: string; email?: string; phone?: string }): Observable<EventRegistrationResult> {
    return this.http.post<EventRegistrationResult>(`${this.apiUrl}/public/${eventId}/occurrences/${occurrenceId}/registrations/`, guest);
  }

  scan(token: string, expectedOccurrenceId: string): Observable<EventScanResult> {
    return this.http.post<EventScanResult>(`${this.apiUrl}/registrations/scan/`, { token, expected_occurrence_id: expectedOccurrenceId });
  }

  cancelRegistration(registrationId: string, manageToken?: string): Observable<EventRegistration> {
    return this.http.post<EventRegistration>(`${this.apiUrl}/registrations/${registrationId}/cancel/`, {
      ...(manageToken ? { manage_token: manageToken } : {}),
    });
  }

  registrationStatus(registrationId: string, manageToken?: string): Observable<EventRegistration> {
    let params = new HttpParams();
    if (manageToken) params = params.set('manage_token', manageToken);
    return this.http.get<EventRegistration>(`${this.apiUrl}/registrations/${registrationId}/`, { params });
  }

  respondToOffer(registrationId: string, accept: boolean, manageToken?: string): Observable<{
    registration: EventRegistration;
    qr_token: string | null;
    verification_code: string | null;
  }> {
    return this.http.post<{
      registration: EventRegistration;
      qr_token: string | null;
      verification_code: string | null;
    }>(
      `${this.apiUrl}/registrations/${registrationId}/offer-response/`,
      { accept, ...(manageToken ? { manage_token: manageToken } : {}) },
    );
  }

  confirmCheckIn(registrationId: string, token: string, exceptionReason = ''): Observable<{ result: string; detail: string; attendance: EventAttendance }> {
    return this.http.post<{ result: string; detail: string; attendance: EventAttendance }>(
      `${this.apiUrl}/registrations/${registrationId}/check-in/`,
      { token, exception_reason: exceptionReason },
    );
  }

  correctAttendance(attendanceId: string, state: 'PRESENT' | 'REVOKED', reason: string): Observable<{ correction_id: string; attendance: EventAttendance }> {
    return this.http.post<{ correction_id: string; attendance: EventAttendance }>(
      `${this.apiUrl}/attendances/${attendanceId}/corrections/`,
      { state, reason },
    );
  }

  createSelfCheckInQr(eventId: string, occurrenceId: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrl}/${eventId}/occurrences/${occurrenceId}/self-checkin-token/`, {});
  }

  selfCheckIn(eventId: string, occurrenceId: string, token: string): Observable<{ result: string; detail: string; attendance: EventAttendance }> {
    return this.http.post<{ result: string; detail: string; attendance: EventAttendance }>(
      `${this.apiUrl}/${eventId}/occurrences/${occurrenceId}/self-checkin/`,
      { token },
    );
  }

  statistics(eventId: string): Observable<EventStatistics> {
    return this.http.get<EventStatistics>(`${this.apiUrl}/${eventId}/statistics/`);
  }
}
