# CoinMarketCap Crypto Quotes via Vercel Function - Design

**Date:** 2026-04-27  
**Status:** Draft approved for spec review  
**Scope:** Replace the current Binance-backed crypto quote lookup with a CoinMarketCap-backed server-side proxy that works in local development and on Vercel.

---

## 1. Background

The current app has a single market data entry point in `src/services/marketData.ts`.

- Stocks and funds use Alpha Vantage and require `VITE_ALPHA_VANTAGE_API_KEY`.
- Crypto uses Binance's public ticker endpoint and does not require a key.
- The investment asset form already calls `lookupInvestmentQuote()` and expects a normalized `{ price, source, asOf }` result.

The new requirement is to use CoinMarketCap for crypto quotes. The user will provide a CoinMarketCap API key, and the app must work after deployment to Vercel.

## 2. Goals

- Use CoinMarketCap as the crypto quote source.
- Keep the API key server-side. Do not expose it through `VITE_` environment variables or browser-bundled code.
- Support Vercel production deployments.
- Keep local development close to production by using the same `/api/crypto/quote` path.
- Preserve the current frontend quote lookup contract as much as possible.

## 3. Non-Goals

- Do not change stock or fund quote behavior in this feature.
- Do not add portfolio-wide automatic price refresh yet.
- Do not add historical crypto charts or price history.
- Do not build account-based sync or server-side persistence.

## 4. Chosen Approach

Add a Vercel Function at `api/crypto/quote.ts`.

The frontend will request:

```text
/api/crypto/quote?symbol=BTC&convert=USD
```

The Vercel Function will:

1. Read `COINMARKETCAP_API_KEY` from server-side environment variables.
2. Validate the query parameters.
3. Call CoinMarketCap's latest quote endpoint with the API key in the `X-CMC_PRO_API_KEY` header.
4. Normalize the CoinMarketCap response into a small frontend-facing payload.

The browser never receives the CoinMarketCap key.

## 4.1 Provider Flexibility

CoinMarketCap is the first crypto quote provider, not a permanent frontend contract.

Implementation must keep a provider boundary:

- The frontend only depends on `/api/crypto/quote` and the normalized `{ price, source, asOf, symbol, convert }` response.
- CoinMarketCap-specific URLs, headers, response fields, and error mapping stay inside the server-side provider adapter.
- The Vercel Function calls a provider function through a small internal contract, so a future provider can be added or swapped without changing Vue components.
- Provider-specific source names may change internally, but UI behavior should depend on price availability and user-safe errors, not on CoinMarketCap response shape.

## 5. Environment Variables

Use this variable name:

```env
COINMARKETCAP_API_KEY=your_key_here
```

Rules:

- The variable must not use the `VITE_` prefix.
- Local development should load it through Vercel's local environment handling, usually via `.env.local` or Vercel-linked env files.
- Vercel production must define the same variable in the project environment settings.

## 6. Local Development

Use Vercel's local dev server for crypto quote work:

```bash
pnpm dev:vercel
```

The implementation should add a script similar to:

```json
{
  "dev:vercel": "vercel dev"
}
```

This keeps the local and deployed request path the same:

```text
/api/crypto/quote
```

`pnpm dev` can remain available for normal frontend-only work, but crypto quote lookup will require the Vercel Function runtime.

## 7. API Contract

### Request

```http
GET /api/crypto/quote?symbol=BTC&convert=USD
```

Parameters:

| Name | Required | Rule |
| --- | --- | --- |
| `symbol` | Yes | Trimmed, uppercased asset symbol such as `BTC`, `ETH`, or `SOL`. |
| `convert` | No | Trimmed, uppercased fiat or crypto quote currency. Defaults to `USD`. |

### Success Response

```json
{
  "price": 65000.12,
  "source": "coinmarketcap",
  "asOf": "2026-04-27T10:12:30.000Z",
  "symbol": "BTC",
  "convert": "USD"
}
```

### Error Response

```json
{
  "error": "Missing CoinMarketCap API key"
}
```

The frontend should show a concise toast message and leave the existing manually-entered unit price unchanged.

## 8. Frontend Integration

Update `src/services/marketData.ts`:

- Add `coinmarketcap` to the quote source union.
- Replace Binance crypto lookup with a call to `/api/crypto/quote`.
- Keep `lookupInvestmentQuote()` as the single public entry point.
- Keep stocks and funds on Alpha Vantage.
- Update API-key status copy so crypto no longer says it is keyless.

The form component can keep calling `lookupInvestmentQuote()` and applying `quote.price` to `unitPrice`.

## 9. Error Handling

The function should handle:

- Missing `symbol`: return HTTP 400.
- Missing `COINMARKETCAP_API_KEY`: return HTTP 500.
- CoinMarketCap authentication errors: return HTTP 502 with a user-safe message.
- CoinMarketCap rate limits: return HTTP 429 or 502 with a user-safe message.
- Missing or invalid price data: return HTTP 404 or 502.

The frontend should not expose raw provider error payloads.

## 10. Testing

Implementation should include focused tests where practical:

- Unit-test the response normalization logic if it is extracted.
- Verify crypto lookup calls `/api/crypto/quote` with the normalized symbol and selected currency.
- Verify stock and fund lookup behavior remains unchanged.
- Manually verify local dev through `pnpm dev:vercel` when a valid key is available.

## 11. Deployment Notes

Before deploying to Vercel:

1. Add `COINMARKETCAP_API_KEY` to Vercel project environment variables.
2. Redeploy after adding or changing the key.
3. Test `/api/crypto/quote?symbol=BTC&convert=USD` on the deployed domain.

## 12. Open Decisions Resolved

- Vite dev proxy alone is not enough because it does not exist in Vercel static deployments.
- Direct browser calls with a `VITE_` API key are rejected because they expose the key.
- A Vercel Function is the chosen proxy because it matches the target deployment platform and keeps the frontend static.
