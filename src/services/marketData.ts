import type { AssetCurrency, InvestmentAssetType } from '@/types/ledger';

const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
const CRYPTO_QUOTE_API_PATH = '/api/crypto/quote';

type QuoteLookupParams = {
  symbol: string;
  investmentType: InvestmentAssetType;
  currency: AssetCurrency;
};

type QuoteLookupResult = {
  price: number;
  source: 'alpha_vantage' | 'coinmarketcap';
  asOf?: string;
};

type CryptoQuoteApiResult = QuoteLookupResult & {
  symbol?: string;
  convert?: string;
};

function getApiKey(): string {
  return import.meta.env.VITE_ALPHA_VANTAGE_API_KEY?.trim() ?? '';
}

function assertApiKey(): string {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('缺少 VITE_ALPHA_VANTAGE_API_KEY');
  }
  return apiKey;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return typeof data?.error === 'string' && data.error ? data.error : fallback;
  } catch {
    return fallback;
  }
}

async function fetchAlphaVantage(params: Record<string, string>): Promise<any> {
  const url = new URL(ALPHA_VANTAGE_BASE_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`行情请求失败：HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data['Error Message']) {
    throw new Error('行情代码不存在或接口参数错误');
  }
  if (data.Note) {
    throw new Error('行情接口频率受限，请稍后再试');
  }

  return data;
}

async function fetchEquityOrFundQuote(symbol: string): Promise<QuoteLookupResult> {
  const apiKey = assertApiKey();
  const data = await fetchAlphaVantage({
    function: 'GLOBAL_QUOTE',
    symbol,
    apikey: apiKey
  });

  const quote = data['Global Quote'];
  const price = Number(quote?.['05. price']);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('未查到有效价格，请确认代码');
  }

  return {
    price,
    source: 'alpha_vantage',
    asOf: quote?.['07. latest trading day']
  };
}

async function fetchFundQuote(symbol: string): Promise<QuoteLookupResult> {
  const apiKey = assertApiKey();
  const data = await fetchAlphaVantage({
    function: 'TIME_SERIES_DAILY',
    symbol,
    outputsize: 'compact',
    apikey: apiKey
  });

  const series = data['Time Series (Daily)'];
  const latestDate = typeof series === 'object' ? Object.keys(series)[0] : '';
  const latest = latestDate ? series?.[latestDate] : undefined;
  const price = Number(latest?.['4. close']);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('未查到有效基金净值/收盘价，请确认代码');
  }

  return {
    price,
    source: 'alpha_vantage',
    asOf: latestDate
  };
}

async function fetchCryptoQuote(symbol: string, currency: AssetCurrency): Promise<QuoteLookupResult> {
  const searchParams = new URLSearchParams({
    symbol,
    convert: currency
  });
  const response = await fetch(`${CRYPTO_QUOTE_API_PATH}?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `加密货币行情请求失败：HTTP ${response.status}`));
  }

  const data = (await response.json()) as CryptoQuoteApiResult;
  const price = Number(data?.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('未查到有效价格，请确认代码和币种');
  }

  return {
    price,
    source: 'coinmarketcap',
    asOf: data.asOf
  };
}

export async function lookupInvestmentQuote(params: QuoteLookupParams): Promise<QuoteLookupResult> {
  const symbol = params.symbol.trim().toUpperCase();
  if (!symbol) {
    throw new Error('请先输入标的代码');
  }

  if (params.investmentType === 'crypto') {
    return fetchCryptoQuote(symbol, params.currency);
  }

  if (params.investmentType === 'fund') {
    return fetchFundQuote(symbol);
  }

  return fetchEquityOrFundQuote(symbol);
}

export function hasMarketDataApiKey(): boolean {
  return !!getApiKey();
}

export function requiresApiKeyForInvestmentType(investmentType: InvestmentAssetType): boolean {
  return investmentType === 'stock' || investmentType === 'fund';
}
