export interface CryptoQuoteRequest {
  symbol: string;
  convert: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface CryptoQuoteResponse {
  price: number;
  source: 'coinmarketcap';
  asOf?: string;
  symbol: string;
  convert: string;
}

export type CryptoQuoteProvider = (
  request: CryptoQuoteRequest
) => Promise<CryptoQuoteResponse>;

export class PublicApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'PublicApiError';
  }
}

export function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeConvert(value: string | undefined): string {
  return (value ?? 'USD').trim().toUpperCase();
}
