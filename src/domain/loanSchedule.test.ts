import { describe, expect, it } from 'vitest';
import {
  firstInstallmentEqualPayment,
  isLegacyAmortizationRow,
  nthDueDate,
  paidPeriods,
  parseInterestRatePercent,
  remainingAfterEqualPayment,
  remainingAfterEqualPrincipal,
  scheduledMonthlyPayment
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

describe('scheduledMonthlyPayment', () => {
  it('等额本金：已还一期后下期月供低于首期', () => {
    const P = 120000;
    const n = 24;
    const rate = 6;
    const first = '2020-01-15';
    const beforeFirst = scheduledMonthlyPayment(P, rate, n, 'equal_principal', first, '2020-01-14');
    const afterFirst = scheduledMonthlyPayment(P, rate, n, 'equal_principal', first, '2020-01-20');
    expect(afterFirst).toBeLessThan(beforeFirst);
  });
  it('等额本息：不同 asOf 下期月供相同', () => {
    const P = 100000;
    const n = 12;
    const rate = 12;
    const first = '2024-01-01';
    const a = scheduledMonthlyPayment(P, rate, n, 'equal_payment', first, '2024-01-01');
    const b = scheduledMonthlyPayment(P, rate, n, 'equal_payment', first, '2024-06-15');
    expect(a).toBeCloseTo(b, 5);
  });
});

describe('parseInterestRatePercent', () => {
  it('allows up to three decimal places', () => {
    expect(parseInterestRatePercent('')).toBeNull();
    expect(parseInterestRatePercent('4')).toBe(4);
    expect(parseInterestRatePercent('4.5')).toBe(4.5);
    expect(parseInterestRatePercent(' 3.6 ')).toBe(3.6);
    expect(parseInterestRatePercent('4.55')).toBe(4.55);
    expect(parseInterestRatePercent('3.125')).toBe(3.125);
  });
  it('rejects more than three fractional digits', () => {
    expect(parseInterestRatePercent('4.5555')).toBeNull();
    expect(parseInterestRatePercent('x')).toBeNull();
  });
});
