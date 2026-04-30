import type { AssetCurrency, AssetRecord, InvestmentAssetType } from '@/types/ledger';
import { lookupInvestmentQuote } from './marketData';

type QuoteLookup = typeof lookupInvestmentQuote;

export type AssetQuoteRefreshResult = {
  assets: AssetRecord[];
  refreshed: number;
  failed: number;
};

const toMoney = (value: number): number => Math.round(value * 100) / 100;

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
        investmentType: asset.investmentType,
        currency: (asset.currency ?? 'CNY') as AssetCurrency
      });
      const unitPrice = quote.price;
      nextAssets[index] = {
        ...asset,
        unitPrice,
        amount: toMoney(asset.quantity * unitPrice)
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
