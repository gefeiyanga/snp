import type {
  AccountRecord,
  RecurringOccurrence,
  RecurringRuleRecord,
  TransactionRecord
} from '@/types/ledger';
import { compareYmd, roundMoney2 } from '@/domain/loanSchedule';

export type NewTransactionFromOccurrence = Omit<TransactionRecord, 'id' | 'createdAt' | 'updatedAt'>;

export interface AccountBalanceSnapshot {
  accountId: string;
  balance: number;
  currency: AccountRecord['currency'];
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastDayOfMonth(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0 + 1, 0);
}

function clampDayInMonth(year: number, monthIndex0: number, targetDay: number): Date {
  const last = lastDayOfMonth(year, monthIndex0);
  const day = Math.min(targetDay, last.getDate());
  return new Date(year, monthIndex0, day);
}

function addDays(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return formatYmd(d);
}

function addMonths(ymd: string, months: number, anchorDay: number): string {
  const current = parseYmd(ymd);
  const monthIndex = current.getMonth() + months;
  const y = current.getFullYear() + Math.floor(monthIndex / 12);
  const m = ((monthIndex % 12) + 12) % 12;
  return formatYmd(clampDayInMonth(y, m, anchorDay));
}

function addYears(ymd: string, years: number, anchorDay: number): string {
  const current = parseYmd(ymd);
  return formatYmd(clampDayInMonth(current.getFullYear() + years, current.getMonth(), anchorDay));
}

function normalizedInterval(rule: RecurringRuleRecord): number {
  return Math.max(1, Math.floor(Number(rule.interval || 1)));
}

function recurrenceAnchorDay(rule: RecurringRuleRecord): number {
  return rule.dayOfMonth ?? parseYmd(rule.startDate).getDate();
}

function nextOccurrenceDate(rule: RecurringRuleRecord, date: string): string {
  const interval = normalizedInterval(rule);
  const anchorDay = recurrenceAnchorDay(rule);
  if (rule.frequency === 'daily') return addDays(date, interval);
  if (rule.frequency === 'weekly') return addDays(date, interval * 7);
  if (rule.frequency === 'yearly') return addYears(date, interval, anchorDay);
  return addMonths(date, interval, anchorDay);
}

function firstOccurrenceDate(rule: RecurringRuleRecord): string {
  if (rule.frequency !== 'monthly' || rule.dayOfMonth === undefined) {
    return rule.startDate;
  }

  const start = parseYmd(rule.startDate);
  const candidate = formatYmd(clampDayInMonth(start.getFullYear(), start.getMonth(), rule.dayOfMonth));
  if (compareYmd(candidate, rule.startDate) >= 0) return candidate;
  return nextOccurrenceDate(rule, candidate);
}

function toOccurrence(rule: RecurringRuleRecord, date: string): RecurringOccurrence {
  return {
    id: `${rule.id}:${date}`,
    ruleId: rule.id,
    date,
    name: rule.name,
    kind: rule.kind,
    amount: rule.amount,
    currency: rule.currency,
    accountId: rule.accountId,
    counterAccountId: rule.counterAccountId,
    category: rule.category,
    description: rule.description,
    relatedLiabilityId: rule.relatedLiabilityId
  };
}

export function generateRecurringOccurrences(
  rule: RecurringRuleRecord,
  fromYmd: string,
  toYmd: string
): RecurringOccurrence[] {
  if (!rule.active || compareYmd(toYmd, rule.startDate) < 0 || compareYmd(toYmd, fromYmd) < 0) {
    return [];
  }

  const occurrences: RecurringOccurrence[] = [];
  let date = firstOccurrenceDate(rule);
  while (compareYmd(date, fromYmd) < 0) {
    date = nextOccurrenceDate(rule, date);
  }

  while (compareYmd(date, toYmd) <= 0) {
    if (rule.endDate && compareYmd(date, rule.endDate) > 0) break;
    if (!rule.lastConfirmedDate || compareYmd(date, rule.lastConfirmedDate) > 0) {
      occurrences.push(toOccurrence(rule, date));
    }
    date = nextOccurrenceDate(rule, date);
  }

  return occurrences;
}

export function transactionFromRecurringOccurrence(
  occurrence: RecurringOccurrence,
  status: TransactionRecord['status'] = 'pending'
): NewTransactionFromOccurrence {
  return {
    date: occurrence.date,
    type: occurrence.kind,
    amount: occurrence.amount,
    currency: occurrence.currency,
    accountId: occurrence.accountId,
    counterAccountId: occurrence.counterAccountId,
    category: occurrence.category,
    description: occurrence.description,
    status,
    source: 'recurring_rule',
    sourceId: occurrence.id,
    relatedLiabilityId: occurrence.relatedLiabilityId
  };
}

export function transactionDeltaForAccount(transaction: TransactionRecord, account: AccountRecord): number {
  if (transaction.status !== 'confirmed') return 0;

  const amount = Number(transaction.amount || 0);
  const principalAmount = Number(transaction.principalAmount ?? amount);

  if (transaction.accountId === account.id) {
    if (transaction.type === 'income') return account.side === 'asset' ? amount : -amount;
    if (transaction.type === 'expense') return account.side === 'liability' ? amount : -amount;
    if (transaction.type === 'transfer') return account.side === 'liability' ? amount : -amount;
    if (transaction.type === 'loan_payment') return account.side === 'liability' ? amount : -amount;
    if (transaction.type === 'investment_buy') return -amount;
    if (transaction.type === 'investment_sell') return amount;
    return amount;
  }

  if (transaction.counterAccountId === account.id) {
    if (transaction.type === 'transfer') return account.side === 'liability' ? -amount : amount;
    if (transaction.type === 'loan_payment') return account.side === 'liability' ? -principalAmount : amount;
    if (transaction.type === 'investment_buy') return amount;
    if (transaction.type === 'investment_sell') return -amount;
  }

  return 0;
}

export function calculateAccountBalance(account: AccountRecord, transactions: TransactionRecord[]): number {
  const delta = transactions.reduce((sum, transaction) => sum + transactionDeltaForAccount(transaction, account), 0);
  return roundMoney2(account.openingBalance + delta);
}

export function calculateAccountBalances(
  accounts: AccountRecord[],
  transactions: TransactionRecord[]
): AccountBalanceSnapshot[] {
  return accounts.map((account) => ({
    accountId: account.id,
    balance: calculateAccountBalance(account, transactions),
    currency: account.currency
  }));
}
