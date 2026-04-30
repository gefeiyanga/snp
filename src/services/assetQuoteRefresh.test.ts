import { describe, expect, it, vi } from 'vitest';
import { refreshInvestmentAssetQuotes } from './assetQuoteRefresh';
import type { AssetRecord } from '@/types/ledger';

describe('asset quote refresh', () => {
  it('updates market-priced assets and leaves manual assets unchanged', async () => {
    const assets: AssetRecord[] = [
      {
        id: 'cash-1',
        name: 'Cash',
        amount: 1000,
        category: '现金',
        valuationMode: 'manual_amount'
      },
      {
        id: 'btc-1',
        name: 'Bitcoin',
        amount: 120000,
        category: '投资',
        valuationMode: 'market_quantity',
        investmentType: 'crypto',
        quantity: 2,
        unitPrice: 60000,
        symbol: 'btc',
        currency: 'USD'
      },
      {
        id: 'fund-1',
        name: 'Fund',
        amount: 300,
        category: '投资',
        valuationMode: 'market_quantity',
        investmentType: 'fund',
        quantity: 100,
        unitPrice: 3,
        symbol: '000001',
        currency: 'CNY'
      },
      {
        id: 'missing-symbol',
        name: 'Missing symbol',
        amount: 500,
        category: '投资',
        valuationMode: 'market_quantity',
        investmentType: 'stock',
        quantity: 10,
        unitPrice: 50,
        currency: 'CNY'
      }
    ];
    const lookupQuote = vi
      .fn()
      .mockResolvedValueOnce({ price: 65000, source: 'coinmarketcap' })
      .mockResolvedValueOnce({ price: 3.456, source: 'eastmoney' });

    const result = await refreshInvestmentAssetQuotes(assets, lookupQuote);

    expect(lookupQuote).toHaveBeenCalledTimes(2);
    expect(lookupQuote).toHaveBeenNthCalledWith(1, {
      symbol: 'btc',
      investmentType: 'crypto',
      currency: 'USD'
    });
    expect(lookupQuote).toHaveBeenNthCalledWith(2, {
      symbol: '000001',
      investmentType: 'fund',
      currency: 'CNY'
    });
    expect(result.refreshed).toBe(2);
    expect(result.assets).toEqual([
      assets[0],
      {
        ...assets[1],
        unitPrice: 65000,
        amount: 130000
      },
      {
        ...assets[2],
        unitPrice: 3.456,
        amount: 345.6
      },
      assets[3]
    ]);
  });

  it('keeps refreshing other assets when one quote lookup fails', async () => {
    const assets: AssetRecord[] = [
      {
        id: 'bad',
        name: 'Bad quote',
        amount: 100,
        category: '投资',
        valuationMode: 'market_quantity',
        investmentType: 'stock',
        quantity: 10,
        unitPrice: 10,
        symbol: 'BAD',
        currency: 'CNY'
      },
      {
        id: 'ok',
        name: 'Good quote',
        amount: 200,
        category: '投资',
        valuationMode: 'market_quantity',
        investmentType: 'fund',
        quantity: 10,
        unitPrice: 20,
        symbol: '000001',
        currency: 'CNY'
      }
    ];
    const lookupQuote = vi
      .fn()
      .mockRejectedValueOnce(new Error('quote failed'))
      .mockResolvedValueOnce({ price: 21, source: 'eastmoney' });

    const result = await refreshInvestmentAssetQuotes(assets, lookupQuote);

    expect(result.refreshed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.assets).toEqual([
      assets[0],
      {
        ...assets[1],
        unitPrice: 21,
        amount: 210
      }
    ]);
  });
});
