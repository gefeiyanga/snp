import { PublicApiError, normalizeSymbol } from './cryptoQuoteProvider';

const eastMoneyPingzhongdataBaseUrl = 'https://fund.eastmoney.com/pingzhongdata';
const missingPriceMessage = '未查到有效价格，请确认代码';

type EastMoneyNetWorthPoint = {
  x?: number;
  y?: number;
};

export type EastMoneyQuoteResponse = {
  price: number;
  source: 'eastmoney';
  asOf?: string;
  symbol: string;
};

export function buildEastMoneyPingzhongdataUrl(symbol: string): string {
  return `${eastMoneyPingzhongdataBaseUrl}/${encodeURIComponent(normalizeSymbol(symbol))}.js`;
}

function formatEastMoneyDate(timestamp?: number): string | undefined {
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(Number(timestamp)).toISOString().slice(0, 10);
}

function parseEastMoneyNetWorthTrend(script: string): EastMoneyNetWorthPoint[] {
  const match = script.match(/\bData_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (!match?.[1]) {
    throw new PublicApiError(missingPriceMessage, 404);
  }

  try {
    const data = JSON.parse(match[1]);
    return Array.isArray(data) ? data : [];
  } catch {
    throw new PublicApiError('行情数据解析失败，请稍后再试', 502);
  }
}

export function normalizeEastMoneyQuote(
  script: string,
  symbolInput: string
): EastMoneyQuoteResponse {
  const symbol = normalizeSymbol(symbolInput);
  const trend = parseEastMoneyNetWorthTrend(script);
  const latest = trend
    .slice()
    .reverse()
    .find((item) => Number.isFinite(item?.y) && Number(item.y) > 0);
  const price = Number(latest?.y);

  if (!Number.isFinite(price) || price <= 0) {
    throw new PublicApiError(missingPriceMessage, 404);
  }

  return {
    price,
    source: 'eastmoney',
    asOf: formatEastMoneyDate(latest?.x),
    symbol
  };
}
