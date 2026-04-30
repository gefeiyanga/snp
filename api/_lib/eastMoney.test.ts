import { describe, expect, it } from 'vitest';
import {
  buildEastMoneyPingzhongdataUrl,
  normalizeEastMoneyQuote
} from './eastMoney';
import { PublicApiError } from './cryptoQuoteProvider';

describe('buildEastMoneyPingzhongdataUrl', () => {
  it('builds a pingzhongdata URL with a normalized symbol', () => {
    expect(buildEastMoneyPingzhongdataUrl(' 000001 ')).toBe(
      'https://fund.eastmoney.com/pingzhongdata/000001.js'
    );
  });
});

describe('normalizeEastMoneyQuote', () => {
  it('uses the latest positive net worth trend point as the quote', () => {
    const script = `
      var fS_code = "000001";
      var Data_netWorthTrend = [
        {"x":1714176000000,"y":1.2456},
        {"x":1714262400000,"y":1.2512}
      ];
    `;

    expect(normalizeEastMoneyQuote(script, '000001')).toEqual({
      price: 1.2512,
      source: 'eastmoney',
      asOf: '2024-04-28',
      symbol: '000001'
    });
  });

  it('throws a public 404 error when trend data is missing', () => {
    expect(() => normalizeEastMoneyQuote('var fS_code = "000001";', '000001')).toThrow(
      new PublicApiError('未查到有效价格，请确认代码', 404)
    );
  });
});
