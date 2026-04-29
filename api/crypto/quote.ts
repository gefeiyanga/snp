type VercelRequest = {
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (statusCode: number) => VercelResponse;
  json: (body: unknown) => void;
};

type CryptoQuoteResponse = {
  price: number;
  source: 'coinmarketcap';
  asOf?: string;
  symbol: string;
  convert: string;
};

interface CoinMarketCapQuoteCurrency {
  price?: unknown;
  last_updated?: unknown;
}

interface CoinMarketCapAsset {
  quote?: Record<string, CoinMarketCapQuoteCurrency | undefined>;
}

interface CoinMarketCapResponse {
  data?: Record<string, CoinMarketCapAsset | CoinMarketCapAsset[] | undefined>;
}

class PublicApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

const coinMarketCapQuotesLatestUrl =
  'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest';
const missingPriceMessage = '未查到有效的加密货币价格，请确认代码和币种';

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeConvert(value: string | undefined): string {
  return (value ?? 'USD').trim().toUpperCase();
}

function buildCoinMarketCapUrl(symbol: string, convert: string): string {
  const url = new URL(coinMarketCapQuotesLatestUrl);
  url.searchParams.set('symbol', normalizeSymbol(symbol));
  url.searchParams.set('convert', normalizeConvert(convert));
  return url.toString();
}

function normalizeCoinMarketCapQuote(
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
    typeof quote?.last_updated === 'string' ? quote.last_updated : undefined;

  return {
    price,
    source: 'coinmarketcap',
    asOf,
    symbol,
    convert
  };
}

async function fetchCoinMarketCapQuote({
  symbol,
  convert,
  apiKey
}: {
  symbol: string;
  convert: string;
  apiKey: string;
}): Promise<CryptoQuoteResponse> {
  const coinMarketCapResponse = await fetch(
    buildCoinMarketCapUrl(symbol, convert),
    {
      headers: {
        Accept: 'application/json',
        'X-CMC_PRO_API_KEY': apiKey
      }
    }
  );

  if (!coinMarketCapResponse.ok) {
    if (
      coinMarketCapResponse.status === 401 ||
      coinMarketCapResponse.status === 403
    ) {
      throw new PublicApiError('CoinMarketCap API key 无效或无权限', 502);
    }

    if (coinMarketCapResponse.status === 429) {
      throw new PublicApiError('CoinMarketCap 查询频率受限，请稍后再试', 429);
    }

    throw new PublicApiError(
      `CoinMarketCap 行情请求失败：HTTP ${coinMarketCapResponse.status}`,
      502
    );
  }

  const payload = (await coinMarketCapResponse.json()) as CoinMarketCapResponse;
  return normalizeCoinMarketCapQuote(payload, symbol, convert);
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const symbol = normalizeSymbol(firstQueryValue(request.query.symbol));
  const convert = normalizeConvert(firstQueryValue(request.query.convert));

  if (!symbol) {
    response.status(400).json({ error: '请先输入标的代码' });
    return;
  }

  const apiKey = process.env.COINMARKETCAP_API_KEY?.trim();
  if (!apiKey) {
    response.status(500).json({ error: '缺少 COINMARKETCAP_API_KEY' });
    return;
  }

  try {
    response.status(200).json(await fetchCoinMarketCapQuote({ symbol, convert, apiKey }));
  } catch (error) {
    if (error instanceof PublicApiError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error('CoinMarketCap quote lookup failed', error);
    response.status(502).json({ error: '无法连接 CoinMarketCap，请检查本机网络/代理或稍后再试' });
  }
}
