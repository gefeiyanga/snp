import { fetchCoinMarketCapQuote } from '../_lib/coinMarketCap';
import {
  PublicApiError,
  normalizeConvert,
  normalizeSymbol
} from '../_lib/cryptoQuoteProvider';

type VercelRequest = {
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (statusCode: number) => VercelResponse;
  json: (body: unknown) => void;
};

function firstQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
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

    response.status(502).json({ error: '加密货币行情查询失败，请稍后再试' });
  }
}
