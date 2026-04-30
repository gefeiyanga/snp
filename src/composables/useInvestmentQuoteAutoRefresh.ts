import { refreshInvestmentAssetQuotes } from '@/services/assetQuoteRefresh';

const REFRESH_INTERVAL_MS = 60 * 1000;
const QUOTES_REFRESHED_EVENT = 'investment-quotes-refreshed';

export function useInvestmentQuoteAutoRefresh() {
  const assetsRepo = useAssetRecords();
  let timer: ReturnType<typeof window.setInterval> | undefined;
  let refreshing = false;

  const refreshQuotes = async () => {
    if (refreshing) return;
    refreshing = true;

    try {
      const assets = await assetsRepo.list();
      const result = await refreshInvestmentAssetQuotes(assets);
      if (result.refreshed > 0) {
        await assetsRepo.saveAll(result.assets);
        window.dispatchEvent(new CustomEvent(QUOTES_REFRESHED_EVENT));
      }
    } catch {
      // Background refresh should never block the app shell.
    } finally {
      refreshing = false;
    }
  };

  onMounted(() => {
    refreshQuotes();
    timer = window.setInterval(refreshQuotes, REFRESH_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (timer) {
      window.clearInterval(timer);
    }
  });

  return {
    refreshQuotes
  };
}

export function onInvestmentQuotesRefreshed(listener: () => void): () => void {
  window.addEventListener(QUOTES_REFRESHED_EVENT, listener);
  return () => window.removeEventListener(QUOTES_REFRESHED_EVENT, listener);
}
