type VercelRequest = {
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (statusCode: number) => VercelResponse;
  json: (body: unknown) => void;
};

type EastMoneyNetWorthPoint = {
  x?: number;
  y?: number;
};

type EastMoneyQuoteResponse = {
  price: number;
  source: 'eastmoney';
  asOf?: string;
  symbol: string;
};

class PublicApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

const eastMoneyPingzhongdataBaseUrl = 'https://fund.eastmoney.com/pingzhongdata';
const missingPriceMessage = '未查到有效价格，请确认代码';

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function buildEastMoneyPingzhongdataUrl(symbol: string): string {
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

function normalizeEastMoneyQuote(
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

async function fetchEastMoneyQuote(symbol: string): Promise<EastMoneyQuoteResponse> {
  const eastMoneyResponse = await fetch(buildEastMoneyPingzhongdataUrl(symbol), {
    headers: {
      Accept: 'application/javascript,text/javascript,*/*'
    }
  });

  if (!eastMoneyResponse.ok) {
    throw new PublicApiError(`东方财富行情请求失败：HTTP ${eastMoneyResponse.status}`, 502);
  }

  return normalizeEastMoneyQuote(await eastMoneyResponse.text(), symbol);
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const symbol = normalizeSymbol(firstQueryValue(request.query.symbol));

  if (!symbol) {
    response.status(400).json({ error: '请先输入标的代码' });
    return;
  }

  try {
    response.status(200).json(await fetchEastMoneyQuote(symbol));
  } catch (error) {
    if (error instanceof PublicApiError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error('Eastmoney quote lookup failed', error);
    response.status(502).json({ error: '无法连接东方财富，请检查本机网络、代理或稍后再试' });
  }
}
