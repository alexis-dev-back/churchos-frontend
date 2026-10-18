import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FinanceContext, FinanceReport, FinancialPeriod } from '../../core/models/finance';
import { FinanceService } from '../../core/services/finance.service';

type ReportKind = 'summary' | 'income' | 'expenses' | 'budgets' | 'accounts';

@Component({
  selector: 'app-finance-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './finance-reports.component.html',
})
export class FinanceReportsComponent implements OnInit {
  context: FinanceContext | null = null;
  report: FinanceReport | null = null;
  periods: FinancialPeriod[] = [];
  selectedChurchId = '';
  selectedPeriodId = '';
  selectedReport: ReportKind = 'summary';
  startDate: string;
  endDate: string;
  loading = true;
  reportLoading = false;
  errorMessage = '';

  constructor(private financeService: FinanceService) {
    const today = new Date();
    this.startDate = this.formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
    this.endDate = this.formatDate(today);
  }

  ngOnInit(): void {
    this.financeService.getContext().subscribe({
      next: (context) => {
        this.context = context;
        this.selectedChurchId = context.churches[0]?.church_id ?? '';
        if (!this.selectedChurchId) {
          this.loading = false;
          this.errorMessage = 'Aucune église accessible pour les rapports financiers.';
          return;
        }
        this.loadReport();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger les accès financiers.');
      },
    });
  }

  onChurchChange(): void {
    this.selectedPeriodId = '';
    this.loadReport();
  }

  loadReport(): void {
    if (!this.selectedChurchId || !this.startDate || !this.endDate) return;
    if (this.startDate > this.endDate) {
      this.errorMessage = 'La date de début doit précéder la date de fin.';
      return;
    }
    this.errorMessage = '';
    this.reportLoading = true;
    this.loading = false;
    forkJoin({
      report: this.financeService.getReport(
        this.selectedChurchId,
        this.startDate,
        this.endDate,
        this.selectedPeriodId,
      ),
      periods: this.financeService.listPeriods(this.selectedChurchId),
    }).subscribe({
      next: ({ report, periods }) => {
        this.report = report;
        this.periods = periods;
        this.reportLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.reportLoading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de produire les rapports financiers.');
      },
    });
  }

  printReport(): void {
    window.print();
  }

  formatMoney(amount: string | number, currency: string): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  }

  get churches() {
    return this.context?.churches ?? [];
  }

  reportTitle(kind: ReportKind): string {
    return {
      summary: 'Synthèse financière',
      income: 'Rapport des recettes',
      expenses: 'Rapport des dépenses',
      budgets: 'Suivi des budgets',
      accounts: 'Situation des caisses et comptes',
    }[kind];
  }

  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const detail = error.error?.detail;
    if (typeof detail === 'string') return detail;
    if (error.error && typeof error.error === 'object') {
      const firstMessage = Object.values(error.error).flat().find((value) => typeof value === 'string');
      if (typeof firstMessage === 'string') return firstMessage;
    }
    return fallback;
  }
}
