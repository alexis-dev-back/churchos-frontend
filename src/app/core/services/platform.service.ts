import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PlatformPlan {
  id: string;
  name: string;
  tier: string;
  price: string;
  currency: string;
  period: string;
  features: string[];
  is_active: boolean;
}

export interface PlatformStats {
  organizations: number;
  churches: number;
  subscriptions_active: number;
  subscriptions_trial: number;
  subscriptions_suspended: number;
  invoices_pending: number;
  invoices_pending_amount: string;
  tickets_open: number;
  users: number;
  users_active: number;
  members: number;
  mrr: string;
  arr: string;
}

export interface PlatformSubscription {
  id: string;
  organization: string;
  organization_name: string;
  plan: string;
  plan_name: string;
  plan_tier: string;
  status: string;
  started_at: string;
  renewal_at: string | null;
  cancelled_at: string | null;
}

export interface PlatformInvoice {
  id: string;
  number: string;
  organization: string;
  organization_name: string;
  subscription: string | null;
  amount: string;
  currency: string;
  issued_at: string;
  due_at: string;
  status: string;
}

export interface PlatformTicket {
  id: string;
  number: string;
  organization: string;
  organization_name: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
}

export interface PlatformSettings {
  platform_name: string;
  support_email: string;
  default_currency: string;
  default_language: string;
}

export interface InvoiceWriteRequest {
  number: string;
  organization: string;
  amount: number | string;
  currency?: string;
  issued_at: string;
  due_at: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly apiUrl = `${environment.apiBaseUrl}/platform`;

  constructor(private http: HttpClient) {}

  getPlans(): Observable<PlatformPlan[]> {
    return this.http.get<PlatformPlan[]>(`${this.apiUrl}/plans/`);
  }

  getStats(): Observable<PlatformStats> {
    return this.http.get<PlatformStats>(`${this.apiUrl}/stats/`);
  }

  getSubscriptions(): Observable<PlatformSubscription[]> {
    return this.http.get<PlatformSubscription[]>(`${this.apiUrl}/subscriptions/`);
  }

  getInvoices(): Observable<PlatformInvoice[]> {
    return this.http.get<PlatformInvoice[]>(`${this.apiUrl}/invoices/`);
  }

  createInvoice(payload: InvoiceWriteRequest): Observable<PlatformInvoice> {
    return this.http.post<PlatformInvoice>(`${this.apiUrl}/invoices/`, payload);
  }

  getTickets(): Observable<PlatformTicket[]> {
    return this.http.get<PlatformTicket[]>(`${this.apiUrl}/tickets/`);
  }

  getSettings(): Observable<PlatformSettings> {
    return this.http.get<PlatformSettings>(`${this.apiUrl}/settings/`);
  }

  saveSettings(payload: PlatformSettings): Observable<PlatformSettings> {
    return this.http.put<PlatformSettings>(`${this.apiUrl}/settings/`, payload);
  }
}
