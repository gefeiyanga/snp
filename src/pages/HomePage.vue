<script setup lang="ts">
import { computed, onMounted, onActivated, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAssetRecords, useLiabilityRecords } from '@/composables/useFinancialLedger';

type DistributionItem = {
  name: string;
  value: number;
  color: string;
};

const router = useRouter();
const assetsRepo = useAssetRecords();
const liabilityRepo = useLiabilityRecords();

const totalAssets = ref(0);
const totalLiabilities = ref(0);
const netWorth = ref(0);

const ASSET_CATEGORY_DEF: { name: string; aliases: string[]; color: string }[] = [
  { name: '现金', aliases: ['现金'], color: '#10b981' },
  { name: '银行', aliases: ['银行', '银行资金'], color: '#3b82f6' },
  { name: '投资', aliases: ['投资'], color: '#f59e0b' },
  { name: '其他', aliases: ['其他', '房产', '不动产', '汽车', '车辆'], color: '#ec4899' }
];

const LIABILITY_CATEGORY_DEF: { name: string; color: string }[] = [
  { name: '房贷', color: '#3b82f6' },
  { name: '车贷', color: '#f87171' },
  { name: '信用卡', color: '#eab308' },
  { name: '其他', color: '#94a3b8' }
];

const assetDistribution = ref<DistributionItem[]>([]);
const liabilityDistribution = ref<DistributionItem[]>([]);

const CHART_RADIUS = 38;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;

const buildDonutSegments = (list: DistributionItem[]) => {
  const total = list.reduce((sum, item) => sum + item.value, 0);
  let accumulated = 0;

  return list.map((item) => {
    const ratio = total > 0 ? item.value / total : 0;
    const length = ratio * CHART_CIRCUMFERENCE;
    const segment = {
      color: item.color,
      dasharray: `${length} ${CHART_CIRCUMFERENCE - length}`,
      dashoffset: -accumulated
    };
    accumulated += length;
    return segment;
  });
};

const assetSegments = computed(() => buildDonutSegments(assetDistribution.value));
const liabilitySegments = computed(() => buildDonutSegments(liabilityDistribution.value));
const assetChartTotal = computed(() => assetDistribution.value.reduce((sum, item) => sum + item.value, 0));
const liabilityChartTotal = computed(() => liabilityDistribution.value.reduce((sum, item) => sum + item.value, 0));

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0
  }).format(value);
};

const formatCompactWan = (value: number) => {
  if (value >= 10000) {
    const wan = value / 10000;
    const text = wan >= 100 ? wan.toFixed(0) : wan.toFixed(1).replace(/\.0$/, '');
    return `${text}万`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}千`;
  }
  return formatCurrency(value);
};

const legendPercent = (item: DistributionItem, total: number) => {
  if (total <= 0) return '0%';
  return `${((item.value / total) * 100).toFixed(1)}%`;
};

const fetchData = async () => {
  const assets = await assetsRepo.list();
  const liabilities = await liabilityRepo.list();

  totalAssets.value = assets.reduce((sum, asset) => sum + (asset.amount || 0), 0);
  totalLiabilities.value = liabilities.reduce((sum, liability) => sum + (liability.remaining ?? liability.amount ?? 0), 0);
  netWorth.value = totalAssets.value - totalLiabilities.value;

  const assetBuckets: DistributionItem[] = [];
  for (const def of ASSET_CATEGORY_DEF) {
    const amount = assets
      .filter((a) => def.aliases.includes(a.category))
      .reduce((s, a) => s + (a.amount || 0), 0);
    if (amount > 0) {
      assetBuckets.push({ name: def.name, value: amount, color: def.color });
    }
  }
  assetDistribution.value = assetBuckets;

  const liabilityBuckets: DistributionItem[] = [];
  for (const def of LIABILITY_CATEGORY_DEF) {
    const amount = liabilities
      .filter((l) => l.category === def.name)
      .reduce((s, l) => s + (l.remaining ?? l.amount ?? 0), 0);
    if (amount > 0) {
      liabilityBuckets.push({ name: def.name, value: amount, color: def.color });
    }
  }
  liabilityDistribution.value = liabilityBuckets;
};

let stopQuoteRefreshListener: (() => void) | undefined;

onMounted(() => {
  fetchData();
  stopQuoteRefreshListener = onInvestmentQuotesRefreshed(fetchData);
});

onUnmounted(() => {
  stopQuoteRefreshListener?.();
});

onActivated(() => {
  fetchData();
});

const goToAssets = () => {
  router.push('/assets');
};

const goToLiabilities = () => {
  router.push('/liabilities');
};
</script>

<template>
  <div class="home-page">
    <div class="page-inner">
      <div class="hero-bg" aria-hidden="true" />

      <header class="page-header safe-top">
        <h1 class="page-title">资产总览</h1>
      </header>

      <section class="hero-card-wrap animate-in" style="animation-delay: 0.05s">
        <div class="hero-card">
          <div class="hero-blob hero-blob-a" aria-hidden="true" />
          <div class="hero-blob hero-blob-b" aria-hidden="true" />
          <div class="hero-inner">
            <p class="hero-label">净资产</p>
            <h2 class="hero-amount">{{ formatCurrency(netWorth) }}</h2>
            <div class="hero-row-meta">
              <span class="pill-muted">总资产 − 总负债</span>
            </div>
            <div class="hero-split">
              <button type="button" class="hero-split-item hero-link" @click="goToAssets">
                <span class="hero-link-head">
                  <span class="hero-split-label">总资产</span>
                  <van-icon name="arrow" size="14" color="#9ca3af" />
                </span>
                <span class="hero-split-value">{{ formatCurrency(totalAssets) }}</span>
              </button>
              <div class="hero-divider" />
              <button type="button" class="hero-split-item hero-link" @click="goToLiabilities">
                <span class="hero-link-head">
                  <span class="hero-split-label">总负债</span>
                  <van-icon name="arrow" size="14" color="#9ca3af" />
                </span>
                <span class="hero-split-value debt">{{ formatCurrency(totalLiabilities) }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel animate-in" style="animation-delay: 0.1s">
        <div class="panel-head">
          <h3 class="panel-title">资产分布</h3>
          <span class="panel-total assets">{{ formatCurrency(assetChartTotal) }}</span>
        </div>
        <div class="panel-body">
          <div class="donut-wrap">
            <svg class="donut-svg" viewBox="0 0 100 100" width="112" height="112" aria-label="资产分布">
              <circle cx="50" cy="50" :r="CHART_RADIUS" fill="none" stroke="#f3f4f6" stroke-width="10" />
              <g :transform="`rotate(-90 50 50)`">
                <circle
                  v-for="(segment, index) in assetSegments"
                  :key="`a-${index}`"
                  cx="50"
                  cy="50"
                  :r="CHART_RADIUS"
                  fill="none"
                  stroke-width="10"
                  stroke-linecap="round"
                  class="chart-ring"
                  :stroke="segment.color"
                  :stroke-dasharray="segment.dasharray"
                  :stroke-dashoffset="segment.dashoffset"
                />
              </g>
            </svg>
            <div class="donut-center">
              <span class="donut-center-label">总资产</span>
              <span class="donut-center-value">{{ formatCompactWan(assetChartTotal) }}</span>
            </div>
          </div>
          <div class="legend">
            <div v-for="item in assetDistribution" :key="item.name" class="legend-row">
              <div class="legend-left">
                <span class="legend-dot" :style="{ backgroundColor: item.color }" />
                <span class="legend-name">{{ item.name }}</span>
              </div>
              <div class="legend-right">
                <p class="legend-amount">{{ formatCurrency(item.value) }}</p>
                <p class="legend-pct">{{ legendPercent(item, assetChartTotal) }}</p>
              </div>
            </div>
            <p v-if="!assetDistribution.length" class="empty-hint">暂无资产数据</p>
          </div>
        </div>
      </section>

      <section class="panel panel-last animate-in" style="animation-delay: 0.2s">
        <div class="panel-head">
          <h3 class="panel-title">负债分布</h3>
          <span class="panel-total liability">{{ formatCurrency(liabilityChartTotal) }}</span>
        </div>
        <div class="panel-body">
          <div class="donut-wrap">
            <svg class="donut-svg" viewBox="0 0 100 100" width="112" height="112" aria-label="负债分布">
              <circle cx="50" cy="50" :r="CHART_RADIUS" fill="none" stroke="#f3f4f6" stroke-width="10" />
              <g :transform="`rotate(-90 50 50)`">
                <circle
                  v-for="(segment, index) in liabilitySegments"
                  :key="`l-${index}`"
                  cx="50"
                  cy="50"
                  :r="CHART_RADIUS"
                  fill="none"
                  stroke-width="10"
                  stroke-linecap="round"
                  class="chart-ring"
                  :stroke="segment.color"
                  :stroke-dasharray="segment.dasharray"
                  :stroke-dashoffset="segment.dashoffset"
                />
              </g>
            </svg>
            <div class="donut-center">
              <span class="donut-center-label">总负债</span>
              <span class="donut-center-value">{{ formatCompactWan(liabilityChartTotal) }}</span>
            </div>
          </div>
          <div class="legend">
            <div v-for="item in liabilityDistribution" :key="item.name" class="legend-row">
              <div class="legend-left">
                <span class="legend-dot" :style="{ backgroundColor: item.color }" />
                <span class="legend-name">{{ item.name }}</span>
              </div>
              <div class="legend-right">
                <p class="legend-amount">{{ formatCurrency(item.value) }}</p>
                <p class="legend-pct">{{ legendPercent(item, liabilityChartTotal) }}</p>
              </div>
            </div>
            <p v-if="!liabilityDistribution.length" class="empty-hint">暂无负债数据</p>
          </div>
        </div>
      </section>

      <div class="bottom-spacer" />
    </div>
  </div>
</template>

<style lang="less" scoped>
@import (reference) '@/styles/finance-theme.less';

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.home-page {
  min-height: 100%;
  background: @finance-page-bg;
  color: #111827;
  position: relative;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.page-inner {
  max-width: 28rem;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  min-height: 100%;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 18rem;
  background: linear-gradient(to bottom, #2563eb, #3b82f6, #f9fafb);
  opacity: 0.03;
  pointer-events: none;
}

.safe-top {
  padding-top: max(env(safe-area-inset-top, 0px), 12px);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px 8px;
  position: relative;
  z-index: 2;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 9999px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;

  &:active {
    background: #e5e7eb;
  }
}

.animate-in {
  opacity: 0;
  animation: fade-up 0.5s ease forwards;
}

.hero-card-wrap {
  padding: 0 20px;
  margin-top: 8px;
}

.hero-card {
  position: relative;
  background: #fff;
  border-radius: 24px;
  padding: 24px;
  overflow: hidden;
  box-shadow: @finance-card-shadow;
}

.hero-blob {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
}

.hero-blob-a {
  right: -32px;
  top: -32px;
  width: 128px;
  height: 128px;
  background: #eff6ff;
  opacity: 0.6;
}

.hero-blob-b {
  right: -16px;
  bottom: -16px;
  width: 96px;
  height: 96px;
  background: #ecfdf5;
  opacity: 0.4;
}

.hero-inner {
  position: relative;
  z-index: 1;
}

.hero-label {
  margin: 0 0 4px;
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.hero-amount {
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #111827;
}

.hero-row-meta {
  margin-top: 12px;
}

.pill-muted {
  font-size: 12px;
  color: #9ca3af;
}

.hero-split {
  display: flex;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
}

.hero-split-item {
  flex: 1;
}

.hero-link {
  border: none;
  background: transparent;
  padding: 8px 0;
  text-align: left;
  cursor: pointer;

  &:active {
    opacity: 0.72;
  }
}

.hero-link-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hero-divider {
  width: 1px;
  background: #f3f4f6;
  margin: 0 16px;
}

.hero-split-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #9ca3af;
}

.hero-split-value {
  display: block;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;

  &.debt {
    color: #e11d48;
  }
}

.press:active {
  transform: scale(0.98);
  transition: transform 0.1s;
}

.panel {
  margin: 24px 20px 0;
  background: #fff;
  border-radius: 24px;
  padding: 20px;
  box-shadow: @finance-card-shadow;
}

.panel-last {
  margin-bottom: 20px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.panel-total {
  font-size: 14px;
  font-weight: 600;

  &.assets {
    color: #059669;
  }

  &.liability {
    color: #e11d48;
  }
}

.panel-body {
  display: flex;
  align-items: center;
  gap: 20px;
}

.donut-wrap {
  position: relative;
  width: 112px;
  height: 112px;
  flex-shrink: 0;
}

.donut-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.chart-ring {
  transition: stroke-dasharray 0.6s ease;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.donut-center-label {
  font-size: 10px;
  color: #9ca3af;
}

.donut-center-value {
  font-size: 12px;
  font-weight: 700;
  color: #111827;
}

.legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.legend-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.legend-name {
  font-size: 14px;
  color: #4b5563;
}

.legend-right {
  text-align: right;
}

.legend-amount {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.legend-pct {
  margin: 2px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.empty-hint {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
}

.bottom-spacer {
  height: 8px;
}
</style>
