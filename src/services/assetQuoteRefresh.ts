import type { AssetRecord, InvestmentAssetType } from '@/types/ledger';
import { lookupInvestmentQuote } from './marketData';

type QuoteLookup = typeof lookupInvestmentQuote;

export type AssetQuoteRefreshResult = {
  assets: AssetRecord[];
  refreshed: number;
  failed: number;
};

const toMoney = (value: number): number => Math.round(value * 100) / 100;

const normalizeInvestmentType = (investmentType: InvestmentAssetType): InvestmentAssetType =>
  investmentType === 'fund' || investmentType === 'stock' ? 'security' : investmentType;

const shouldTrackQuoteUpdatedAt = (_investmentType: InvestmentAssetType): boolean => true;

const canRefreshQuote = (
  asset: AssetRecord
): asset is AssetRecord & {
  investmentType: InvestmentAssetType;
  quantity: number;
  symbol: string;
} => {
  return !!(
    asset.valuationMode === 'market_quantity' &&
    asset.investmentType &&
    asset.symbol?.trim() &&
    Number(asset.quantity) > 0
  );
};

export async function refreshInvestmentAssetQuotes(
  assets: AssetRecord[],
  lookupQuote: QuoteLookup = lookupInvestmentQuote
): Promise<AssetQuoteRefreshResult> {
  const nextAssets = [...assets];
  let refreshed = 0;
  let failed = 0;

  for (const [index, asset] of assets.entries()) {
    if (!canRefreshQuote(asset)) continue;

    try {
      const quote = await lookupQuote({
        symbol: asset.symbol,
        investmentType: normalizeInvestmentType(asset.investmentType),
        currency: 'CNY'
      });
      const unitPrice = quote.price;
      const investmentType = normalizeInvestmentType(asset.investmentType);
      const exchangeRate = investmentType === 'crypto' ? quote.exchangeRate : undefined;
      const amount =
        investmentType === 'crypto' && exchangeRate !== undefined
          ? asset.quantity * unitPrice * exchangeRate
          : asset.quantity * unitPrice;
      nextAssets[index] = {
        ...asset,
        unitPrice,
        exchangeRate,
        currency: investmentType === 'crypto' ? 'USDT' : 'CNY',
        quoteUpdatedAt: shouldTrackQuoteUpdatedAt(asset.investmentType)
          ? quote.asOf ?? new Date().toISOString()
          : asset.quoteUpdatedAt,
        amount: toMoney(amount)
      };
      refreshed += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    assets: nextAssets,
    refreshed,
    failed
  };
}
