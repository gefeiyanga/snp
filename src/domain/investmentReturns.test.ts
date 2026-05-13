import { describe, expect, it } from 'vitest';
import { calculateInvestmentReturn } from './investmentReturns';
import type { AssetRecord } from '@/types/ledger';

const baseAsset: AssetRecord = {
  id: 'asset-1',
  name: '沪深300ETF',
  amount: 1200,
  category: '投资',
  valuationMode: 'market_quantity',
  investmentType: 'security',
  quantity: 100,
  unitPrice: 12,
  costPrice: 10,
  currency: 'CNY'
};

describe('calculateInvestmentReturn', () => {
  it('calculates profit and return rate for security assets with cost price', () => {
    expect(calculateInvestmentReturn(baseAsset)).toEqual({
      costAmount: 1000,
      currentAmount: 1200,
      profit: 200,
      profitRate: 0.2
    });
  });

  it('uses USDT/CNY exchange rate for crypto profit amount', () => {
    expect(
      calculateInvestmentReturn({
        ...baseAsset,
        name: 'BTC',
        investmentType: 'crypto',
        quantity: 0.5,
        unitPrice: 62000,
        costPrice: 60000,
        exchangeRate: 7.2,
        currency: 'USDT'
      })?.profit
    ).toBe(7200);
  });

  it('returns null when cost price is missing', () => {
    expect(calculateInvestmentReturn({ ...baseAsset, costPrice: undefined })).toBeNull();
  });
});

