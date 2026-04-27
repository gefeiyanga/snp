# CoinMarketCap 加密货币行情接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 Vercel Function 代理 CoinMarketCap 最新报价接口，让加密货币行情在本地开发和 Vercel 部署后都可用，并且不把 API key 暴露到浏览器。

**Architecture:** 前端继续只调用 `lookupInvestmentQuote()`；当资产类型是 `crypto` 时，服务层请求同域 `/api/crypto/quote`。`api/crypto/quote.ts` 作为 Vercel Function 从服务端环境变量读取 `COINMARKETCAP_API_KEY`，请求当前加密行情供应商 CoinMarketCap，并用 `api/_lib/cryptoQuoteProvider.ts` 暴露统一行情 contract。CoinMarketCap 的 URL、响应字段和错误映射隔离在 `api/_lib/coinMarketCap.ts`，后续更换供应商时不改前端调用形状。

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Vercel Functions, CoinMarketCap Cryptocurrency Quotes Latest API.

---

## 文件结构

- Create: `api/_lib/cryptoQuoteProvider.ts`
  - 定义服务端加密行情的统一类型、错误类型和 provider 函数签名。
- Create: `api/_lib/coinMarketCap.ts`
  - 负责 CoinMarketCap 请求 URL 构建、响应解析和 provider 实现；不得把 CoinMarketCap 原始字段泄漏给前端。
- Create: `api/_lib/coinMarketCap.test.ts`
  - 覆盖响应解析、缺失价格、错误状态等纯函数逻辑。
- Create: `api/crypto/quote.ts`
  - Vercel Function。读取 query 后调用统一 provider 函数，返回规范 JSON；不直接解析 CoinMarketCap 响应。
- Modify: `src/services/marketData.ts`
  - 移除 Binance crypto 调用。crypto 改为调用 `/api/crypto/quote`。
- Create: `src/services/marketData.test.ts`
  - 验证 crypto lookup 的请求路径、symbol/currency 规范化，以及股票/基金仍走现有逻辑入口。
- Modify: `src/components/ModernBottomSheet.vue`
  - 更新行情状态文案：加密货币不再显示“Binance 免 Key”或“免 Key”。
- Modify: `package.json`
  - 增加 `dev:vercel` 脚本和 `vercel` devDependency。
- Modify: `vitest.config.ts`
  - 让 Vitest 覆盖 `api/**/*.test.ts`。
- Modify: `tsconfig.json`
  - 将 `api/**/*.ts` 纳入 TS 项目检查。
- Optional Modify: `.env.example`
  - 如果仓库已有示例 env，则新增 `COINMARKETCAP_API_KEY=`。当前仓库未发现该文件时不新建，避免引入额外配置面。

---

### Task 1: 加密行情 Provider 边界和 CoinMarketCap 适配器

**Files:**
- Create: `api/_lib/cryptoQuoteProvider.ts`
- Create: `api/_lib/coinMarketCap.ts`
- Create: `api/_lib/coinMarketCap.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: 写失败测试**

Create `api/_lib/coinMarketCap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCoinMarketCapUrl, normalizeCoinMarketCapQuote } from './coinMarketCap';

describe('buildCoinMarketCapUrl', () => {
  it('builds the latest quote url with normalized params', () => {
    const url = buildCoinMarketCapUrl('btc', 'usd');

    expect(url.toString()).toBe(
      'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=BTC&convert=USD'
    );
  });
});

describe('normalizeCoinMarketCapQuote', () => {
  it('normalizes the first quote for a symbol and convert currency', () => {
    const result = normalizeCoinMarketCapQuote(
      {
        data: {
          BTC: [
            {
              symbol: 'BTC',
              quote: {
                USD: {
                  price: 65000.1234,
                  last_updated: '2026-04-27T10:12:30.000Z'
                }
              }
            }
          ]
        }
      },
      'btc',
      'usd'
    );

    expect(result).toEqual({
      price: 65000.1234,
      source: 'coinmarketcap',
      asOf: '2026-04-27T10:12:30.000Z',
      symbol: 'BTC',
      convert: 'USD'
    });
  });

  it('throws a user-safe error when quote data is missing', () => {
    expect(() => normalizeCoinMarketCapQuote({ data: {} }, 'BTC', 'USD')).toThrow(
      '未查到有效的加密货币价格，请确认代码和币种'
    );
  });

  it('throws a user-safe error when price is invalid', () => {
    expect(() =>
      normalizeCoinMarketCapQuote(
        {
          data: {
            BTC: [
              {
                symbol: 'BTC',
                quote: {
                  USD: {
                    price: 0,
                    last_updated: '2026-04-27T10:12:30.000Z'
                  }
                }
              }
            ]
          }
        },
        'BTC',
        'USD'
      )
    ).toThrow('未查到有效的加密货币价格，请确认代码和币种');
  });
});
```

Modify `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
    globals: false
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test -- api/_lib/coinMarketCap.test.ts
```

Expected: FAIL，原因是 `./coinMarketCap` 文件或导出函数不存在。

- [ ] **Step 3: 实现最小解析模块**

Create `api/_lib/cryptoQuoteProvider.ts`:

```ts
export type CryptoQuoteRequest = {
  symbol: string;
  convert: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
};

export type CryptoQuoteResponse = {
  price: number;
  source: 'coinmarketcap';
  asOf?: string;
  symbol: string;
  convert: string;
};

export type CryptoQuoteProvider = (request: CryptoQuoteRequest) => Promise<CryptoQuoteResponse>;

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
  return (value || 'USD').trim().toUpperCase();
}
```

Create `api/_lib/coinMarketCap.ts`:

```ts
import {
  PublicApiError,
  type CryptoQuoteProvider,
  type CryptoQuoteResponse,
  normalizeConvert,
  normalizeSymbol
} from './cryptoQuoteProvider';

const COINMARKETCAP_QUOTES_URL = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest';

type CoinMarketCapQuoteCurrency = {
  price?: unknown;
  last_updated?: unknown;
};

type CoinMarketCapAsset = {
  symbol?: unknown;
  quote?: Record<string, CoinMarketCapQuoteCurrency | undefined>;
};

export type CoinMarketCapResponse = {
  data?: Record<string, CoinMarketCapAsset | CoinMarketCapAsset[] | undefined>;
};

export function buildCoinMarketCapUrl(symbol: string, convert: string): URL {
  const url = new URL(COINMARKETCAP_QUOTES_URL);
  url.searchParams.set('symbol', normalizeSymbol(symbol));
  url.searchParams.set('convert', normalizeConvert(convert));
  return url;
}

export function normalizeCoinMarketCapQuote(
  payload: CoinMarketCapResponse,
  symbolInput: string,
  convertInput: string
): CryptoQuoteResponse {
  const symbol = normalizeSymbol(symbolInput);
  const convert = normalizeConvert(convertInput);
  const rawAsset = payload.data?.[symbol];
  const asset = Array.isArray(rawAsset) ? rawAsset[0] : rawAsset;
  const quote = asset?.quote?.[convert];
  const price = Number(quote?.price);

  if (!Number.isFinite(price) || price <= 0) {
    throw new PublicApiError('未查到有效的加密货币价格，请确认代码和币种', 404);
  }

  return {
    price,
    source: 'coinmarketcap',
    asOf: typeof quote?.last_updated === 'string' ? quote.last_updated : undefined,
    symbol: typeof asset?.symbol === 'string' ? asset.symbol : symbol,
    convert
  };
}

function errorMessageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'CoinMarketCap API key 无效或无权限';
  if (status === 429) return 'CoinMarketCap 查询频率受限，请稍后再试';
  return `CoinMarketCap 行情请求失败：HTTP ${status}`;
}

export const fetchCoinMarketCapQuote: CryptoQuoteProvider = async ({
  symbol,
  convert,
  apiKey,
  fetchImpl = fetch
}) => {
  const upstream = await fetchImpl(buildCoinMarketCapUrl(symbol, convert), {
    headers: {
      Accept: 'application/json',
      'X-CMC_PRO_API_KEY': apiKey
    }
  });

  if (!upstream.ok) {
    throw new PublicApiError(errorMessageForStatus(upstream.status), upstream.status === 429 ? 429 : 502);
  }

  return normalizeCoinMarketCapQuote(await upstream.json(), symbol, convert);
};
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm test -- api/_lib/coinMarketCap.test.ts
```

Expected: PASS，3 个测试通过。

- [ ] **Step 5: 提交**

```bash
git add api/_lib/cryptoQuoteProvider.ts api/_lib/coinMarketCap.ts api/_lib/coinMarketCap.test.ts vitest.config.ts
git commit -m "test: add coinmarketcap quote normalization"
```

---

### Task 2: Vercel Function 代理接口

**Files:**
- Create: `api/crypto/quote.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: 写 API handler**

Create `api/crypto/quote.ts`:

```ts
import {
  PublicApiError,
  normalizeConvert,
  normalizeSymbol
} from '../_lib/cryptoQuoteProvider';
import {
  fetchCoinMarketCapQuote
} from '../_lib/coinMarketCap';

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

export default async function handler(request: VercelRequest, response: VercelResponse) {
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
```

Modify `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue", "src/types/**/*.d.ts", "api/**/*.ts"],
  "references": [
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
```

- [ ] **Step 2: 运行类型检查**

Run:

```bash
pnpm exec vue-tsc --noEmit
```

Expected: PASS。若失败且原因是现有 Vue 文件编码/模板问题，记录失败输出，不在本任务中重构无关 UI。

- [ ] **Step 3: 提交**

```bash
git add api/crypto/quote.ts tsconfig.json
git commit -m "feat: add coinmarketcap vercel quote api"
```

---

### Task 3: 前端行情服务切换到代理接口

**Files:**
- Modify: `src/services/marketData.ts`
- Create: `src/services/marketData.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/services/marketData.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupInvestmentQuote, requiresApiKeyForInvestmentType } from './marketData';

describe('marketData crypto lookup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the local crypto quote api with normalized symbol and currency', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        price: 65000.12,
        source: 'coinmarketcap',
        asOf: '2026-04-27T10:12:30.000Z',
        symbol: 'BTC',
        convert: 'USD'
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupInvestmentQuote({
      symbol: ' btc ',
      investmentType: 'crypto',
      currency: 'USD'
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/crypto/quote?symbol=BTC&convert=USD');
    expect(result).toEqual({
      price: 65000.12,
      source: 'coinmarketcap',
      asOf: '2026-04-27T10:12:30.000Z'
    });
  });

  it('surfaces the proxy error message without changing it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'CoinMarketCap 查询频率受限，请稍后再试' })
      })
    );

    await expect(
      lookupInvestmentQuote({
        symbol: 'BTC',
        investmentType: 'crypto',
        currency: 'USD'
      })
    ).rejects.toThrow('CoinMarketCap 查询频率受限，请稍后再试');
  });

  it('requires server-side key support for crypto as well as stocks and funds', () => {
    expect(requiresApiKeyForInvestmentType('crypto')).toBe(false);
    expect(requiresApiKeyForInvestmentType('stock')).toBe(true);
    expect(requiresApiKeyForInvestmentType('fund')).toBe(true);
  });
});
```

Note: `requiresApiKeyForInvestmentType('crypto')` remains `false` because the browser does not need a browser-visible key. The server-side key is validated by `/api/crypto/quote`.

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm test -- src/services/marketData.test.ts
```

Expected: FAIL，原因是当前实现仍请求 Binance，返回 source 仍为 `binance`。

- [ ] **Step 3: 修改前端服务**

Replace `src/services/marketData.ts` with:

```ts
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
  const url = new URL(CRYPTO_QUOTE_API_PATH, window.location.origin);
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('convert', currency);

  const response = await fetch(`${url.pathname}${url.search}`);
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
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm test -- src/services/marketData.test.ts
```

Expected: PASS，3 个测试通过。

- [ ] **Step 5: 提交**

```bash
git add src/services/marketData.ts src/services/marketData.test.ts
git commit -m "feat: use coinmarketcap proxy for crypto quotes"
```

---

### Task 4: UI 文案和本地开发脚本

**Files:**
- Modify: `src/components/ModernBottomSheet.vue`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: 更新 package 脚本和依赖**

Run:

```bash
pnpm add -D vercel
```

Then ensure `package.json` scripts include:

```json
{
  "scripts": {
    "dev": "vite --port 3001",
    "dev:vercel": "vercel dev",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "oxlint",
    "format": "oxfmt",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: 更新 UI 行情文案**

In `src/components/ModernBottomSheet.vue`, replace the two status paths that mention crypto being keyless or Binance.

Change popup-open initialization to:

```ts
quoteStatusText.value =
  requiresApiKey.value && !hasMarketDataApiKey()
    ? '股票/基金需配置 API Key；加密货币走 CoinMarketCap 代理'
    : '可按类型查询价格';
```

Change investment type watcher to:

```ts
quoteStatusText.value =
  requiresApiKeyForInvestmentType(value) && !hasMarketDataApiKey()
    ? '股票/基金需配置 API Key；加密货币走 CoinMarketCap 代理'
    : value === 'crypto'
      ? '加密货币走 CoinMarketCap 代理'
      : '可按类型查询价格';
```

- [ ] **Step 3: 运行格式化**

Run:

```bash
pnpm exec oxfmt --write package.json src/components/ModernBottomSheet.vue
```

Expected: command exits 0。

- [ ] **Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml src/components/ModernBottomSheet.vue
git commit -m "chore: add vercel dev script for crypto quotes"
```

---

### Task 5: 全量验证

**Files:**
- No new files expected.

- [ ] **Step 1: 运行行情相关单测**

Run:

```bash
pnpm test -- api/_lib/coinMarketCap.test.ts src/services/marketData.test.ts
```

Expected: PASS。

- [ ] **Step 2: 运行全部单测**

Run:

```bash
pnpm test
```

Expected: PASS。若失败来自既有无关测试，记录失败测试名和输出。

- [ ] **Step 3: 运行类型检查**

Run:

```bash
pnpm exec vue-tsc --noEmit
```

Expected: PASS。若现有 Vue 文件因编码/模板问题失败，记录输出，并只修复与本功能直接相关的新增类型错误。

- [ ] **Step 4: 构建**

Run:

```bash
pnpm build
```

Expected: PASS，生成 `dist/`。

- [ ] **Step 5: 本地 Vercel Function 手动验证**

Add local env before running:

```env
COINMARKETCAP_API_KEY=your_key_here
```

Run:

```bash
pnpm dev:vercel
```

In another terminal, call the local endpoint:

```bash
curl "http://localhost:3000/api/crypto/quote?symbol=BTC&convert=USD"
```

Expected JSON shape:

```json
{
  "price": 65000.12,
  "source": "coinmarketcap",
  "asOf": "2026-04-27T10:12:30.000Z",
  "symbol": "BTC",
  "convert": "USD"
}
```

Actual price and timestamp will differ.

- [ ] **Step 6: 最终提交或确认无改动**

Run:

```bash
git status --short
```

Expected: clean. If verification generated tracked changes, review them and commit only intentional changes.

---

## 自查结果

- Spec coverage: 覆盖了 Vercel Function、服务端环境变量、本地 `vercel dev`、前端统一入口、错误处理、测试和部署说明。
- 占位内容扫描: 没有 `TBD`、`TODO` 或未定义的“稍后实现”步骤。
- Type consistency: `source` 使用 `coinmarketcap`；前端 `QuoteLookupResult` 只保留页面需要的 `price/source/asOf`；API 响应额外包含 `symbol/convert`。
- Provider flexibility: 前端和 Vercel Function 只依赖统一 `CryptoQuoteProvider` contract；CoinMarketCap 专属字段、URL 和错误码映射都在 `coinMarketCap.ts` 内部，后续新增供应商时可新增 adapter 并在 `api/crypto/quote.ts` 切换调用。
