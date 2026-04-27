import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupInvestmentQuote, requiresApiKeyForInvestmentType } from './marketData';

describe('marketData crypto lookup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('calls the local crypto quote api with normalized symbol and currency', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        price: 65000.12,
        source: 'coinmarketcap',
        asOf: '2026-04-27T10:12:30.000Z',
        symbol: 'BTC',
        convert: 'USD'
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupInvestmentQuote({
      symbol: ' btc ',
      investmentType: 'crypto',
      currency: 'USD'
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/crypto/quote?symbol=BTC&convert=USD');
    expect(result).toEqual({
      price: 65000.12,
      source: 'coinmarketcap',
      asOf: '2026-04-27T10:12:30.000Z'
    });
  });

  it('surfaces the proxy error message without changing it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'CoinMarketCap 查询频率受限，请稍后再试' })
      })
    );

    await expect(
      lookupInvestmentQuote({
        symbol: 'BTC',
        investmentType: 'crypto',
        currency: 'USD'
      })
    ).rejects.toThrow('CoinMarketCap 查询频率受限，请稍后再试');
  });

  it('requires browser-visible api keys only for stocks and funds', () => {
    expect(requiresApiKeyForInvestmentType('crypto')).toBe(false);
    expect(requiresApiKeyForInvestmentType('stock')).toBe(true);
    expect(requiresApiKeyForInvestmentType('fund')).toBe(true);
  });
});
