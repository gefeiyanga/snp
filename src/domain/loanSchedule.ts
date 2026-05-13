import type { LiabilityRecord, RepaymentMethod } from '@/types/ledger';

/** 房贷 / 车贷启用摊销引擎 */
export const AMORTIZING_LIABILITY_CATEGORIES = ['房贷', '车贷'] as const;

export function isAmortizingCategory(category: string): boolean {
  return (AMORTIZING_LIABILITY_CATEGORIES as readonly string[]).includes(category);
}

/** 缺任一项则视为 legacy，不自动摊销 */
export function isLegacyAmortizationRow(row: {
  category: string;
  termMonths?: number;
  repaymentMethod?: RepaymentMethod;
  firstPaymentDate?: string;
  dueDate?: string;
}): boolean {
  if (!isAmortizingCategory(row.category)) return false;
  const first = row.firstPaymentDate ?? row.dueDate;
  if (!first || !row.termMonths || row.termMonths < 1 || !row.repaymentMethod) return true;
  return false;
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

/** 第 period 期（1-based）应还日 */
export function nthDueDate(firstPaymentYmd: string, period: number): string {
  if (period < 1) throw new Error('period must be >= 1');
  const first = parseYmd(firstPaymentYmd);
  const targetDay = first.getDate();
  const y0 = first.getFullYear();
  const m0 = first.getMonth();
  const totalShift = period - 1;
  const y = y0 + Math.floor((m0 + totalShift) / 12);
  const m = ((m0 + totalShift) % 12 + 12) % 12;
  return formatYmd(clampDayInMonth(y, m, targetDay));
}

export function compareYmd(a: string, b: string): number {
  return a.localeCompare(b);
}

export function paidPeriods(firstPaymentYmd: string, termMonths: number, asOfYmd: string): number {
  let k = 0;
  for (let p = 1; p <= termMonths; p++) {
    if (compareYmd(nthDueDate(firstPaymentYmd, p), asOfYmd) <= 0) k = p;
    else break;
  }
  return k;
}

function monthlyRateFromAnnualPercent(annualPercent: number): number {
  return annualPercent / 100 / 12;
}

/** 等额本息：还完 k 期后的剩余本金 */
export function remainingAfterEqualPayment(
  principal: number,
  annualPercent: number,
  termMonths: number,
  paid: number
): number {
  const n = termMonths;
  const k = Math.min(Math.max(paid, 0), n);
  const P = principal;
  if (k >= n) return 0;
  const r = monthlyRateFromAnnualPercent(annualPercent);
  if (r === 0) return P - (P / n) * k;
  const pow = (b: number, e: number) => Math.pow(b, e);
  return (P * (pow(1 + r, n) - pow(1 + r, k))) / (pow(1 + r, n) - 1);
}

/** 等额本金：还完 k 期后的剩余本金 */
export function remainingAfterEqualPrincipal(
  principal: number,
  _annualPercent: number,
  termMonths: number,
  paid: number
): number {
  const n = termMonths;
  const k = Math.min(Math.max(paid, 0), n);
  if (k >= n) return 0;
  return principal - (principal / n) * k;
}

export function firstInstallmentEqualPayment(principal: number, annualPercent: number, termMonths: number): number {
  const P = principal;
  const n = termMonths;
  const r = monthlyRateFromAnnualPercent(annualPercent);
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function firstInstallmentEqualPrincipal(principal: number, annualPercent: number, termMonths: number): number {
  return installmentEqualPrincipal(principal, annualPercent, termMonths, 1);
}

/** 等额本金：第 period 期（1-based）当期应还（固定本金 + 期初余额利息） */
export function installmentEqualPrincipal(
  principal: number,
  annualPercent: number,
  termMonths: number,
  period1Based: number
): number {
  const n = termMonths;
  const p = Math.min(Math.max(period1Based, 1), n);
  const r = monthlyRateFromAnnualPercent(annualPercent);
  const principalPart = principal / n;
  const balanceBefore = principal - (p - 1) * principalPart;
  return principalPart + balanceBefore * r;
}

/** 截至 asOf 已还 k 期后，下一期应还月供（等额本息各期相同；等额本金随期变化） */
export function scheduledMonthlyPayment(
  principal: number,
  annualPercent: number,
  termMonths: number,
  method: RepaymentMethod,
  firstPaymentYmd: string,
  asOfYmd: string
): number {
  const k = paidPeriods(firstPaymentYmd, termMonths, asOfYmd);
  if (k >= termMonths) return 0;
  const nextPeriod = k + 1;
  if (method === 'equal_payment') {
    return firstInstallmentEqualPayment(principal, annualPercent, termMonths);
  }
  return installmentEqualPrincipal(principal, annualPercent, termMonths, nextPeriod);
}

export interface LoanInstallment {
  period: number;
  dueDate: string;
  totalPayment: number;
  principalPayment: number;
  interestPayment: number;
  remainingAfterPayment: number;
}

/** 生成单期计划，用于把房贷/车贷待办拆成「本金减少 + 利息支出」。 */
export function scheduledLoanInstallment(
  principal: number,
  annualPercent: number,
  termMonths: number,
  method: RepaymentMethod,
  firstPaymentYmd: string,
  period1Based: number
): LoanInstallment {
  const period = Math.min(Math.max(period1Based, 1), termMonths);
  const balanceBefore =
    method === 'equal_payment'
      ? remainingAfterEqualPayment(principal, annualPercent, termMonths, period - 1)
      : remainingAfterEqualPrincipal(principal, annualPercent, termMonths, period - 1);
  const monthlyRate = monthlyRateFromAnnualPercent(annualPercent);
  const interestPayment = balanceBefore * monthlyRate;
  const remainingAfterPayment =
    method === 'equal_payment'
      ? remainingAfterEqualPayment(principal, annualPercent, termMonths, period)
      : remainingAfterEqualPrincipal(principal, annualPercent, termMonths, period);
  const principalPayment = Math.max(balanceBefore - remainingAfterPayment, 0);

  return {
    period,
    dueDate: nthDueDate(firstPaymentYmd, period),
    totalPayment: roundMoney2(principalPayment + interestPayment),
    principalPayment: roundMoney2(principalPayment),
    interestPayment: roundMoney2(interestPayment),
    remainingAfterPayment: roundMoney2(remainingAfterPayment)
  };
}

export function roundMoney2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** 年利率（%）解析；空串 null；不合规 null；最多三位小数 */
export function parseInterestRatePercent(raw: string): number | null {
  const t = String(raw ?? '')
    .trim()
    .replace(/,/g, '');
  if (t === '') return null;
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 1000) / 1000;
}

export function todayYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 为展示列表计算摊销后的 remaining / monthlyPayment；legacy 原样返回 */
export function hydrateLiability(row: LiabilityRecord): LiabilityRecord {
  if (!isAmortizingCategory(row.category) || isLegacyAmortizationRow(row)) {
    return row;
  }
  const first = row.firstPaymentDate ?? row.dueDate;
  const term = row.termMonths;
  const method = row.repaymentMethod;
  if (!first || !term || !method) return row;
  const k = paidPeriods(first, term, todayYmd());
  const P = row.amount;
  const rate = row.interestRate;
  let remaining = 0;
  if (method === 'equal_payment') {
    remaining = roundMoney2(remainingAfterEqualPayment(P, rate, term, k));
  } else {
    remaining = roundMoney2(remainingAfterEqualPrincipal(P, rate, term, k));
  }
  const mp = roundMoney2(scheduledMonthlyPayment(P, rate, term, method, first, todayYmd()));
  return {
    ...row,
    remaining,
    monthlyPayment: mp,
    dueDate: first,
    firstPaymentDate: first,
    legacyManual: false
  };
}

/** 读库后为房贷/车贷打上 legacyManual 标记（仅缺字段时 true） */
export function migrateLegacyFlags(row: LiabilityRecord): LiabilityRecord {
  if (!isAmortizingCategory(row.category)) return row;
  if (isLegacyAmortizationRow(row)) {
    return { ...row, legacyManual: true };
  }
  return { ...row, legacyManual: false };
}
