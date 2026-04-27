import { describe, expect, it } from 'vitest';
import { PublicApiError } from './cryptoQuoteProvider';
import {
  buildCoinMarketCapUrl,
  normalizeCoinMarketCapQuote
} from './coinMarketCap';

const missingPriceMessage = '未查到有效的加密货币价格，请确认代码和币种';

describe('buildCoinMarketCapUrl', () => {
  it('builds a CoinMarketCap v2 latest quote URL with normalized query values', () => {
    expect(buildCoinMarketCapUrl('btc', 'usd')).toBe(
      'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=BTC&convert=USD'
    );
  });
});

describe('normalizeCoinMarketCapQuote', () => {
  it('normalizes the first BTC/USD quote from a CoinMarketCap v2 payload', () => {
    const payload = {
      data: {
        BTC: [
          {
            symbol: 'BTC',
            quote: {
              USD: {
                price: 65432.1,
                last_updated: '2026-04-27T10:00:00.000Z'
              }
            }
          }
        ]
      }
    };

    expect(normalizeCoinMarketCapQuote(payload, 'btc', 'usd')).toEqual({
      price: 65432.1,
      source: 'coinmarketcap',
      asOf: '2026-04-27T10:00:00.000Z',
      symbol: 'BTC',
      convert: 'USD'
    });
  });

  it('throws a public 404 error when quote data is missing', () => {
    expect(() => normalizeCoinMarketCapQuote({ data: {} }, 'btc', 'usd')).toThrow(
      new PublicApiError(missingPriceMessage, 404)
    );
  });

  it('throws a public 404 error when the price is not positive', () => {
    const payload = {
      data: {
        BTC: {
          quote: {
            USD: {
              price: 0,
              last_updated: '2026-04-27T10:00:00.000Z'
            }
          }
        }
      }
    };

    expect(() => normalizeCoinMarketCapQuote(payload, 'btc', 'usd')).toThrow(
      new PublicApiError(missingPriceMessage, 404)
    );
  });
});
