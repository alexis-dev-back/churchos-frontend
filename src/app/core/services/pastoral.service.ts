import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PastoralCase {
  id: string;
  church: string;
  church_name: string;
  campus: string | null;
  campus_name: string | null;
  member: string | null;
  member_name: string | null;
  person: string | null;
  person_name: string | null;
  title: string;
  category: string;
  status: string;
  sensitivity: string;
  priority: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  next_due_at: string | null;
  closed_at: string | null;
  archived_at: string | null;
  possible_duplicates?: Array<{ id: string; title: string; status: string }>;
}

export interface PastoralInteraction {
  id: string;
  kind: string;
  objective: string;
  scheduled_at: string;
  location: string;
  status: string;
  outcome: string | null;
  can_read_outcome: boolean;
  next_due_at: string | null;
}

export interface PastoralNote {
  id: string;
  author: number;
  content: string;
  sensitivity: string;
  author_name: string;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface PastoralTask {
  id: string;
  case: string;
  title: string;
  description: string;
  assigned_to: number;
  assigned_to_name: string;
  priority: string;
  due_at: string | null;
  status: string;
  recurrence: string;
}

export interface PastoralAssigneeSuggestion {
  id: number;
  username: string;
  active_case_count: number;
}

export interface PastoralNotification {
  id: string;
  type: string;
  message: string;
  task_id: string | null;
  case_id: string | null;
  created_at: string;
  read_at: string | null;
}

export interface PastoralPrayerRequest {
  id: string;
  church_name: string;
  is_anonymous: boolean;
  subject_name: string | null;
  category: string;
  content: string;
  status: string;
  created_at: string;
}

export interface PastoralDashboard {
  cases_by_status: Array<{ status: string; total: number }>;
  open_cases: number;
  closed_cases: number;
  waiting_cases: number;
  unassigned_cases: number;
  unassigned_alerts: number;
  overdue_tasks: number;
  interactions_completed: number;
  interactions_missed: number;
  prayer_requests_followed: number;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class PastoralService {
  private readonly apiUrl = `${environment.apiBaseUrl}/pastoral`;

  constructor(private http: HttpClient) {}

  dashboard(): Observable<PastoralDashboard> {
    return this.http.get<PastoralDashboard>(`${this.apiUrl}/dashboard/`);
  }

  cases(filters: { search?: string; status?: string } = {}): Observable<Page<PastoralCase>> {
    let params = new HttpParams();
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<Page<PastoralCase>>(`${this.apiUrl}/cases/`, { params });
  }

  caseDetail(id: string): Observable<PastoralCase> {
    return this.http.get<PastoralCase>(`${this.apiUrl}/cases/${id}/`);
  }

  createCase(payload: Record<string, unknown>): Observable<PastoralCase> {
    return this.http.post<PastoralCase>(`${this.apiUrl}/cases/`, payload);
  }

  potentialDuplicates(filters: { church_id: string; campus_id?: string; member_id?: string; person_id?: string }): Observable<Array<{ id: string; title: string; status: string; church_name: string }>> {
    let params = new HttpParams().set('church_id', filters.church_id);
    if (filters.campus_id) params = params.set('campus_id', filters.campus_id);
    if (filters.member_id) params = params.set('member_id', filters.member_id);
    if (filters.person_id) params = params.set('person_id', filters.person_id);
    return this.http.get<Array<{ id: string; title: string; status: string; church_name: string }>>(
      `${this.apiUrl}/cases/potential-duplicates/`,
      { params },
    );
  }

  caseHistory(id: string): Observable<Record<string, unknown[]>> {
    return this.http.get<Record<string, unknown[]>>(`${this.apiUrl}/cases/${id}/history/`);
  }

  caseAudit(id: string): Observable<Array<{ action: string; actor: string | null; result: string; metadata: Record<string, unknown>; created_at: string }>> {
    return this.http.get<Array<{ action: string; actor: string | null; result: string; metadata: Record<string, unknown>; created_at: string }>>(`${this.apiUrl}/cases/${id}/audit/`);
  }

  transitionCase(id: string, payload: { status: string; reason: string; next_due_at?: string }): Observable<PastoralCase> {
    return this.http.post<PastoralCase>(`${this.apiUrl}/cases/${id}/transition/`, payload);
  }

  closeCase(id: string, reason: string): Observable<PastoralCase> {
    return this.http.post<PastoralCase>(`${this.apiUrl}/cases/${id}/close/`, { reason });
  }

  reopenCase(id: string, reason: string, nextDueAt: string): Observable<PastoralCase> {
    return this.http.post<PastoralCase>(`${this.apiUrl}/cases/${id}/reopen/`, { reason, next_due_at: nextDueAt });
  }

  assignCase(id: string, payload: { assigned_to: number | null; reason: string }): Observable<PastoralCase> {
    return this.http.post<PastoralCase>(`${this.apiUrl}/cases/${id}/assign/`, payload);
  }

  assigneeSuggestions(id: string): Observable<PastoralAssigneeSuggestion[]> {
    return this.http.get<PastoralAssigneeSuggestion[]>(`${this.apiUrl}/cases/${id}/assignee-suggestions/`);
  }

  shareCase(id: string, payload: { user_id: number; access_level: 'READ' | 'EDIT' }): Observable<{ shared: boolean }> {
    return this.http.post<{ shared: boolean }>(`${this.apiUrl}/cases/${id}/share/`, payload);
  }

  interactions(caseId: string): Observable<PastoralInteraction[]> {
    return this.http.get<PastoralInteraction[]>(`${this.apiUrl}/cases/${caseId}/interactions/`);
  }

  createInteraction(caseId: string, payload: Record<string, unknown>): Observable<PastoralInteraction> {
    return this.http.post<PastoralInteraction>(`${this.apiUrl}/cases/${caseId}/interactions/`, payload);
  }

  interactionKinds(caseId: string): Observable<Array<{ code: string; label: string }>> {
    return this.http.get<Array<{ code: string; label: string }>>(`${this.apiUrl}/cases/${caseId}/interaction-kinds/`);
  }

  notes(caseId: string): Observable<PastoralNote[]> {
    return this.http.get<PastoralNote[]>(`${this.apiUrl}/cases/${caseId}/notes/`);
  }

  createNote(caseId: string, payload: { content: string; sensitivity?: string }): Observable<PastoralNote> {
    return this.http.post<PastoralNote>(`${this.apiUrl}/cases/${caseId}/notes/`, payload);
  }

  reviseNote(caseId: string, noteId: string, payload: { content: string; reason: string }): Observable<PastoralNote> {
    return this.http.patch<PastoralNote>(`${this.apiUrl}/cases/${caseId}/notes/${noteId}/`, payload);
  }

  noteHistory(caseId: string, noteId: string): Observable<Array<{ content: string; actor: string; reason: string; created_at: string }>> {
    return this.http.get<Array<{ content: string; actor: string; reason: string; created_at: string }>>(`${this.apiUrl}/cases/${caseId}/notes/${noteId}/history/`);
  }

  shareNote(caseId: string, noteId: string, userId: number, canEdit = false): Observable<{ shared: boolean }> {
    return this.http.post<{ shared: boolean }>(`${this.apiUrl}/cases/${caseId}/notes/${noteId}/share/`, { user_id: userId, can_edit: canEdit });
  }

  tasks(caseId?: string): Observable<PastoralTask[]> {
    const path = caseId ? `/cases/${caseId}/tasks/` : '/tasks/';
    return this.http.get<PastoralTask[]>(`${this.apiUrl}${path}`);
  }

  updateTask(id: string, payload: Record<string, unknown>): Observable<PastoralTask> {
    return this.http.patch<PastoralTask>(`${this.apiUrl}/tasks/${id}/`, payload);
  }

  updateInteraction(caseId: string, interactionId: string, payload: Record<string, unknown>): Observable<PastoralInteraction> {
    return this.http.patch<PastoralInteraction>(`${this.apiUrl}/cases/${caseId}/interactions/${interactionId}/`, payload);
  }

  createTask(caseId: string, payload: Record<string, unknown>): Observable<PastoralTask> {
    return this.http.post<PastoralTask>(`${this.apiUrl}/cases/${caseId}/tasks/`, payload);
  }

  prayerRequests(): Observable<Page<PastoralPrayerRequest>> {
    return this.http.get<Page<PastoralPrayerRequest>>(`${this.apiUrl}/prayer-requests/`);
  }

  createPrayerRequest(payload: Record<string, unknown>): Observable<PastoralPrayerRequest> {
    return this.http.post<PastoralPrayerRequest>(`${this.apiUrl}/prayer-requests/`, payload);
  }

  updatePrayerRequest(id: string, payload: { status?: string; assigned_to?: number | null; reason: string }): Observable<PastoralPrayerRequest> {
    return this.http.patch<PastoralPrayerRequest>(`${this.apiUrl}/prayer-requests/${id}/`, payload);
  }

  sharePrayerRequest(id: string, userId: number): Observable<{ shared: boolean }> {
    return this.http.post<{ shared: boolean }>(`${this.apiUrl}/prayer-requests/${id}/share/`, { user_id: userId });
  }

  workflow(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.apiUrl}/workflow/`);
  }

  updateWorkflow(payload: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>(`${this.apiUrl}/workflow/`, payload);
  }

  exportReport(from?: string, to?: string): Observable<Blob> {
    let params = new HttpParams().set('export', 'csv');
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get(`${this.apiUrl}/reports/`, { params, responseType: 'blob' });
  }

  notifications(): Observable<PastoralNotification[]> {
    return this.http.get<PastoralNotification[]>(`${this.apiUrl}/notifications/`);
  }

  markNotificationRead(id: string): Observable<{ read: boolean }> {
    return this.http.post<{ read: boolean }>(`${this.apiUrl}/notifications/${id}/read/`, {});
  }
}
