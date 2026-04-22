import { describe, expect, it } from 'vitest';
import {
  firstInstallmentEqualPayment,
  isLegacyAmortizationRow,
  nthDueDate,
  paidPeriods,
  remainingAfterEqualPayment,
  remainingAfterEqualPrincipal
} from './loanSchedule';

describe('nthDueDate', () => {
  it('rolls month with clamp to month end', () => {
    expect(nthDueDate('2020-01-31', 1)).toBe('2020-01-31');
    expect(nthDueDate('2020-01-31', 2)).toBe('2020-02-29');
  });
  it('stable on 15th anchor', () => {
    expect(nthDueDate('2024-06-15', 2)).toBe('2024-07-15');
  });
});

describe('paidPeriods', () => {
  it('counts periods whose due <= asOf', () => {
    expect(paidPeriods('2024-01-10', 12, '2024-01-09')).toBe(0);
    expect(paidPeriods('2024-01-10', 12, '2024-01-10')).toBe(1);
    expect(paidPeriods('2024-01-10', 12, '2024-03-09')).toBe(2);
    expect(paidPeriods('2024-01-10', 12, '2024-03-10')).toBe(3);
  });
});

describe('equal payment r=0', () => {
  it('linear principal', () => {
    expect(remainingAfterEqualPayment(1000, 0, 10, 3)).toBe(700);
    expect(firstInstallmentEqualPayment(1000, 0, 10)).toBe(100);
  });
});

describe('legacy', () => {
  it('车贷缺 term 为 legacy', () => {
    expect(
      isLegacyAmortizationRow({
        category: '车贷',
        termMonths: undefined,
        repaymentMethod: 'equal_payment',
        firstPaymentDate: '2024-01-01'
      })
    ).toBe(true);
  });
  it('信用卡不 legacy', () => {
    expect(isLegacyAmortizationRow({ category: '信用卡' })).toBe(false);
  });
});

describe('equal principal balance', () => {
  it('decreases by P/n each period', () => {
    expect(remainingAfterEqualPrincipal(120000, 6, 24, 6)).toBeCloseTo(90000, 5);
  });
});
