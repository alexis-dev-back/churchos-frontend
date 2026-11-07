import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit } from '@angular/core';
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
  successMessage = '';

  /* ---- Journal dense table state ---- */
  openMenuId: string | null = null;
  menuPosition = { top: 0, left: 0 };
  journalSortField: 'created_at' | 'account_name' | 'category_name' | 'direction' = 'created_at';
  journalSortDirection: 'asc' | 'desc' = 'desc';
  selectedJournalIds = new Set<string>();
  journalPageIndex = 0;
  readonly journalPageSize = 10;

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

  /* ---- Journal dense table getters ---- */
  get filteredMovements(): FinanceCashJournal['results'][number][] {
    const direction = this.journalSortDirection === 'asc' ? 1 : -1;
    return [...(this.journal?.results ?? [])].sort((a, b) => this.journalSortValue(a).localeCompare(this.journalSortValue(b), 'fr', { sensitivity: 'base' }) * direction);
  }
  get pagedMovements(): FinanceCashJournal['results'][number][] {
    const start = this.journalPageIndex * this.journalPageSize;
    return this.filteredMovements.slice(start, start + this.journalPageSize);
  }
  get journalPageCount(): number { return Math.max(1, Math.ceil(this.filteredMovements.length / this.journalPageSize)); }
  get journalRangeStart(): number { return this.filteredMovements.length ? this.journalPageIndex * this.journalPageSize + 1 : 0; }
  get journalRangeEnd(): number { return Math.min((this.journalPageIndex + 1) * this.journalPageSize, this.filteredMovements.length); }
  get visibleJournalPages(): number[] { return Array.from({ length: Math.min(this.journalPageCount, 5) }, (_, index) => index); }
  get allJournalVisibleSelected(): boolean { return this.pagedMovements.length > 0 && this.pagedMovements.every((movement) => this.selectedJournalIds.has(movement.id)); }
  private journalSortValue(movement: FinanceCashJournal['results'][number]): string {
    switch (this.journalSortField) {
      case 'account_name': return movement.account_name;
      case 'category_name': return movement.category_name;
      case 'direction': return movement.direction === 'IN' ? 'Entrée' : 'Sortie';
      default: return movement.created_at;
    }
  }
  toggleJournalSelection(id: string, event: Event): void {
    if ((event.target as HTMLInputElement).checked) this.selectedJournalIds.add(id); else this.selectedJournalIds.delete(id);
  }
  toggleVisibleJournalSelection(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const ids = this.pagedMovements.map((movement) => movement.id);
    this.selectedJournalIds = new Set([...this.selectedJournalIds].filter((id) => !ids.includes(id)));
    if (checked) ids.forEach((id) => this.selectedJournalIds.add(id));
  }
  sortByJournal(field: 'created_at' | 'account_name' | 'category_name' | 'direction'): void {
    if (this.journalSortField === field) this.journalSortDirection = this.journalSortDirection === 'asc' ? 'desc' : 'asc';
    else { this.journalSortField = field; this.journalSortDirection = 'asc'; }
    this.journalPageIndex = 0;
  }
  changeJournalPage(delta: number): void { this.journalPageIndex = Math.max(0, Math.min(this.journalPageCount - 1, this.journalPageIndex + delta)); }
  goToJournalPage(page: number): void { this.journalPageIndex = Math.max(0, Math.min(this.journalPageCount - 1, page)); }
  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    if (this.openMenuId === id) { this.openMenuId = null; return; }
    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    const width = 232;
    const estimatedHeight = 120;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const top = rect.bottom + 6 + estimatedHeight > window.innerHeight
      ? Math.max(8, rect.top - estimatedHeight - 6)
      : rect.bottom + 6;
    this.menuPosition = { top, left };
    this.openMenuId = id;
  }
  @HostListener('window:scroll')
  closeMenuOnScroll(): void { this.openMenuId = null; }
  @HostListener('window:resize')
  closeMenuOnResize(): void { this.openMenuId = null; }
  @HostListener('document:click', ['$event'])
  closeMenuOnDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.context-wrap')) this.openMenuId = null;
  }
  viewJournalDetail(movement: FinanceCashJournal['results'][number]): void {
    this.openMenuId = null;
    this.errorMessage = '';
    this.successMessage = `Écriture « ${movement.category_name } » · ${movement.account_name } · ${this.formatMoney(movement.amount, movement.currency)}`;
  }
  trackByJournalId(_index: number, movement: FinanceCashJournal['results'][number]): string { return movement.id; }

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
