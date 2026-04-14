<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStorage } from '@/composables/useStorage';

type DistributionItem = {
  name: string;
  value: number;
  color: string;
};

const router = useRouter();
const { getItem } = useStorage();

const totalAssets = ref(0);
const totalLiabilities = ref(0);
const netWorth = ref(0);

const assetDistribution = ref<DistributionItem[]>([
  { name: '现金', value: 15000, color: '#10b981' },
  { name: '银行', value: 45000, color: '#3b82f6' },
  { name: '投资', value: 120000, color: '#f59e0b' },
  { name: '房产', value: 2500000, color: '#8b5cf6' },
  { name: '其他', value: 30000, color: '#ec4899' }
]);

const liabilityDistribution = ref<DistributionItem[]>([
  { name: '房贷', value: 1800000, color: '#3b82f6' },
  { name: '车贷', value: 120000, color: '#f87171' }
]);

const CHART_RADIUS = 30;
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

const fetchData = async () => {
  const assets = (await getItem<any[]>('assets')) || [];
  totalAssets.value = assets.reduce((sum, asset) => sum + (asset.amount || 0), 0);

  const liabilities = (await getItem<any[]>('liabilities')) || [];
  totalLiabilities.value = liabilities.reduce((sum, liability) => sum + (liability.amount || 0), 0);

  netWorth.value = totalAssets.value - totalLiabilities.value;
};

onMounted(() => {
  fetchData();
});

const goToAssets = () => {
  router.push('/assets');
};

const goToLiabilities = () => {
  router.push('/liabilities');
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0
  }).format(value);
};
</script>

<template>
  <div class="home-page">

    <div class="total-card">
      <div class="total-label">资产总览</div>
      <div class="total-amount">{{ formatCurrency(totalAssets) }}</div>
      <div class="total-meta">
        <div class="meta-item">
          <div class="meta-label">净资产</div>
          <div class="meta-value net-value">{{ formatCurrency(netWorth) }}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">总负债</div>
          <div class="meta-value debt-value">{{ formatCurrency(totalLiabilities) }}</div>
        </div>
      </div>
    </div>

    <div class="section-title">快捷入口</div>
    <div class="quick-actions">
      <div class="quick-card" @click="goToAssets">
        <div class="quick-icon asset-icon">
          <van-icon name="gold-coin-o" size="16" color="#059669" />
        </div>
        <div class="quick-info">
          <div class="quick-name">资产</div>
          <div class="quick-subtitle">查看资产明细</div>
        </div>
      </div>
      <div class="quick-card" @click="goToLiabilities">
        <div class="quick-icon liability-icon">
          <van-icon name="balance-o" size="16" color="#be123c" />
        </div>
        <div class="quick-info">
          <div class="quick-name">负债</div>
          <div class="quick-subtitle">查看负债明细</div>
        </div>
      </div>
    </div>

    <div class="section-title">分布概览</div>
    <div class="distribution-card asset-card">
      <div class="distribution-header">
        <div class="distribution-title">资产分布</div>
        <div class="distribution-total assets">{{ formatCurrency(assetChartTotal) }}</div>
      </div>
      <div class="distribution-body">
        <svg viewBox="0 0 88 88" width="88" height="88" aria-label="资产分布环形图">
          <circle cx="44" cy="44" r="30" stroke="#eef2f7" stroke-width="14" fill="none" />
          <g transform="rotate(-90 44 44)">
            <circle
              v-for="(segment, index) in assetSegments"
              :key="`asset-${index}`"
              cx="44"
              cy="44"
              r="30"
              fill="none"
              stroke-width="14"
              stroke-linecap="butt"
              :stroke="segment.color"
              :stroke-dasharray="segment.dasharray"
              :stroke-dashoffset="segment.dashoffset"
            />
          </g>
        </svg>
        <div class="legend-list">
          <div v-for="item in assetDistribution" :key="item.name" class="legend-item">
            <span class="legend-dot" :style="{ backgroundColor: item.color }"></span>
            <span>{{ item.name }} {{ item.value.toLocaleString('zh-CN') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="distribution-card liability-card">
      <div class="distribution-header">
        <div class="distribution-title">负债分布</div>
        <div class="distribution-total liabilities">{{ formatCurrency(liabilityChartTotal) }}</div>
      </div>
      <div class="distribution-body">
        <svg viewBox="0 0 88 88" width="88" height="88" aria-label="负债分布环形图">
          <circle cx="44" cy="44" r="30" stroke="#eef2f7" stroke-width="14" fill="none" />
          <g transform="rotate(-90 44 44)">
            <circle
              v-for="(segment, index) in liabilitySegments"
              :key="`liability-${index}`"
              cx="44"
              cy="44"
              r="30"
              fill="none"
              stroke-width="14"
              stroke-linecap="butt"
              :stroke="segment.color"
              :stroke-dasharray="segment.dasharray"
              :stroke-dashoffset="segment.dashoffset"
            />
          </g>
        </svg>
        <div class="legend-list">
          <div v-for="item in liabilityDistribution" :key="item.name" class="legend-item">
            <span class="legend-dot" :style="{ backgroundColor: item.color }"></span>
            <span>{{ item.name }} {{ item.value.toLocaleString('zh-CN') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
@import (reference) '@/styles/finance-theme.less';

.home-page {
  background: @finance-page-bg;
  padding-bottom: 24px;
  box-sizing: border-box;
}

.top-nav {
  .finance-nav-bar();
}

.total-card {
  --finance-total-card-bg: #e7efff;
  --finance-total-card-text: #1e3a8a;
  .finance-total-card();

  .net-value {
    color: #047857;
  }

  .debt-value {
    color: #be123c;
  }
}

.section-title {
  .finance-section-title();
}

.quick-actions {
  margin: 0 16px 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-card {
  .finance-mini-card();
}

.quick-icon {
  .finance-icon-box();
}

.asset-icon {
  background: #ecfdf5;
}

.liability-icon {
  background: #fff1f2;
}

.quick-name {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
}

.quick-subtitle {
  margin-top: 2px;
  font-size: 11px;
  color: #9ca3af;
}

.distribution-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 14px;
  border: 1px solid #e8eaef;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

.asset-card {
  margin: 0 16px 10px;
}

.liability-card {
  margin: 0 16px 16px;
}

.distribution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.distribution-title {
  font-size: 13px;
  font-weight: 500;
  color: #111827;
}

.distribution-total {
  font-size: 12px;
  font-weight: 500;

  &.assets {
    color: #10b981;
  }

  &.liabilities {
    color: #f87171;
  }
}

.distribution-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;

  span:not(.legend-dot) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

@media (max-width: 360px) {
  .total-card .total-amount {
    font-size: 24px;
  }
}

@media (max-height: 760px) {
  .asset-card {
    margin-bottom: 8px;
  }

  .liability-card {
    margin-bottom: 10px;
  }

  .distribution-card {
    padding: 12px;
  }
}
</style>