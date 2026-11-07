import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../services/notification.service';

export const notificationInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse && isMutation(req.method) && isApiRequest(req.url)) {
        const message = successMessage(req.method, req.url, event.body);
        if (message) notifications.showSuccess(message);
      }
    }),
    catchError((error: unknown) => {
      const expectedNotFound = req.method === 'GET' && error instanceof HttpErrorResponse && error.status === 404;
      const handledAuthenticationError = error instanceof HttpErrorResponse && error.status === 401;
      if (error instanceof HttpErrorResponse && isApiRequest(req.url) && !expectedNotFound && !handledAuthenticationError) {
        notifications.showError(errorMessage(error));
      }
      return throwError(() => error);
    }),
  );
};

function isMutation(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl);
}

function successMessage(method: string, url: string, body: unknown): string | null {
  if (url.includes('/auth/')) {
    if (url.includes('/auth/login/')) return 'Connexion réussie.';
    if (url.includes('/auth/logout/')) return 'Déconnexion réussie.';
    if (url.includes('/auth/select-organization/')) return 'Organisation sélectionnée.';
    if (url.includes('/auth/register/')) return 'Compte créé avec succès.';
    return null;
  }

  if (url.includes('/actions/')) {
    if (url.endsWith('/approve/')) return 'Opération approuvée.';
    if (url.endsWith('/reject/')) return 'Opération rejetée.';
    if (url.endsWith('/confirm/')) return 'Opération confirmée.';
  }

  if (isRecord(body) && typeof body['detail'] === 'string' && body['detail'].trim()) {
    return body['detail'].trim();
  }

  switch (method.toUpperCase()) {
    case 'DELETE': return 'Suppression effectuée avec succès.';
    case 'PATCH':
    case 'PUT': return 'Modifications enregistrées avec succès.';
    default: return 'Opération enregistrée avec succès.';
  }
}

function errorMessage(error: HttpErrorResponse): string {
  const payload: unknown = error.error;
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (isRecord(payload)) {
    const detail = payload['detail'];
    if (typeof detail === 'string' && detail.trim()) return detail.trim();

    const messages = Object.entries(payload).flatMap(([field, value]) => {
      const fieldMessages = Array.isArray(value) ? value : [value];
      return fieldMessages
        .filter((item): item is string => typeof item === 'string' && !!item.trim())
        .map((item) => field === 'non_field_errors' ? item : `${field}: ${item}`);
    });
    if (messages.length) return messages.join(' · ');
  }

  if (error.status === 0) return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  return `Une erreur est survenue (code ${error.status}).`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
