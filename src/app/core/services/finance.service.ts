import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FinanceConfigurationPayload,
  FinanceAccount,
  FinanceCategory,
  FinanceCashJournal,
  FinanceContext,
  FinanceFund,
  FinancePayment,
  FinanceReport,
  FinanceSummary,
  FinanceTransaction,
  FinanceTransactionPayload,
  FinancialBudget,
  FinancialConfiguration,
  FinancialPeriod,
  FinancialPeriodPayload,
} from '../models/finance';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly apiUrl = `${environment.apiBaseUrl}/finance`;

  constructor(private http: HttpClient) {}

  getContext(): Observable<FinanceContext> {
    return this.http.get<FinanceContext>(`${this.apiUrl}/context/`);
  }

  getConfiguration(churchId: string): Observable<FinancialConfiguration | null> {
    return this.http.get<FinancialConfiguration>(`${this.apiUrl}/churches/${churchId}/configuration/`).pipe(
      catchError((error) => error.status === 404 ? of(null) : throwError(() => error)),
    );
  }

  createConfiguration(churchId: string, payload: FinanceConfigurationPayload): Observable<FinancialConfiguration> {
    return this.http.post<FinancialConfiguration>(
      `${this.apiUrl}/churches/${churchId}/configuration/`,
      payload,
    );
  }

  updateConfiguration(churchId: string, payload: FinanceConfigurationPayload): Observable<FinancialConfiguration> {
    return this.http.patch<FinancialConfiguration>(
      `${this.apiUrl}/churches/${churchId}/configuration/`,
      payload,
    );
  }

  listPeriods(churchId: string): Observable<FinancialPeriod[]> {
    return this.http.get<FinancialPeriod[]>(`${this.apiUrl}/periods/`, {
      params: { church_id: churchId },
    });
  }

  createPeriod(payload: FinancialPeriodPayload): Observable<FinancialPeriod> {
    return this.http.post<FinancialPeriod>(`${this.apiUrl}/periods/`, payload);
  }

  getSummary(churchId: string): Observable<FinanceSummary> {
    return this.http.get<FinanceSummary>(`${this.apiUrl}/summary/`, { params: { church_id: churchId } });
  }

  getReport(churchId: string, startDate: string, endDate: string, periodId = ''): Observable<FinanceReport> {
    const params: Record<string, string> = {
      church_id: churchId,
      start_date: startDate,
      end_date: endDate,
    };
    if (periodId) params['period_id'] = periodId;
    return this.http.get<FinanceReport>(`${this.apiUrl}/reports/`, { params });
  }

  getCashJournal(
    churchId: string,
    startDate: string,
    endDate: string,
    accountId = '',
    periodId = '',
  ): Observable<FinanceCashJournal> {
    const params: Record<string, string> = {
      church_id: churchId,
      start_date: startDate,
      end_date: endDate,
    };
    if (accountId) params['account_id'] = accountId;
    if (periodId) params['period_id'] = periodId;
    return this.http.get<FinanceCashJournal>(`${this.apiUrl}/cash-journal/`, { params });
  }

  listCategories(churchId: string): Observable<FinanceCategory[]> {
    return this.http.get<FinanceCategory[]>(`${this.apiUrl}/categories/`, { params: { church_id: churchId } });
  }

  listFunds(churchId: string): Observable<FinanceFund[]> {
    return this.http.get<FinanceFund[]>(`${this.apiUrl}/funds/`, { params: { church_id: churchId } });
  }

  listAccounts(churchId: string): Observable<FinanceAccount[]> {
    return this.http.get<FinanceAccount[]>(`${this.apiUrl}/accounts/`, { params: { church_id: churchId } });
  }

  listTransactions(churchId: string): Observable<FinanceTransaction[]> {
    return this.http.get<FinanceTransaction[]>(`${this.apiUrl}/transactions/`, { params: { church_id: churchId } });
  }

  listPayments(churchId: string): Observable<FinancePayment[]> {
    return this.http.get<FinancePayment[]>(`${this.apiUrl}/payments/`, {
      params: { church_id: churchId, status: 'PENDING' },
    });
  }

  listBudgets(churchId: string): Observable<FinancialBudget[]> {
    return this.http.get<FinancialBudget[]>(`${this.apiUrl}/budgets/`, { params: { church_id: churchId } });
  }

  createTransaction(churchId: string, payload: FinanceTransactionPayload): Observable<FinanceTransaction> {
    return this.http.post<FinanceTransaction>(`${this.apiUrl}/transactions/`, { ...payload, church_id: churchId });
  }

  decideTransaction(
    transactionId: string,
    decision: 'approve' | 'reject' | 'confirm',
    payload: Record<string, unknown>,
  ): Observable<FinanceTransaction> {
    return this.http.post<FinanceTransaction>(
      `${this.apiUrl}/transactions/${transactionId}/actions/${decision}/`,
      payload,
    );
  }

  initiatePayment(transactionId: string, payload: {
    account_id: string;
    amount: string;
    method: string;
    reference: string;
  }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.apiUrl}/transactions/${transactionId}/payments/`, payload);
  }

  confirmPayment(paymentId: string, confirmed: boolean, reason = ''): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/payments/${paymentId}/actions/`, { confirmed, reason });
  }

  createBudget(churchId: string, payload: {
    period_id: string;
    category_id: string;
    name: string;
    allocated_amount: string;
    currency: string;
  }): Observable<FinancialBudget> {
    return this.http.post<FinancialBudget>(`${this.apiUrl}/budgets/`, { ...payload, church_id: churchId });
  }

  reviseBudget(budgetId: string, allocatedAmount: string, reason: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/budgets/${budgetId}/revisions/`, {
      allocated_amount: allocatedAmount,
      reason,
    });
  }

  createAccount(churchId: string, payload: {
    name: string;
    kind: FinanceAccount['kind'];
    currency: string;
    opening_balance: string;
  }): Observable<FinanceAccount> {
    return this.http.post<FinanceAccount>(`${this.apiUrl}/accounts/`, { ...payload, church_id: churchId });
  }

  createFund(churchId: string, payload: { name: string; purpose: string; is_restricted: boolean }): Observable<FinanceFund> {
    return this.http.post<FinanceFund>(`${this.apiUrl}/funds/`, { ...payload, church_id: churchId });
  }

  periodAction(periodId: string, action: 'close' | 'reopen', reason = ''): Observable<FinancialPeriod> {
    return this.http.post<FinancialPeriod>(`${this.apiUrl}/periods/${periodId}/actions/${action}/`, { reason });
  }
}
