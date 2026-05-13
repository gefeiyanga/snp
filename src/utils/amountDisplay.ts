import type { AssetCurrency } from '@/types/ledger';

const currencyPrefix: Record<AssetCurrency, string> = {
  CNY: '¥',
  USD: '$',
  USDT: 'USDT '
};

export const formatAmount = (value: number, currency: AssetCurrency = 'CNY') => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const absValue = Math.abs(safeValue);
  const sign = safeValue < 0 ? '-' : '';
  const formatted = absValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${sign}${currencyPrefix[currency]}${formatted}`;
};

export const formatPriceDecimal = (value: number) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return safeValue.toFixed(8);
};

export const formatPrice = (value: number, currency: AssetCurrency = 'CNY') => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const absValue = Math.abs(safeValue);
  const sign = safeValue < 0 ? '-' : '';
  const formatted = absValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 8,
    maximumFractionDigits: 8
  });
  return `${sign}${currencyPrefix[currency]}${formatted}`;
};

export const formatSignedAmount = (value: number, currency: AssetCurrency = 'CNY') => {
  if (value > 0) return `+${formatAmount(value, currency)}`;
  return formatAmount(value, currency);
};

export const formatPercent = (value: number) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
};

export const formatSignedAmountWithRate = (amount: number, rate: number, currency: AssetCurrency = 'CNY') =>
  `${formatSignedAmount(amount, currency)} / ${formatPercent(rate)}`;
