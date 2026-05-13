import { describe, expect, it } from 'vitest';
import {
  calculateAccountBalance,
  generateRecurringOccurrences,
  transactionDeltaForAccount
} from './cashflow';
import type { AccountRecord, RecurringRuleRecord, TransactionRecord } from '@/types/ledger';

const baseRule: RecurringRuleRecord = {
  id: 'rule-1',
  name: '工资',
  kind: 'income',
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-05-08',
  dayOfMonth: 25,
  amount: 25000,
  currency: 'CNY',
  accountId: 'bank',
  category: '工资',
  active: true,
  createdAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z'
};

const bankAccount: AccountRecord = {
  id: 'bank',
  name: '招商银行卡',
  type: 'bank',
  side: 'asset',
  currency: 'CNY',
  openingBalance: 10000,
  createdAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z'
};

const loanAccount: AccountRecord = {
  id: 'loan',
  name: '车贷',
  type: 'loan',
  side: 'liability',
  currency: 'CNY',
  openingBalance: 50000,
  createdAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z'
};

function transaction(partial: Partial<TransactionRecord>): TransactionRecord {
  return {
    id: partial.id ?? 'tx',
    date: partial.date ?? '2026-05-08',
    type: partial.type ?? 'expense',
    amount: partial.amount ?? 0,
    currency: partial.currency ?? 'CNY',
    accountId: partial.accountId,
    counterAccountId: partial.counterAccountId,
    category: partial.category ?? '日常',
    description: partial.description,
    status: partial.status ?? 'confirmed',
    source: partial.source ?? 'manual',
    sourceId: partial.sourceId,
    relatedAssetId: partial.relatedAssetId,
    relatedLiabilityId: partial.relatedLiabilityId,
    principalAmount: partial.principalAmount,
    interestAmount: partial.interestAmount,
    feeAmount: partial.feeAmount,
    createdAt: partial.createdAt ?? '2026-05-08T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-05-08T00:00:00.000Z'
  };
}

describe('generateRecurringOccurrences', () => {
  it('uses dayOfMonth as the first monthly occurrence after startDate', () => {
    const occurrences = generateRecurringOccurrences(baseRule, '2026-05-01', '2026-06-30');
    expect(occurrences.map((occurrence) => occurrence.date)).toEqual(['2026-05-25', '2026-06-25']);
  });

  it('keeps month-end anchor when the target month has fewer days', () => {
    const rule: RecurringRuleRecord = {
      ...baseRule,
      id: 'rule-2',
      startDate: '2024-01-31',
      dayOfMonth: 31,
      amount: 3000
    };
    const occurrences = generateRecurringOccurrences(rule, '2024-01-01', '2024-03-31');
    expect(occurrences.map((occurrence) => occurrence.date)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
  });

  it('skips occurrences that are already confirmed by the rule', () => {
    const rule: RecurringRuleRecord = { ...baseRule, lastConfirmedDate: '2026-05-25' };
    const occurrences = generateRecurringOccurrences(rule, '2026-05-01', '2026-06-30');
    expect(occurrences.map((occurrence) => occurrence.date)).toEqual(['2026-06-25']);
  });
});

describe('account balance effects', () => {
  it('ignores pending transactions', () => {
    const pendingExpense = transaction({ amount: 99, status: 'pending', accountId: 'bank' });
    expect(transactionDeltaForAccount(pendingExpense, bankAccount)).toBe(0);
  });

  it('calculates asset cashflow and liability principal reduction', () => {
    const transactions = [
      transaction({ id: 'income', type: 'income', amount: 2000, accountId: 'bank', category: '工资' }),
      transaction({
        id: 'loan-payment',
        type: 'loan_payment',
        amount: 3000,
        accountId: 'bank',
        counterAccountId: 'loan',
        category: '车贷',
        principalAmount: 2500,
        interestAmount: 500
      })
    ];

    expect(calculateAccountBalance(bankAccount, transactions)).toBe(9000);
    expect(calculateAccountBalance(loanAccount, transactions)).toBe(47500);
  });
});
