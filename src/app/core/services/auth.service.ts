import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthTokens, LoginRequest, MeResponse, RegisterRequest, SelectOrganizationRequest, SelectOrganizationResponse } from '../models/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiBaseUrl}`;

  constructor(private http: HttpClient) {}

  login(payload: LoginRequest): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${this.apiUrl}/auth/login/`, payload)
      .pipe(tap((response) => this.storeTokens(response)));
  }

  register(payload: RegisterRequest): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${this.apiUrl}/auth/register/`, payload)
      .pipe(tap((response) => this.storeTokens(response)));
  }

  acceptInvitation(payload: { token: string; email: string; username: string; password: string; password_confirmation: string }): Observable<{ detail: string; member_id: string; status: string }> {
    return this.http.post<{ detail: string; member_id: string; status: string }>(`${this.apiUrl}/auth/accept-invitation/`, payload);
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.apiUrl}/auth/me/`);
  }

  selectOrganization(payload: SelectOrganizationRequest): Observable<SelectOrganizationResponse> {
    return this.http.post<SelectOrganizationResponse>(`${this.apiUrl}/auth/select-organization/`, payload).pipe(
      tap((response) => {
        if (response.access && response.refresh) {
          this.storeTokens({ access: response.access, refresh: response.refresh });
        }
      }),
    );
  }

  logout(): Observable<void> {
    const refreshToken = localStorage.getItem('churchos_refresh_token');
    return this.http.post<void>(`${this.apiUrl}/auth/logout/`, { refresh: refreshToken }).pipe(
      tap(() => {
        this.clearSession();
      }),
    );
  }

  clearSession(): void {
    localStorage.removeItem('churchos_access_token');
    localStorage.removeItem('churchos_refresh_token');
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem('churchos_access_token', tokens.access);
    if (tokens.refresh) {
      localStorage.setItem('churchos_refresh_token', tokens.refresh);
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('churchos_access_token');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}
