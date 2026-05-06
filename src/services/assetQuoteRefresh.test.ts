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
        investmentType: 'security',
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
        investmentType: 'security',
        quantity: 10,
        unitPrice: 50,
        currency: 'CNY'
      },
      {
        id: 'stock-1',
        name: 'Stock',
        amount: 500,
        category: '投资',
        valuationMode: 'market_quantity',
        investmentType: 'stock',
        quantity: 10,
        unitPrice: 50,
        symbol: '600519',
        currency: 'CNY'
      }
    ];
    const lookupQuote = vi
      .fn()
      .mockResolvedValueOnce({
        price: 65000,
        source: 'coinmarketcap',
        asOf: '2026-04-27T10:00:00.000Z',
        exchangeRate: 7.25
      })
      .mockResolvedValueOnce({ price: 3.456, source: 'eastmoney', asOf: '2026-04-28' })
      .mockResolvedValueOnce({ price: 52, source: 'eastmoney', asOf: '2026-04-29' });

    const result = await refreshInvestmentAssetQuotes(assets, lookupQuote);

    expect(lookupQuote).toHaveBeenCalledTimes(3);
    expect(lookupQuote).toHaveBeenNthCalledWith(1, {
      symbol: 'btc',
      investmentType: 'crypto',
      currency: 'CNY'
    });
    expect(lookupQuote).toHaveBeenNthCalledWith(2, {
      symbol: '000001',
      investmentType: 'security',
      currency: 'CNY'
    });
    expect(lookupQuote).toHaveBeenNthCalledWith(3, {
      symbol: '600519',
      investmentType: 'security',
      currency: 'CNY'
    });
    expect(result.refreshed).toBe(3);
    expect(result.assets).toEqual([
      assets[0],
      {
        ...assets[1],
        unitPrice: 65000,
        exchangeRate: 7.25,
        currency: 'USDT',
        quoteUpdatedAt: '2026-04-27T10:00:00.000Z',
        amount: 942500
      },
      {
        ...assets[2],
        unitPrice: 3.456,
        exchangeRate: undefined,
        currency: 'CNY',
        quoteUpdatedAt: '2026-04-28',
        amount: 345.6
      },
      assets[3],
      {
        ...assets[4],
        unitPrice: 52,
        exchangeRate: undefined,
        currency: 'CNY',
        quoteUpdatedAt: '2026-04-29',
        amount: 520
      }
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
        investmentType: 'security',
        quantity: 10,
        unitPrice: 20,
        symbol: '000001',
        currency: 'CNY'
      }
    ];
    const lookupQuote = vi
      .fn()
      .mockRejectedValueOnce(new Error('quote failed'))
      .mockResolvedValueOnce({ price: 21, source: 'eastmoney', asOf: '2026-04-28' });

    const result = await refreshInvestmentAssetQuotes(assets, lookupQuote);

    expect(result.refreshed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.assets).toEqual([
      assets[0],
      {
        ...assets[1],
        unitPrice: 21,
        exchangeRate: undefined,
        currency: 'CNY',
        quoteUpdatedAt: '2026-04-28',
        amount: 210
      }
    ]);
  });
});
