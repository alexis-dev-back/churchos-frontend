import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FinanceAccount, FinanceCashJournal, FinanceContext, FinancialPeriod } from '../../core/models/finance';
import { FinanceService } from '../../core/services/finance.service';

@Component({
  selector: 'app-finance-cash-journal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './finance-cash-journal.component.html',
})
export class FinanceCashJournalComponent implements OnInit {
  context: FinanceContext | null = null;
  journal: FinanceCashJournal | null = null;
  accounts: FinanceAccount[] = [];
  periods: FinancialPeriod[] = [];
  selectedChurchId = '';
  selectedAccountId = '';
  selectedPeriodId = '';
  startDate: string;
  endDate: string;
  loading = true;
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
          this.errorMessage = 'Aucune église accessible pour le journal de trésorerie.';
          return;
        }
        this.loadChurchData();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger les accès financiers.');
      },
    });
  }

  onChurchChange(): void {
    this.selectedAccountId = '';
    this.selectedPeriodId = '';
    this.loadChurchData();
  }

  loadJournal(): void {
    if (!this.selectedChurchId || !this.startDate || !this.endDate) return;
    if (this.startDate > this.endDate) {
      this.errorMessage = 'La date de début doit précéder la date de fin.';
      return;
    }
    this.errorMessage = '';
    this.loading = true;
    this.financeService.getCashJournal(
      this.selectedChurchId,
      this.startDate,
      this.endDate,
      this.selectedAccountId,
      this.selectedPeriodId,
    ).subscribe({
      next: (journal) => {
        this.journal = journal;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger le journal de caisse.');
      },
    });
  }

  printJournal(): void {
    window.print();
  }

  formatMoney(amount: string, currency: string): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  }

  paymentMethodLabel(method: string): string {
    return {
      CASH: 'Espèces',
      BANK_TRANSFER: 'Virement',
      MOBILE_MONEY: 'Mobile Money',
      CHEQUE: 'Chèque',
      ONLINE: 'En ligne',
      CARD: 'Carte',
      OTHER: 'Autre',
    }[method] ?? method;
  }

  get churches() {
    return this.context?.churches ?? [];
  }

  private loadChurchData(): void {
    this.loading = true;
    forkJoin({
      accounts: this.financeService.listAccounts(this.selectedChurchId),
      periods: this.financeService.listPeriods(this.selectedChurchId),
    }).subscribe({
      next: ({ accounts, periods }) => {
        this.accounts = accounts;
        this.periods = periods;
        this.loadJournal();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger les comptes et périodes.');
      },
    });
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
