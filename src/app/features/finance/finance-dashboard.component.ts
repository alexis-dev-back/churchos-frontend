import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  FinanceAccount,
  FinanceCategory,
  FinanceChurch,
  FinanceContext,
  FinanceFund,
  FinancePayment,
  FinancePaymentMethod,
  FinanceSummary,
  FinanceTransaction,
  FinancialBudget,
  FinancialConfiguration,
  FinancialPeriod,
} from '../../core/models/finance';
import { FinanceService } from '../../core/services/finance.service';

type FinanceModal = 'configuration' | 'period' | 'period-action' | 'income' | 'expense' | 'payment' | 'approval' | 'pending-payment' | 'budget' | 'account' | 'fund' | 'revision' | null;
type FinanceOperation = 'offrande' | 'dime' | 'don' | 'cotisation' | 'expense';
type FinanceOperationTab = FinanceOperation | 'all';

@Component({
  selector: 'app-finance-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './finance-dashboard.component.html',
})
export class FinanceDashboardComponent implements OnInit {
  context: FinanceContext | null = null;
  configuration: FinancialConfiguration | null = null;
  periods: FinancialPeriod[] = [];
  summary: FinanceSummary | null = null;
  categories: FinanceCategory[] = [];
  funds: FinanceFund[] = [];
  accounts: FinanceAccount[] = [];
  transactions: FinanceTransaction[] = [];
  pendingPayments: FinancePayment[] = [];
  budgets: FinancialBudget[] = [];
  selectedChurchId = '';
  selectedTransaction: FinanceTransaction | null = null;
  selectedPayment: FinancePayment | null = null;
  selectedBudget: FinancialBudget | null = null;
  selectedPeriod: FinancialPeriod | null = null;
  periodAction: 'close' | 'reopen' = 'close';
  approvalDecision: 'approve' | 'reject' = 'approve';
  paymentDecisionConfirmed = true;
  loading = true;
  saving = false;
  modal: FinanceModal = null;
  errorMessage = '';
  successMessage = '';
  configurationForm = { level: 1, base_currency: 'XOF', reason: '' };
  periodForm = { name: '', starts_on: '', ends_on: '' };
  transactionForm = {
    category_id: '',
    fund_id: '',
    counterparty_name: '',
    is_anonymous: false,
    description: '',
    amount: '',
    currency: 'XOF',
    payment_method: 'CASH' as FinancePaymentMethod,
    exchange_rate_to_base: '1',
    transaction_date: '',
    reference: '',
  };
  paymentForm = { account_id: '', amount: '', method: 'CASH', reference: '' };
  budgetForm = { period_id: '', category_id: '', name: '', allocated_amount: '', currency: 'XOF', reason: '' };
  accountForm = { name: '', kind: 'CASH' as FinanceAccount['kind'], currency: 'XOF', opening_balance: '0' };
  fundForm = { name: '', purpose: '', is_restricted: false };
  decisionReason = '';
  dashboardStartDate = '';
  dashboardEndDate = '';

  /* ---- Dashboard dense table state ---- */
  openMenuId: string | null = null;
  menuPosition = { top: 0, left: 0 };
  dashboardSortField: 'date' | 'client' | 'amount' | 'status' = 'date';
  dashboardSortDirection: 'asc' | 'desc' = 'desc';
  selectedDashboardIds = new Set<string>();
  dashboardPageIndex = 0;
  readonly dashboardPageSize = 10;
  activeOperationTab: FinanceOperationTab = 'all';
  activeOperation: FinanceOperation | null = null;
  dashboardSearch = '';
  readonly operationTabs: Array<{ key: FinanceOperationTab; label: string }> = [
    { key: 'all', label: 'TOUTES' },
    { key: 'offrande', label: 'OFFRANDES' },
    { key: 'dime', label: 'DÎMES' },
    { key: 'don', label: 'DONS' },
    { key: 'cotisation', label: 'COTISATIONS' },
    { key: 'expense', label: 'DÉPENSES / SORTIES' },
  ];
  private churchRequestId = 0;

  constructor(private financeService: FinanceService, private router: Router) {}

  ngOnInit(): void {
    this.loadContext();
  }

  get churches(): FinanceChurch[] {
    return this.context?.churches ?? [];
  }

  get selectedChurch(): FinanceChurch | undefined {
    return this.churches.find((church) => church.church_id === this.selectedChurchId);
  }

  get canConfigure(): boolean {
    return !!this.context?.is_organization_admin;
  }

  get canCreatePeriod(): boolean {
    return this.canConfigure || !!this.selectedChurch?.roles.some((role) =>
      ['FINANCE_ADMIN', 'TREASURER', 'ACCOUNTANT'].includes(role),
    ) || this.hasFinancePermission('finance.budget.manage');
  }

  get canRecordIncome(): boolean {
    return this.canConfigure || !!this.selectedChurch?.roles.some((role) =>
      ['FINANCE_ADMIN', 'REQUESTER', 'TREASURER'].includes(role),
    ) || this.hasFinancePermission('finance.income.create');
  }

  get canRecordExpense(): boolean {
    return this.canConfigure || !!this.selectedChurch?.roles.some((role) =>
      ['FINANCE_ADMIN', 'REQUESTER'].includes(role),
    ) || this.hasFinancePermission('finance.expense.create');
  }

  get canApprove(): boolean {
    return this.canConfigure || !!this.selectedChurch?.roles.some((role) =>
      ['FINANCE_ADMIN', 'APPROVER'].includes(role),
    ) || this.hasFinancePermission('finance.expense.approve');
  }

  get canSettle(): boolean {
    return this.canConfigure || !!this.selectedChurch?.roles.some((role) =>
      ['FINANCE_ADMIN', 'TREASURER'].includes(role),
    ) || this.hasFinancePermission('finance.payment.confirm');
  }

  get canManageBudget(): boolean {
    return this.canConfigure || this.hasFinancePermission('finance.budget.manage')
      || !!this.selectedChurch?.roles.some((role) => ['FINANCE_ADMIN', 'ACCOUNTANT', 'APPROVER'].includes(role));
  }

  private hasFinancePermission(code: string): boolean {
    return !!this.selectedChurch?.permission_codes.includes(code);
  }

  get incomeCategories(): FinanceCategory[] {
    return this.categories.filter((category) => category.kind === 'INCOME');
  }

  get expenseCategories(): FinanceCategory[] {
    return this.categories.filter((category) => category.kind === 'EXPENSE');
  }

  get availableFunds(): FinanceFund[] {
    return this.funds.filter((fund) => fund.is_active);
  }

  get activeAccounts(): FinanceAccount[] {
    return this.accounts.filter((account) => account.is_active);
  }

  get recentDonations(): FinanceTransaction[] {
    return this.transactions.filter((item) => item.kind === 'INCOME').slice(0, 6);
  }

  get pendingTransactions(): FinanceTransaction[] {
    return this.transactions.filter((item) =>
      ['TO_VERIFY', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID'].includes(item.status),
    );
  }

  get incomeAwaitingVerification(): FinanceTransaction[] {
    return this.transactions.filter((item) => item.kind === 'INCOME' && item.status === 'TO_VERIFY');
  }

  get expensesAwaitingApproval(): FinanceTransaction[] {
    return this.transactions.filter((item) => item.kind === 'EXPENSE' && item.status === 'PENDING_APPROVAL');
  }

  get approvedExpensesAwaitingPayment(): FinanceTransaction[] {
    return this.transactions.filter((item) =>
      item.kind === 'EXPENSE' &&
      ['APPROVED', 'PARTIALLY_PAID'].includes(item.status) &&
      Number(item.remaining_amount) > 0,
    );
  }

  get openPeriod(): FinancialPeriod | undefined {
    return this.periods.find((period) => period.status === 'OPEN');
  }

  get operationFormTitle(): string {
    switch (this.activeOperation) {
      case 'offrande': return 'Enregistrer une offrande';
      case 'dime': return 'Enregistrer une dîme';
      case 'don': return 'Enregistrer un don';
      case 'cotisation': return 'Enregistrer une cotisation';
      case 'expense': return 'Enregistrer une dépense / sortie de caisse';
      default: return this.modal === 'expense' ? 'Enregistrer une dépense' : 'Enregistrer une opération';
    }
  }

  get totalOffrandes(): number { return this.totalForOperation('offrande'); }
  get totalDimes(): number { return this.totalForOperation('dime'); }
  get totalDons(): number { return this.totalForOperation('don'); }
  get totalCotisations(): number { return this.totalForOperation('cotisation'); }
  get totalDepenses(): number { return this.totalForOperation('expense'); }

  totalForOperation(operation: FinanceOperation): number {
    return this.transactions
      .filter((item) => item.status !== 'CANCELLED' && item.status !== 'REJECTED')
      .filter((item) => this.operationForTransaction(item) === operation)
      .reduce((total, item) => total + Number(item.amount || 0) * Number(item.exchange_rate_to_base || 1), 0);
  }

  operationCount(operation: FinanceOperation): number {
    return this.transactions.filter((item) =>
      item.status !== 'CANCELLED'
      && item.status !== 'REJECTED'
      && this.operationForTransaction(item) === operation,
    ).length;
  }

  transactionOperationLabel(item: FinanceTransaction): string {
    return this.operationLabel(this.operationForTransaction(item));
  }

  operationLabel(operation: FinanceOperation | null | undefined): string {
    switch (operation) {
      case 'offrande': return 'Offrande';
      case 'dime': return 'Dîme';
      case 'don': return 'Don';
      case 'cotisation': return 'Cotisation';
      case 'expense': return 'Dépense / Sortie';
      default: return '—';
    }
  }

  paymentMethodLabel(method: string | null | undefined): string {
    return ({
      CASH: 'Espèces',
      BANK_TRANSFER: 'Virement',
      MOBILE_MONEY: 'Mobile Money',
      CHEQUE: 'Chèque',
      ONLINE: 'Paiement en ligne',
      CARD: 'Carte',
      OTHER: 'Autre',
    } as Record<string, string>)[method ?? 'CASH'] ?? '—';
  }

  setOperationTab(tab: FinanceOperationTab): void {
    this.activeOperationTab = tab;
    this.dashboardPageIndex = 0;
  }

  onDashboardSearch(): void {
    this.dashboardPageIndex = 0;
  }

  onChurchChange(): void {
    this.loadChurchData();
  }

  openConfiguration(): void {
    this.configurationForm = {
      level: this.configuration?.level ?? 1,
      base_currency: this.configuration?.base_currency ?? 'XOF',
      reason: '',
    };
    this.modal = 'configuration';
    this.clearFeedback();
  }

  openPeriodForm(): void {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    this.periodForm = {
      name: `Période ${today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      starts_on: this.formatDate(start),
      ends_on: this.formatDate(end),
    };
    this.modal = 'period';
    this.clearFeedback();
  }

  openTransactionForm(kind: 'INCOME' | 'EXPENSE'): void {
    this.openOperationForm(kind === 'INCOME' ? 'don' : 'expense');
  }

  openOperationForm(operation: FinanceOperation): void {
    if (!this.configuration || !this.openPeriod) {
      this.errorMessage = 'Une configuration et une période ouverte sont nécessaires pour enregistrer une opération.';
      return;
    }
    const category = this.categoryForOperation(operation);
    if (!category) {
      this.errorMessage = operation === 'cotisation'
        ? 'Aucune catégorie de cotisation ou de collecte spéciale n’est configurée pour cette église.'
        : 'Aucune catégorie active ne correspond à cette opération.';
      return;
    }
    this.activeOperation = operation;
    this.transactionForm = {
      category_id: category.id,
      fund_id: '',
      counterparty_name: '',
      is_anonymous: false,
      description: operation === 'cotisation' ? 'Cotisation (Moisson/Autre)' : '',
      amount: '',
      currency: this.configuration.base_currency,
      payment_method: 'CASH',
      exchange_rate_to_base: '1',
      transaction_date: this.formatDate(new Date()),
      reference: '',
    };
    this.modal = operation === 'expense' ? 'expense' : 'income';
    this.clearFeedback();
  }

  openPaymentForm(item: FinanceTransaction): void {
    this.selectedTransaction = item;
    this.paymentForm = {
      account_id: this.activeAccounts.find((account) => account.currency === item.currency)?.id ?? '',
      amount: item.remaining_amount,
      method: item.payment_method ?? 'CASH',
      reference: '',
    };
    this.modal = item.kind === 'INCOME' ? 'payment' : 'payment';
    this.clearFeedback();
  }

  openApproval(item: FinanceTransaction, decision: 'approve' | 'reject'): void {
    this.selectedTransaction = item;
    this.approvalDecision = decision;
    this.decisionReason = '';
    this.modal = 'approval';
    this.clearFeedback();
  }

  openPaymentDecision(payment: FinancePayment, confirmed: boolean): void {
    this.selectedPayment = payment;
    this.paymentDecisionConfirmed = confirmed;
    this.decisionReason = '';
    this.modal = 'pending-payment';
    this.clearFeedback();
  }

  openBudgetForm(): void {
    if (!this.configuration || !this.openPeriod) {
      this.errorMessage = 'Une configuration et une période ouverte sont nécessaires pour créer un budget.';
      return;
    }
    if (!this.expenseCategories.length) {
      this.errorMessage = 'Aucune catégorie de dépense active n’est disponible.';
      return;
    }
    this.budgetForm = {
      period_id: this.openPeriod.id,
      category_id: this.expenseCategories[0].id,
      name: '',
      allocated_amount: '',
      currency: this.configuration.base_currency,
      reason: '',
    };
    this.selectedBudget = null;
    this.modal = 'budget';
    this.clearFeedback();
  }

  openAccountForm(): void {
    this.accountForm = {
      name: '',
      kind: 'CASH',
      currency: this.configuration?.base_currency ?? 'XOF',
      opening_balance: '0',
    };
    this.modal = 'account';
    this.clearFeedback();
  }

  openFundForm(): void {
    this.fundForm = { name: '', purpose: '', is_restricted: false };
    this.modal = 'fund';
    this.clearFeedback();
  }

  openBudgetRevision(budget: FinancialBudget): void {
    this.selectedBudget = budget;
    this.budgetForm = {
      period_id: budget.period_id,
      category_id: budget.category_id,
      name: budget.name,
      allocated_amount: budget.allocated_amount,
      currency: budget.currency,
      reason: '',
    };
    this.modal = 'revision';
    this.clearFeedback();
  }

  closeModal(): void {
    if (!this.saving) this.modal = null;
  }

  saveConfiguration(): void {
    if (!this.selectedChurchId || !this.configurationForm.reason.trim()) return;
    this.saving = true;
    this.clearFeedback();
    const request = this.configuration
      ? this.financeService.updateConfiguration(this.selectedChurchId, this.configurationForm)
      : this.financeService.createConfiguration(this.selectedChurchId, this.configurationForm);
    request.subscribe({
      next: (configuration) => {
        this.configuration = configuration;
        this.saving = false;
        this.modal = null;
        this.successMessage = 'La configuration financière a été enregistrée.';
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible d’enregistrer la configuration financière.');
      },
    });
  }

  savePeriod(): void {
    if (!this.selectedChurchId) return;
    this.saving = true;
    this.clearFeedback();
    this.financeService.createPeriod({
      church_id: this.selectedChurchId,
      ...this.periodForm,
    }).subscribe({
      next: (period) => {
        this.periods = [period, ...this.periods];
        this.saving = false;
        this.modal = null;
        this.successMessage = 'La période financière a été créée.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de créer la période financière.');
      },
    });
  }

  saveTransaction(): void {
    const kind = this.modal === 'income' ? 'INCOME' : 'EXPENSE';
    if (!this.selectedChurchId || !this.openPeriod || !this.transactionForm.category_id) return;
    this.saving = true;
    this.clearFeedback();
    this.financeService.createTransaction(this.selectedChurchId, {
      kind,
      period_id: this.openPeriod.id,
      category_id: this.transactionForm.category_id,
      fund_id: this.transactionForm.fund_id || null,
      counterparty_name: this.transactionForm.is_anonymous ? '' : this.transactionForm.counterparty_name,
      is_anonymous: this.transactionForm.is_anonymous,
      description: this.transactionForm.description,
      amount: this.transactionForm.amount,
      currency: this.transactionForm.currency,
      payment_method: this.transactionForm.payment_method,
      exchange_rate_to_base: this.transactionForm.exchange_rate_to_base,
      transaction_date: this.transactionForm.transaction_date,
      reference: this.transactionForm.reference,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.modal = null;
        this.successMessage = kind === 'INCOME'
          ? 'L’opération est enregistrée et attend la confirmation du trésorier.'
          : 'La dépense est enregistrée et attend l’approbation.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible d’enregistrer cette opération.');
      },
    });
  }

  saveDonationConfirmation(): void {
    if (!this.selectedTransaction) return;
    this.saving = true;
    this.clearFeedback();
    this.financeService.decideTransaction(this.selectedTransaction.id, 'confirm', {
      account_id: this.paymentForm.account_id,
      amount: this.paymentForm.amount,
      method: this.paymentForm.method,
      reference: this.paymentForm.reference,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.modal = null;
        this.successMessage = 'L’encaissement a été confirmé et inscrit au compte.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de confirmer cet encaissement.');
      },
    });
  }

  saveExpenseDecision(): void {
    if (!this.selectedTransaction) return;
    this.saving = true;
    this.clearFeedback();
    this.financeService.decideTransaction(this.selectedTransaction.id, this.approvalDecision, {
      reason: this.decisionReason,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.modal = null;
        this.successMessage = this.approvalDecision === 'approve' ? 'La dépense a été approuvée.' : 'La dépense a été rejetée.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de traiter la décision.');
      },
    });
  }

  savePaymentInitiation(): void {
    if (!this.selectedTransaction) return;
    if (this.selectedTransaction.kind === 'INCOME') {
      this.saveDonationConfirmation();
      return;
    }
    this.saving = true;
    this.clearFeedback();
    this.financeService.initiatePayment(this.selectedTransaction.id, this.paymentForm).subscribe({
      next: () => {
        this.saving = false;
        this.modal = null;
        this.successMessage = 'Le paiement est initié et attend la confirmation de son exécution.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible d’initier le paiement.');
      },
    });
  }

  savePaymentDecision(): void {
    if (!this.selectedPayment) return;
    this.saving = true;
    this.clearFeedback();
    this.financeService.confirmPayment(
      this.selectedPayment.id,
      this.paymentDecisionConfirmed,
      this.decisionReason,
    ).subscribe({
      next: () => {
        this.saving = false;
        this.modal = null;
        this.successMessage = this.paymentDecisionConfirmed ? 'Le paiement est confirmé.' : 'Le paiement a été rejeté.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de traiter ce paiement.');
      },
    });
  }

  saveBudget(): void {
    this.saving = true;
    this.clearFeedback();
    const request = this.modal === 'revision' && this.selectedBudget
      ? this.financeService.reviseBudget(this.selectedBudget.id, this.budgetForm.allocated_amount, this.budgetForm.reason)
      : this.financeService.createBudget(this.selectedChurchId, this.budgetForm);
    request.subscribe({
      next: () => {
        this.saving = false;
        this.modal = null;
        this.successMessage = this.selectedBudget ? 'Le budget a été révisé et historisé.' : 'Le budget a été créé.';
        this.selectedBudget = null;
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible d’enregistrer le budget.');
      },
    });
  }

  saveAccount(): void {
    this.saving = true;
    this.clearFeedback();
    this.financeService.createAccount(this.selectedChurchId, this.accountForm).subscribe({
      next: () => {
        this.saving = false;
        this.modal = null;
        this.successMessage = 'Le compte financier a été créé.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de créer le compte.');
      },
    });
  }

  saveFund(): void {
    this.saving = true;
    this.clearFeedback();
    this.financeService.createFund(this.selectedChurchId, this.fundForm).subscribe({
      next: () => {
        this.saving = false;
        this.modal = null;
        this.successMessage = 'Le fonds a été créé.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de créer le fonds.');
      },
    });
  }

  togglePeriod(period: FinancialPeriod): void {
    this.selectedPeriod = period;
    this.periodAction = period.status === 'OPEN' ? 'close' : 'reopen';
    this.decisionReason = '';
    this.modal = 'period-action';
    this.clearFeedback();
  }

  savePeriodAction(): void {
    if (!this.selectedPeriod || (this.periodAction === 'reopen' && !this.decisionReason.trim())) return;
    this.saving = true;
    this.financeService.periodAction(this.selectedPeriod.id, this.periodAction, this.decisionReason).subscribe({
      next: (updated) => {
        this.periods = this.periods.map((item) => item.id === updated.id ? updated : item);
        this.modal = null;
        this.saving = false;
        this.successMessage = this.periodAction === 'close' ? 'La période a été clôturée.' : 'La période a été réouverte.';
        this.loadOperations();
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de modifier la période.');
      },
    });
  }

  categoryShare(categoryAmount: string): number {
    const total = Number(this.summary?.income_total ?? 0);
    return total > 0 ? Math.min(100, (Number(categoryAmount) / total) * 100) : 0;
  }

  budgetPercent(budget: FinancialBudget): number {
    const allocated = Number(budget.allocated_amount);
    return allocated > 0 ? Math.min(100, (Number(budget.committed_amount) / allocated) * 100) : 0;
  }

  chartBarHeight(value: string): number {
    return Math.max(4, this.categoryShare(value));
  }

  formatMoney(value: string | number | undefined, currency = this.summary?.currency ?? 'XOF'): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value ?? 0))} ${currency}`;
  }

  transactionStatusLabel(status: FinanceTransaction['status']): string {
    return ({
      TO_VERIFY: 'En attente de confirmation',
      PENDING_APPROVAL: 'En attente d’approbation',
      APPROVED: 'Approuvée',
      PARTIALLY_PAID: 'Partiellement payée',
      PAID: 'Confirmée',
      REJECTED: 'Rejetée',
      CANCELLED: 'Annulée',
    } as Record<FinanceTransaction['status'], string>)[status];
  }

  levelLabel(level: number): string {
    return ({
      1: 'Trésorerie simple',
      2: 'Gestion intermédiaire',
      3: 'Comptabilité avancée',
    } as Record<number, string>)[level] ?? 'Non configuré';
  }

  formatPeriod(period: FinancialPeriod): string {
    return `${this.formatDisplayDate(period.starts_on)} – ${this.formatDisplayDate(period.ends_on)}`;
  }

  /* ---- Dashboard dense table getters ---- */
  get dashboardFilteredTransactions(): FinanceTransaction[] {
    const query = this.normalize(this.dashboardSearch);
    const filtered = this.transactions.filter((item) => {
      if (this.activeOperationTab !== 'all' && this.operationForTransaction(item) !== this.activeOperationTab) return false;
      if (this.dashboardStartDate && item.transaction_date < this.dashboardStartDate) return false;
      if (this.dashboardEndDate && item.transaction_date > this.dashboardEndDate) return false;
      if (query) {
        const haystack = [
          item.member_name,
          item.counterparty_name,
          item.reference,
          item.category_name,
          item.description,
        ].filter(Boolean).map((value) => this.normalize(String(value))).join(' ');
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    const direction = this.dashboardSortDirection === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      if (this.dashboardSortField === 'amount') {
        return (Number(a.amount) - Number(b.amount)) * direction;
      }
      return this.dashboardSortValue(a).localeCompare(this.dashboardSortValue(b), 'fr', { sensitivity: 'base' }) * direction;
    });
  }
  get dashboardPagedTransactions(): FinanceTransaction[] {
    const start = this.dashboardPageIndex * this.dashboardPageSize;
    return this.dashboardFilteredTransactions.slice(start, start + this.dashboardPageSize);
  }
  get dashboardPageCount(): number { return Math.max(1, Math.ceil(this.dashboardFilteredTransactions.length / this.dashboardPageSize)); }
  get dashboardRangeStart(): number { return this.dashboardFilteredTransactions.length ? this.dashboardPageIndex * this.dashboardPageSize + 1 : 0; }
  get dashboardRangeEnd(): number { return Math.min((this.dashboardPageIndex + 1) * this.dashboardPageSize, this.dashboardFilteredTransactions.length); }
  get visibleDashboardPages(): number[] { return Array.from({ length: Math.min(this.dashboardPageCount, 5) }, (_, index) => index); }
  get allDashboardVisibleSelected(): boolean { return this.dashboardPagedTransactions.length > 0 && this.dashboardPagedTransactions.every((t) => this.selectedDashboardIds.has(t.id)); }
  private dashboardSortValue(t: FinanceTransaction): string {
    switch (this.dashboardSortField) {
      case 'client': return this.normalize(t.member_name ?? t.counterparty_name ?? '');
      case 'amount': return t.amount;
      case 'status': return this.normalize(this.transactionStatusLabel(t.status));
      default: return t.transaction_date;
    }
  }
  toggleDashboardSelection(id: string, event: Event): void {
    if ((event.target as HTMLInputElement).checked) this.selectedDashboardIds.add(id); else this.selectedDashboardIds.delete(id);
  }
  toggleVisibleDashboardSelection(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const ids = this.dashboardPagedTransactions.map((t) => t.id);
    this.selectedDashboardIds = new Set([...this.selectedDashboardIds].filter((id) => !ids.includes(id)));
    if (checked) ids.forEach((id) => this.selectedDashboardIds.add(id));
  }
  sortByDashboard(field: 'date' | 'client' | 'amount' | 'status'): void {
    if (this.dashboardSortField === field) this.dashboardSortDirection = this.dashboardSortDirection === 'asc' ? 'desc' : 'asc';
    else { this.dashboardSortField = field; this.dashboardSortDirection = 'asc'; }
    this.dashboardPageIndex = 0;
  }
  changeDashboardPage(delta: number): void { this.dashboardPageIndex = Math.max(0, Math.min(this.dashboardPageCount - 1, this.dashboardPageIndex + delta)); }
  goToDashboardPage(page: number): void { this.dashboardPageIndex = Math.max(0, Math.min(this.dashboardPageCount - 1, page)); }
  toggleDashboardMenu(id: string, event: Event): void {
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
  closeDashboardMenuOnScroll(): void { this.openMenuId = null; }
  @HostListener('window:resize')
  closeDashboardMenuOnResize(): void { this.openMenuId = null; }
  @HostListener('document:click', ['$event'])
  closeDashboardMenuOnDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.context-wrap')) this.openMenuId = null;
  }

  trackByDashboardId(_index: number, t: FinanceTransaction): string { return t.id; }
  selectTransaction(t: FinanceTransaction): void { this.selectedTransaction = t; }

  applyDashboardFilter(): void {
    this.dashboardPageIndex = 0;
    this.successMessage = this.dashboardStartDate || this.dashboardEndDate
      ? 'Filtre de période appliqué.'
      : 'Filtre de période réinitialisé.';
  }

  openHistory(): void {
    this.router.navigate(['/finance/reports']);
  }

  canValidateTransaction(t: FinanceTransaction): boolean {
    if (t.kind === 'INCOME') return t.status === 'TO_VERIFY' && this.canSettle;
    return t.status === 'PENDING_APPROVAL' && this.canApprove;
  }

  validateTransaction(t: FinanceTransaction): void {
    this.openMenuId = null;
    if (t.kind === 'INCOME') {
      this.openPaymentForm(t);
      return;
    }
    this.openApproval(t, 'approve');
  }

  viewTransactionDetail(t: FinanceTransaction): void {
    this.openMenuId = null;
    this.selectedTransaction = t;
    this.modal = 'approval';
  }

  editTransaction(t: FinanceTransaction): void {
    this.openMenuId = null;
    this.selectedTransaction = t;
    this.activeOperation = this.operationForTransaction(t) ?? (t.kind === 'EXPENSE' ? 'expense' : 'don');
    this.transactionForm = {
      category_id: t.category_id,
      fund_id: t.fund_id ?? '',
      counterparty_name: t.counterparty_name,
      is_anonymous: t.is_anonymous,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      payment_method: t.payment_method ?? 'CASH',
      exchange_rate_to_base: t.exchange_rate_to_base,
      transaction_date: t.transaction_date,
      reference: t.reference,
    };
    this.modal = t.kind === 'INCOME' ? 'income' : 'expense';
  }

  deleteTransaction(t: FinanceTransaction): void {
    this.openMenuId = null;
    if (!confirm(`Supprimer la transaction « ${t.reference || t.id} » ?`)) return;
    this.successMessage = 'Transaction supprimée.';
  }

  private categoryForOperation(operation: FinanceOperation): FinanceCategory | undefined {
    if (operation === 'expense') return this.expenseCategories[0];
    return this.incomeCategories.find((category) => this.categoryOperation(category) === operation);
  }

  private categoryOperation(category: FinanceCategory | undefined): FinanceOperation | null {
    if (!category) return null;
    if (category.kind === 'EXPENSE') return 'expense';
    const code = this.normalize(category.code);
    if (code.includes('offrande')) return 'offrande';
    if (code.includes('dime')) return 'dime';
    if (code === 'don' || code.startsWith('don-')) return 'don';
    if (code.includes('collecte') || code.includes('cotisation') || code.includes('moisson')) return 'cotisation';
    return this.operationFromName(category.name);
  }

  private operationFromName(name: string): FinanceOperation | null {
    const value = this.normalize(name);
    if (!value) return null;
    if (value.includes('offrande')) return 'offrande';
    if (value.includes('dime')) return 'dime';
    if (value === 'don' || value === 'dons' || value.startsWith('don ') || value.startsWith('dons ')) return 'don';
    if (value.includes('cotisation') || value.includes('collecte') || value.includes('moisson')) return 'cotisation';
    return null;
  }

  private operationForTransaction(item: FinanceTransaction): FinanceOperation | null {
    if (item.kind === 'EXPENSE') return 'expense';
    const category = this.categories.find((entry) => entry.id === item.category_id);
    return this.categoryOperation(category) ?? this.operationFromName(item.category_name);
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private loadContext(): void {
    this.financeService.getContext().subscribe({
      next: (context) => {
        this.context = context;
        this.selectedChurchId = context.churches[0]?.church_id ?? '';
        if (!this.selectedChurchId) {
          this.errorMessage = 'Aucune église ou permission financière ne vous est accessible.';
          this.loading = false;
          return;
        }
        this.loadChurchData();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger votre espace financier.');
      },
    });
  }

  private loadChurchData(): void {
    if (!this.selectedChurchId) return;
    const requestId = ++this.churchRequestId;
    this.loading = true;
    this.configuration = null;
    this.periods = [];
    this.clearFeedback();
    let configurationLoaded = false;
    let periodsLoaded = false;
    const finishLoading = (): void => {
      if (requestId === this.churchRequestId && configurationLoaded && periodsLoaded) this.loading = false;
    };
    this.financeService.getConfiguration(this.selectedChurchId).subscribe({
      next: (configuration) => {
        if (requestId !== this.churchRequestId) return;
        this.configuration = configuration;
        configurationLoaded = true;
        finishLoading();
      },
      error: (error: HttpErrorResponse) => {
        if (requestId !== this.churchRequestId) return;
        configurationLoaded = true;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger la configuration de cette église.');
        finishLoading();
      },
    });
    this.financeService.listPeriods(this.selectedChurchId).subscribe({
      next: (periods) => {
        if (requestId !== this.churchRequestId) return;
        this.periods = periods;
        periodsLoaded = true;
        finishLoading();
      },
      error: (error: HttpErrorResponse) => {
        if (requestId !== this.churchRequestId) return;
        this.periods = [];
        periodsLoaded = true;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger les périodes financières.');
        finishLoading();
      },
    });
    this.loadOperations();
  }

  private loadOperations(): void {
    if (!this.selectedChurchId) return;
    const churchId = this.selectedChurchId;
    forkJoin({
      summary: this.financeService.getSummary(churchId),
      categories: this.financeService.listCategories(churchId),
      funds: this.financeService.listFunds(churchId),
      accounts: this.financeService.listAccounts(churchId),
      transactions: this.financeService.listTransactions(churchId),
      payments: this.financeService.listPayments(churchId),
      budgets: this.financeService.listBudgets(churchId),
    }).subscribe({
      next: (data) => {
        if (churchId !== this.selectedChurchId) return;
        this.summary = data.summary;
        this.categories = data.categories;
        this.funds = data.funds;
        this.accounts = data.accounts;
        this.transactions = data.transactions;
        this.pendingPayments = data.payments;
        this.budgets = data.budgets;
      },
      error: (error: HttpErrorResponse) => {
        if (churchId !== this.selectedChurchId) return;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger les opérations financières.');
      },
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDisplayDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private clearFeedback(): void {
    this.errorMessage = '';
    this.successMessage = '';
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
