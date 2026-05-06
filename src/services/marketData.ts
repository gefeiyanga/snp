import type { AssetCurrency, InvestmentAssetType } from '@/types/ledger';

const EASTMONEY_QUOTE_API_PATH = '/api/eastmoney/quote';
const CRYPTO_QUOTE_API_PATH = '/api/crypto/quote';
const USDT_CNY_RATE_API_PATH = '/api/fx/usdt-cny';

type QuoteLookupParams = {
  symbol: string;
  investmentType: InvestmentAssetType;
  currency: AssetCurrency;
};

type QuoteLookupResult = {
  price: number;
  source: 'eastmoney' | 'coinmarketcap';
  asOf?: string;
  exchangeRate?: number;
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

async function fetchUsdtCnyRate(): Promise<{ rate: number; asOf?: string }> {
  const response = await fetch(USDT_CNY_RATE_API_PATH);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `USDT/CNY 汇率请求失败：HTTP ${response.status}`));
  }

  const data = (await response.json()) as { rate?: unknown; asOf?: string };
  const rate = Number(data?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('未查到有效 USDT/CNY 汇率');
  }

  return {
    rate,
    asOf: data.asOf
  };
}

async function fetchCryptoQuote(symbol: string): Promise<QuoteLookupResult> {
  const searchParams = new URLSearchParams({
    symbol,
    convert: 'USDT'
  });
  const response = await fetch(`${CRYPTO_QUOTE_API_PATH}?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `加密货币行情请求失败：HTTP ${response.status}`));
  }

  const data = (await response.json()) as QuoteApiResult;
  const price = Number(data?.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('未查到有效 USDT 价格，请确认代码');
  }

  const usdtCny = await fetchUsdtCnyRate();

  return {
    price,
    source: 'coinmarketcap',
    asOf: data.asOf ?? usdtCny.asOf,
    exchangeRate: usdtCny.rate
  };
}

export async function lookupInvestmentQuote(params: QuoteLookupParams): Promise<QuoteLookupResult> {
  const symbol = params.symbol.trim().toUpperCase();
  if (!symbol) {
    throw new Error('请先输入标的代码');
  }

  if (params.investmentType === 'crypto') {
    return fetchCryptoQuote(symbol);
  }

  return fetchEastmoneyQuote(symbol);
}

export function hasMarketDataApiKey(): boolean {
  return true;
}

export function requiresApiKeyForInvestmentType(_investmentType: InvestmentAssetType): boolean {
  return false;
}
