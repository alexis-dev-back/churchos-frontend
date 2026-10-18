import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

let refreshInFlight: Observable<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const accessToken = localStorage.getItem('churchos_access_token');
  const refreshToken = localStorage.getItem('churchos_refresh_token');
  const router = inject(Router);
  const rawHttp = new HttpClient(inject(HttpBackend));

  const authReq = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthRequest = /\/auth\/(login|register|refresh|logout|accept-invitation|select-organization)\//.test(req.url);
      if (error.status === 401 && refreshToken && !isAuthRequest) {
        if (!refreshInFlight) {
          refreshInFlight = rawHttp.post<{ access: string; refresh?: string }>(`${environment.apiBaseUrl}/auth/refresh/`, { refresh: refreshToken }).pipe(
            tap((tokens) => {
              localStorage.setItem('churchos_access_token', tokens.access);
              if (tokens.refresh) localStorage.setItem('churchos_refresh_token', tokens.refresh);
            }),
            map((tokens) => tokens.access),
            catchError((refreshError: unknown) => {
              localStorage.removeItem('churchos_access_token');
              localStorage.removeItem('churchos_refresh_token');
              router.navigateByUrl('/login');
              return throwError(() => refreshError);
            }),
            finalize(() => refreshInFlight = null),
            shareReplay({ bufferSize: 1, refCount: false }),
          );
        }
        return refreshInFlight.pipe(switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))));
      }
      if (error.status === 401 && !isAuthRequest) {
        localStorage.removeItem('churchos_access_token');
        localStorage.removeItem('churchos_refresh_token');
        router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
