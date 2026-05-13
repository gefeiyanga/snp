import { describe, expect, it } from 'vitest';
import { formatAmount, formatPrice, formatPriceDecimal, formatSignedAmountWithRate } from './amountDisplay';

describe('amount display', () => {
  it('formats CNY values with two decimals and no compact Chinese shorthand', () => {
    expect(formatAmount(0)).toBe('¥0.00');
    expect(formatAmount(6921.92)).toBe('¥6,921.92');
    expect(formatAmount(6900)).toBe('¥6,900.00');
  });

  it('formats signed change values with amount and percentage', () => {
    expect(formatSignedAmountWithRate(909.18, 0.2029)).toBe('+¥909.18 / +20.29%');
    expect(formatSignedAmountWithRate(-120, -0.0342)).toBe('-¥120.00 / -3.42%');
  });

  it('formats unit prices with eight decimal places', () => {
    expect(formatPrice(65000.12, 'USDT')).toBe('USDT 65,000.12000000');
    expect(formatPrice(1.2512)).toBe('¥1.25120000');
    expect(formatPrice(0.123456789)).toBe('¥0.12345679');
  });

  it('formats editable price values with eight decimal places', () => {
    expect(formatPriceDecimal(65000.12)).toBe('65000.12000000');
  });
});
