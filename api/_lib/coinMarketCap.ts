import {
  CryptoQuoteProvider,
  CryptoQuoteResponse,
  PublicApiError,
  normalizeConvert,
  normalizeSymbol
} from './cryptoQuoteProvider';

const coinMarketCapQuotesLatestUrl =
  'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest';
const missingPriceMessage = '未查到有效的加密货币价格，请确认代码和币种';

interface CoinMarketCapQuoteCurrency {
  price?: unknown;
  last_updated?: unknown;
}

interface CoinMarketCapAsset {
  quote?: Record<string, CoinMarketCapQuoteCurrency | undefined>;
}

export interface CoinMarketCapResponse {
  data?: Record<string, CoinMarketCapAsset | CoinMarketCapAsset[] | undefined>;
}

export function buildCoinMarketCapUrl(symbol: string, convert: string): string {
  const url = new URL(coinMarketCapQuotesLatestUrl);
  url.searchParams.set('symbol', normalizeSymbol(symbol));
  url.searchParams.set('convert', normalizeConvert(convert));
  return url.toString();
}

export function normalizeCoinMarketCapQuote(
  payload: CoinMarketCapResponse,
  symbolInput: string,
  convertInput: string
): CryptoQuoteResponse {
  const symbol = normalizeSymbol(symbolInput);
  const convert = normalizeConvert(convertInput);
  const assetEntry = payload.data?.[symbol];
  const asset = Array.isArray(assetEntry) ? assetEntry[0] : assetEntry;
  const quote = asset?.quote?.[convert];
  const price = quote?.price;

  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    throw new PublicApiError(missingPriceMessage, 404);
  }

  const asOf =
    typeof quote.last_updated === 'string' ? quote.last_updated : undefined;

  return {
    price,
    source: 'coinmarketcap',
    asOf,
    symbol,
    convert
  };
}

export const fetchCoinMarketCapQuote: CryptoQuoteProvider = async ({
  symbol,
  convert,
  apiKey,
  fetchImpl = fetch
}) => {
  const response = await fetchImpl(buildCoinMarketCapUrl(symbol, convert), {
    headers: {
      Accept: 'application/json',
      'X-CMC_PRO_API_KEY': apiKey
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new PublicApiError('CoinMarketCap API key 无效或无权限', 502);
    }

    if (response.status === 429) {
      throw new PublicApiError('CoinMarketCap 查询频率受限，请稍后再试', 429);
    }

    throw new PublicApiError(
      `CoinMarketCap 行情请求失败：HTTP ${response.status}`,
      502
    );
  }

  const payload = (await response.json()) as CoinMarketCapResponse;
  return normalizeCoinMarketCapQuote(payload, symbol, convert);
};
