import type { AssetRecord } from '@/types/ledger';

export type InvestmentReturn = {
  costAmount: number;
  currentAmount: number;
  profit: number;
  profitRate: number;
};

const toMoney = (value: number) => Math.round(value * 100) / 100;

const priceMultiplier = (asset: AssetRecord): number | null => {
  if (asset.investmentType !== 'crypto') return 1;
  const exchangeRate = Number(asset.exchangeRate ?? 0);
  return exchangeRate > 0 ? exchangeRate : null;
};

export const calculateInvestmentReturn = (asset: AssetRecord): InvestmentReturn | null => {
  if (asset.category !== '投资' && asset.valuationMode !== 'market_quantity') return null;

  const quantity = Number(asset.quantity ?? 0);
  const unitPrice = Number(asset.unitPrice ?? 0);
  const costPrice = Number(asset.costPrice ?? 0);
  const multiplier = priceMultiplier(asset);

  if (quantity <= 0 || unitPrice <= 0 || costPrice <= 0 || multiplier === null) return null;

  const currentAmount = toMoney(quantity * unitPrice * multiplier);
  const costAmount = toMoney(quantity * costPrice * multiplier);
  const profit = toMoney(currentAmount - costAmount);

  return {
    costAmount,
    currentAmount,
    profit,
    profitRate: (unitPrice - costPrice) / costPrice
  };
};

