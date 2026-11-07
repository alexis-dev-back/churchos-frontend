import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Task, TaskFilters, TaskListResponse, TaskWritePayload } from '../models/task';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly apiUrl = `${environment.apiBaseUrl}/tasks`;

  constructor(private http: HttpClient) {}

  list(filters: TaskFilters = {}): Observable<TaskListResponse> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.overdue) params = params.set('overdue', '1');
    return this.http.get<TaskListResponse>(`${this.apiUrl}/`, { params });
  }

  create(payload: TaskWritePayload): Observable<Task> {
    return this.http.post<Task>(`${this.apiUrl}/`, payload);
  }

  update(id: string, payload: Partial<TaskWritePayload>): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/${id}/`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }
}
