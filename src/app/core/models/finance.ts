export interface FinanceChurch {
  church_id: string;
  name: string;
  roles: string[];
  permission_codes: string[];
}

export interface FinanceContext {
  organization_id: string;
  organization_name: string;
  is_organization_admin: boolean;
  churches: FinanceChurch[];
}

export interface FinancialConfiguration {
  id: string;
  church_id: string;
  church_name: string;
  level: number;
  base_currency: string;
  version: number;
  is_suspended: boolean;
  suspension_reason: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialPeriod {
  id: string;
  church_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
}

export interface FinanceConfigurationPayload {
  level: number;
  base_currency: string;
  reason: string;
}

export interface FinancialPeriodPayload {
  church_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

export interface FinanceCategory {
  id: string;
  name: string;
  code: string;
  kind: 'INCOME' | 'EXPENSE';
  requires_approval: boolean;
  is_active: boolean;
  is_system: boolean;
}

export interface FinanceFund {
  id: string;
  name: string;
  purpose: string;
  is_restricted: boolean;
  is_active: boolean;
  created_at: string;
}

export interface FinanceAccount {
  id: string;
  church_id: string;
  campus: string | null;
  name: string;
  kind: 'CASH' | 'BANK' | 'MOBILE_MONEY' | 'OTHER';
  currency: string;
  opening_balance: string;
  balance: string;
  is_active: boolean;
  created_at: string;
}

export interface FinanceTransaction {
  id: string;
  kind: 'INCOME' | 'EXPENSE';
  status: 'TO_VERIFY' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIALLY_PAID' | 'PAID' | 'REJECTED' | 'CANCELLED';
  period_id: string;
  category_id: string;
  category_name: string;
  fund_id: string | null;
  fund_name: string | null;
  campus_id: string | null;
  campus_name: string | null;
  member_id: string | null;
  member_name: string | null;
  counterparty_name: string;
  is_anonymous: boolean;
  description: string;
  amount: string;
  paid_amount: string;
  remaining_amount: string;
  currency: string;
  exchange_rate_to_base: string;
  transaction_date: string;
  reference: string;
  created_by: number | string;
  approved_by: number | string | null;
  approved_at: string | null;
  decision_reason: string;
  created_at: string;
  updated_at: string;
}

export interface FinancePayment {
  id: string;
  transaction_id: string;
  transaction_kind: 'INCOME' | 'EXPENSE';
  transaction_description: string;
  account: string;
  account_name: string;
  amount: string;
  currency: string;
  method: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';
  reference: string;
  created_by: number | string;
  confirmed_by: number | string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface FinancialBudget {
  id: string;
  period_id: string;
  category_id: string;
  category_name: string;
  campus_id: string | null;
  campus_name: string | null;
  name: string;
  allocated_amount: string;
  currency: string;
  committed_amount: string;
  paid_amount: string;
  available_amount: string;
  created_at: string;
}

export interface FinanceSummary {
  church_id: string;
  currency: string;
  income_total: string;
  expense_total: string;
  available_balance: string;
  pending_transactions: number;
  monthly: Array<{ month: string; income: string; expenses: string }>;
  income_by_category: Array<{ category_id: string; category_name: string; amount: string }>;
  accounts: Array<Pick<FinanceAccount, 'id' | 'name' | 'kind' | 'currency' | 'balance'>>;
  recent_transactions: FinanceTransaction[];
}

export interface FinanceReport {
  church_id: string;
  church_name: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  generated_at: string;
  income_total: string;
  expense_total: string;
  net_total: string;
  income_by_category: Array<{ category_id: string; category_name: string; amount: string }>;
  expenses_by_category: Array<{ category_id: string; category_name: string; amount: string }>;
  accounts: Array<{
    id: string;
    name: string;
    kind: FinanceAccount['kind'];
    currency: string;
    opening_balance: string;
    current_balance: string;
  }>;
  budgets: Array<{
    id: string;
    name: string;
    period_name: string;
    category_name: string;
    campus_name: string | null;
    currency: string;
    allocated_amount: string;
    committed_amount: string;
    paid_amount: string;
    available_amount: string;
  }>;
}

export interface FinanceCashJournal {
  church_id: string;
  church_name: string;
  start_date: string | null;
  end_date: string | null;
  opening_balances: Array<{
    account_id: string;
    account_name: string;
    currency: string;
    balance: string;
  }>;
  total_in: Array<{ currency: string; amount: string }>;
  total_out: Array<{ currency: string; amount: string }>;
  closing_totals: Array<{
    account_id: string;
    account_name: string;
    currency: string;
    balance: string;
  }>;
  count: number;
  results: Array<{
    id: string;
    created_at: string;
    transaction_date: string;
    account_id: string;
    account_name: string;
    currency: string;
    direction: 'IN' | 'OUT';
    amount: string;
    balance_after: string;
    transaction_id: string;
    transaction_kind: FinanceTransaction['kind'];
    category_name: string;
    description: string;
    counterparty_name: string | null;
    transaction_reference: string;
    payment_reference: string;
    payment_method: string;
  }>;
}

export interface FinanceTransactionPayload {
  kind: 'INCOME' | 'EXPENSE';
  period_id: string;
  category_id: string;
  fund_id: string | null;
  counterparty_name: string;
  is_anonymous: boolean;
  description: string;
  amount: string;
  currency: string;
  exchange_rate_to_base: string;
  transaction_date: string;
  reference: string;
}
