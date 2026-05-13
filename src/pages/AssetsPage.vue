<script setup lang="ts">
import { ref, onMounted, onActivated } from 'vue';
import { useRouter } from 'vue-router';
import ModernBottomSheet from '@/components/ModernBottomSheet.vue';
import { useAssetRecords, useLiabilityRecords } from '@/composables/useFinancialLedger';
import { calculateInvestmentReturn } from '@/domain/investmentReturns';
import { formatAmount, formatPercent, formatSignedAmount } from '@/utils/amountDisplay';
import type { AssetRecord, LedgerFormPayload } from '@/types/ledger';

const router = useRouter();
const assetsRepo = useAssetRecords();
const liabilityRepo = useLiabilityRecords();

const showAddAssetSheet = ref(false);
const assetInitialData = ref<Record<string, unknown>>({});

const assetsByCategory = ref<any[]>([]);

const assetCategories = [
  {
    name: '现金',
    aliases: ['现金'],
    icon: 'gold-coin-o',
    wrap: 'emerald'
  },
  {
    name: '银行',
    aliases: ['银行', '银行资金'],
    icon: 'balance-o',
    wrap: 'blue'
  },
  {
    name: '投资',
    aliases: ['投资'],
    icon: 'chart-trending-o',
    wrap: 'amber'
  },
  {
    name: '其他',
    aliases: ['其他', '房产', '不动产', '汽车', '车辆'],
    icon: 'more-o',
    wrap: 'gray'
  }
];

const totalAssets = ref(0);
const totalLiabilities = ref(0);
const netWorth = ref(0);

const loadAssets = async () => {
  const assets = await assetsRepo.list();
  const liabilities = await liabilityRepo.list();

  const categorizedAssets: any[] = [];
  assetCategories.forEach((category) => {
    const categoryAssets = assets.filter((asset) => category.aliases.includes(asset.category));
    const totalAmount = categoryAssets.reduce((sum, asset) => sum + (asset.amount || 0), 0);
    const investmentReturns = categoryAssets.map(calculateInvestmentReturn).filter((item) => item !== null);
    const investmentProfit = investmentReturns.reduce((sum, item) => sum + item.profit, 0);
    const investmentCost = investmentReturns.reduce((sum, item) => sum + item.costAmount, 0);

    categorizedAssets.push({
      ...category,
      assets: categoryAssets,
      totalAmount,
      investmentProfit,
      investmentReturnRate: investmentCost > 0 ? investmentProfit / investmentCost : null
    });
  });

  assetsByCategory.value = categorizedAssets;

  totalAssets.value = assets.reduce((sum, asset) => sum + (asset.amount || 0), 0);
  totalLiabilities.value = liabilities.reduce(
    (sum, liability) => sum + (liability.remaining ?? liability.amount ?? 0),
    0
  );
  netWorth.value = totalAssets.value - totalLiabilities.value;
};

let stopQuoteRefreshListener: (() => void) | undefined;

onMounted(() => {
  loadAssets();
  stopQuoteRefreshListener = onInvestmentQuotesRefreshed(loadAssets);
});

onUnmounted(() => {
  stopQuoteRefreshListener?.();
});

onActivated(() => {
  loadAssets();
});

const goHome = () => {
  router.push('/');
};

const goCategory = (name: string) => {
  router.push({ name: 'AssetCategory', params: { name } });
};

const addAsset = () => {
  assetInitialData.value = {};
  showAddAssetSheet.value = true;
};

const onSaveAsset = async (data: Record<string, unknown>) => {
  await assetsRepo.upsertFromForm(data as LedgerFormPayload);
  await loadAssets();
};

const formatCurrency = (value: number) => {
  return formatAmount(value);
};

const formatSignedCurrency = (value: number) => {
  return formatSignedAmount(value);
};

const investmentSummary = (asset: AssetRecord) => {
  if (asset.category !== '投资' || !asset.quantity) return asset.name;
  return [asset.symbol || asset.name, `${asset.quantity}`].filter(Boolean).join(' · ');
};

const categoryReturnText = (category: any) => {
  if (category.name !== '投资' || category.investmentReturnRate === null) return '';
  return `${formatSignedCurrency(category.investmentProfit)} · ${formatPercent(category.investmentReturnRate)}`;
};

const categoryReturnClass = (category: any) => {
  if (category.investmentProfit > 0) return 'gain';
  if (category.investmentProfit < 0) return 'loss';
  return 'flat';
};

const categorySubtitle = (category: any) => {
  const n = category.assets.length;
  if (n === 0) return '暂无记录';
  const returnText = categoryReturnText(category);
  if (returnText) return `${n} 笔记录 · ${returnText}`;
  const names = category.assets.map((a: AssetRecord) => investmentSummary(a)).slice(0, 2).join(' + ');
  const more = n > 2 ? '…' : '';
  return `${n} 笔记录 · ${names}${more}`;
};

</script>

<template>
  <div class="assets-page">
    <div class="page-max">
    <header class="page-header safe-top sticky-head">
      <button type="button" class="icon-btn plain" aria-label="返回" @click="goHome">
        <van-icon name="arrow-left" size="20" color="#374151" />
      </button>
      <h1 class="page-title">资产</h1>
      <button type="button" class="icon-btn" aria-label="新增资产" @click="addAsset">
        <van-icon name="plus" size="20" color="#4b5563" />
      </button>
    </header>

    <div class="hero-wrap">
      <div class="hero-card">
        <div class="hero-deco hero-deco-a" aria-hidden="true" />
        <div class="hero-deco hero-deco-b" aria-hidden="true" />
        <p class="hero-label">总资产</p>
        <h2 class="hero-amount">{{ formatCurrency(totalAssets) }}</h2>
        <div class="hero-split">
          <div class="hero-split-item">
            <p class="hero-meta-label">净资产</p>
            <p class="hero-meta-value">{{ formatCurrency(netWorth) }}</p>
          </div>
          <div class="hero-divider" />
          <div class="hero-split-item">
            <p class="hero-meta-label">较上月</p>
            <p class="hero-meta-value muted">暂无对比数据</p>
          </div>
        </div>
      </div>
    </div>

    <section class="section">
      <h3 class="section-title">资产类别</h3>
      <div class="cat-grid">
        <div
          v-for="category in assetsByCategory"
          :key="category.name"
          class="cat-card press"
          role="button"
          tabindex="0"
          @click="goCategory(category.name)"
        >
          <div class="cat-icon wrap-gray">
            <van-icon :name="category.icon" size="20" class="cat-icon-inner" />
          </div>
          <p class="cat-name">{{ category.name }}</p>
          <p class="cat-value">{{ formatCurrency(category.totalAmount) }}</p>
          <p
            class="cat-meta"
            :class="categoryReturnText(category) ? categoryReturnClass(category) : ''"
          >
            {{ categoryReturnText(category) || `${category.assets.length} 笔记录` }}
          </p>
        </div>
      </div>
    </section>

    <section class="section section-list">
      <h3 class="section-title">明细列表</h3>
      <div class="list-card">
        <div
          v-for="(category, index) in assetsByCategory"
          :key="category.name"
          class="list-row press"
          :class="{ 'is-last': index === assetsByCategory.length - 1 }"
          role="button"
          tabindex="0"
          @click="goCategory(category.name)"
        >
          <div class="list-left">
            <div>
              <p class="list-name">{{ category.name }}</p>
              <p class="list-sub">{{ categorySubtitle(category) }}</p>
            </div>
          </div>
          <div class="list-right">
            <span class="list-amt">{{ formatCurrency(category.totalAmount) }}</span>
            <van-icon name="arrow" size="14" color="#d1d5db" />
          </div>
        </div>
      </div>
    </section>

    <ModernBottomSheet
      v-model="showAddAssetSheet"
      title="新增资产"
      mode="create"
      type="asset"
      :initial-data="assetInitialData"
      submit-text="添加资产"
      @submit="onSaveAsset"
    />
    </div>
  </div>
</template>

<style lang="less" scoped>
@import (reference) '@/styles/finance-theme.less';

.assets-page {
  min-height: 100%;
  background: @finance-page-bg;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}

.page-max {
  max-width: 28rem;
  margin: 0 auto;
}

.safe-top {
  padding-top: max(env(safe-area-inset-top, 0px), 12px);
}

.sticky-head {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 10px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #f3f4f6;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;

  &:active {
    background: #f3f4f6;
  }

  &.plain {
    background: transparent;

    &:active {
      background: #f3f4f6;
    }
  }
}

.wrap-emerald .cat-icon-inner {
  color: #059669;
}

.wrap-blue .cat-icon-inner {
  color: #2563eb;
}

.wrap-amber .cat-icon-inner {
  color: #d97706;
}

.wrap-indigo .cat-icon-inner {
  color: #4f46e5;
}

.wrap-gray .cat-icon-inner {
  color: #4b5563;
}

.hero-wrap {
  padding: 16px 20px 0;
}

.hero-card {
  position: relative;
  min-height: 150px;
  border-radius: 16px;
  padding: 24px;
  overflow: hidden;
  color: #111827;
  background: #fff;
  box-shadow: @finance-card-shadow;
  border: 1px solid rgba(15, 23, 42, 0.04);

}

.hero-deco {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
}

.hero-deco-a {
  right: -34px;
  top: -38px;
  width: 132px;
  height: 132px;
  background: #ecfdf5;
  opacity: 0.86;
}

.hero-deco-b {
  right: 24px;
  bottom: -44px;
  width: 104px;
  height: 104px;
  background: #f0fdf4;
  opacity: 0.68;
}

.hero-label {
  position: relative;
  z-index: 1;
  margin: 0 0 4px;
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.hero-amount {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 0;
  color: #111827;
  font-variant-numeric: tabular-nums;
}

.hero-split {
  position: relative;
  z-index: 1;
  display: flex;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eef0f3;
}

.hero-split-item {
  flex: 1;
}

.hero-divider {
  width: 1px;
  background: #eef0f3;
  margin: 0 16px;
}

.hero-meta-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #9ca3af;
}

.hero-meta-value {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;

  &.muted {
    color: #9ca3af;
    font-weight: 500;
  }
}

.section {
  padding: 24px 20px 0;
}

.section-list {
  margin-top: 4px;
}

.section-title {
  margin: 0 0 12px 4px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.cat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.cat-card {
  min-height: 128px;
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: @finance-card-shadow;
  border: 1px solid rgba(15, 23, 42, 0.04);
}

.cat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;

  &.wrap-emerald {
    background: #ecfdf5;
  }

  &.wrap-blue {
    background: #eff6ff;
  }

  &.wrap-amber {
    background: #fffbeb;
  }

  &.wrap-indigo {
    background: #eef2ff;
  }

  &.wrap-gray {
    background: #f9fafb;
  }
}

.cat-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.cat-value {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.cat-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;

  &.gain {
    color: #dc2626;
    font-weight: 600;
  }

  &.loss {
    color: #059669;
    font-weight: 600;
  }

  &.flat {
    color: #6b7280;
    font-weight: 600;
  }
}

.list-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: @finance-card-shadow;
  border: 1px solid rgba(15, 23, 42, 0.04);
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #fafafa;
  cursor: default;

  &.is-last {
    border-bottom: none;
  }

  &:active {
    background: #f9fafb;
  }
}

.list-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.list-name {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #111827;
}

.list-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.list-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.list-amt {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  font-variant-numeric: tabular-nums;
}

.press:active {
  transform: scale(0.99);
  transition: transform 0.1s;
}
</style>
