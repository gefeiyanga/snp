type VercelResponse = {
  status: (statusCode: number) => VercelResponse;
  json: (body: unknown) => void;
};

type CoinGeckoTetherCnyResult = {
  tether?: {
    cny?: unknown;
    last_updated_at?: unknown;
  };
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

const coinGeckoTetherCnyApiUrl =
  'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=cny&include_last_updated_at=true';

function formatUnixTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return new Date(value * 1000).toISOString();
}

function normalizeUsdtCnyRate(payload: CoinGeckoTetherCnyResult): { rate: number; asOf?: string } {
  const rate = Number(payload?.tether?.cny);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new PublicApiError('未查到有效 USDT/CNY 汇率', 404);
  }

  return {
    rate,
    asOf: formatUnixTimestamp(payload.tether?.last_updated_at)
  };
}

async function fetchUsdtCnyRate(): Promise<{ rate: number; asOf?: string }> {
  const coinGeckoResponse = await fetch(coinGeckoTetherCnyApiUrl, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!coinGeckoResponse.ok) {
    throw new PublicApiError(`CoinGecko 汇率请求失败：HTTP ${coinGeckoResponse.status}`, 502);
  }

  return normalizeUsdtCnyRate((await coinGeckoResponse.json()) as CoinGeckoTetherCnyResult);
}

export default async function handler(
  _request: unknown,
  response: VercelResponse
) {
  try {
    response.status(200).json(await fetchUsdtCnyRate());
  } catch (error) {
    if (error instanceof PublicApiError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error('USDT/CNY rate lookup failed', error);
    response.status(502).json({ error: '无法连接 CoinGecko，请检查本机网络、代理或稍后再试' });
  }
}
