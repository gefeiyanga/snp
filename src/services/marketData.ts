import type { AssetCurrency, InvestmentAssetType } from '@/types/ledger';

const EASTMONEY_QUOTE_API_PATH = '/api/eastmoney/quote';
const CRYPTO_QUOTE_API_PATH = '/api/crypto/quote';

type QuoteLookupParams = {
  symbol: string;
  investmentType: InvestmentAssetType;
  currency: AssetCurrency;
};

type QuoteLookupResult = {
  price: number;
  source: 'eastmoney' | 'coinmarketcap';
  asOf?: string;
};

type QuoteApiResult = QuoteLookupResult & {
  symbol?: string;
  convert?: string;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return typeof data?.error === 'string' && data.error ? data.error : fallback;
  } catch {
    return fallback;
  }
}

async function fetchEastmoneyQuote(symbol: string): Promise<QuoteLookupResult> {
  const searchParams = new URLSearchParams({ symbol });
  const response = await fetch(`${EASTMONEY_QUOTE_API_PATH}?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `东方财富行情请求失败：HTTP ${response.status}`));
  }

  const data = (await response.json()) as QuoteApiResult;
  const price = Number(data?.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('未查到有效价格，请确认代码');
  }

  return {
    price,
    source: 'eastmoney',
    asOf: data.asOf
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

  const data = (await response.json()) as QuoteApiResult;
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

  return fetchEastmoneyQuote(symbol);
}

export function hasMarketDataApiKey(): boolean {
  return true;
}

export function requiresApiKeyForInvestmentType(_investmentType: InvestmentAssetType): boolean {
  return false;
}
