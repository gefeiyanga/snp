<script setup lang="ts">
import { ref, onMounted, onActivated, computed } from 'vue';
import { useRouter } from 'vue-router';
import ModernBottomSheet from '@/components/ModernBottomSheet.vue';
import { useLiabilityRecords } from '@/composables/useFinancialLedger';
import type { LedgerFormPayload } from '@/types/ledger';

const router = useRouter();
const liabilityRepo = useLiabilityRecords();

const showAddLiabilitySheet = ref(false);
const liabilitiesByCategory = ref<any[]>([]);

const liabilityCategories = [
  { name: '房贷', icon: 'home-o', wrap: 'blue' },
  { name: '车贷', icon: 'logistics', wrap: 'red' },
  { name: '信用卡', icon: 'credit-pay', wrap: 'gray' },
  { name: '其他', icon: 'more-o', wrap: 'gray' }
] as const;

const isMortgageOrCar = (name: string) => name === '房贷' || name === '车贷';

const loadLiabilities = async () => {
  const liabilities = await liabilityRepo.list();

  const categorizedLiabilities: any[] = [];
  liabilityCategories.forEach((category) => {
    const categoryLiabilities = liabilities.filter((liability) => liability.category === category.name);
    const totalAmount = categoryLiabilities.reduce((sum, liability) => sum + (liability.amount || 0), 0);
    const remainingAmount = categoryLiabilities.reduce(
      (sum, liability) => sum + (liability.remaining ?? liability.amount ?? 0),
      0
    );
    const monthlyPaymentTotal = categoryLiabilities.reduce(
      (sum, liability) => sum + (Number(liability.monthlyPayment) || 0),
      0
    );

    categorizedLiabilities.push({
      ...category,
      liabilities: categoryLiabilities,
      totalAmount,
      remainingAmount,
      monthlyPaymentTotal
    });
  });

  liabilitiesByCategory.value = categorizedLiabilities;
};

onMounted(() => {
  loadLiabilities();
});

onActivated(() => {
  loadLiabilities();
});

const totalLiabilities = computed(() =>
  liabilitiesByCategory.value.reduce((sum, category) => sum + category.remainingAmount, 0)
);

const paidAmount = computed(() =>
  liabilitiesByCategory.value.reduce(
    (sum, category) => sum + Math.max((category.totalAmount || 0) - (category.remainingAmount || 0), 0),
    0
  )
);

const liabilityCount = computed(() =>
  liabilitiesByCategory.value.reduce((sum, category) => sum + category.liabilities.length, 0)
);

const goHome = () => {
  router.push('/');
};

const goCategory = (name: string) => {
  router.push({ name: 'LiabilityCategory', params: { name } });
};

const addLiability = () => {
  showAddLiabilitySheet.value = true;
};

const onSaveLiability = async (data: Record<string, unknown>) => {
  await liabilityRepo.upsertFromForm(data as LedgerFormPayload);
  await loadLiabilities();
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0
  }).format(value);
};

const categoryMeta = (category: any) => {
  const n = category.liabilities.length;
  const mt = Number(category.monthlyPaymentTotal) || 0;
  if (n === 0) return '暂无';
  if (isMortgageOrCar(category.name) && mt > 0) {
    return formatCurrency(mt);
  }
  if (n === 1) {
    const l = category.liabilities[0];
    const org = l.description || l.name || '';
    const monthly =
      Number(l.monthlyPayment) > 0 ? `月供 ${formatCurrency(Number(l.monthlyPayment))}` : '';
    return [org, monthly].filter(Boolean).join(' · ') || `${n} 笔记录`;
  }
  return `${n} 笔记录`;
};

const detailRows = computed(() => liabilitiesByCategory.value.filter((c) => c.liabilities.length > 0));

const dotColor = (wrap: string) => {
  if (wrap === 'blue') return '#3b82f6';
  if (wrap === 'red') return '#f87171';
  return '#94a3b8';
};
</script>

<template>
  <div class="liabilities-page">
    <div class="page-max">
    <header class="page-header safe-top sticky-head">
      <button type="button" class="icon-btn plain" aria-label="返回" @click="goHome">
        <van-icon name="arrow-left" size="20" color="#374151" />
      </button>
      <h1 class="page-title">负债</h1>
      <button type="button" class="icon-btn" aria-label="添加负债" @click="addLiability">
        <van-icon name="plus" size="20" color="#4b5563" />
      </button>
    </header>

    <div class="hero-wrap">
      <div class="hero-card">
        <div class="hero-deco hero-deco-a" aria-hidden="true" />
        <div class="hero-deco hero-deco-b" aria-hidden="true" />
        <p class="hero-label">总负债</p>
        <h2 class="hero-amount">{{ formatCurrency(totalLiabilities) }}</h2>
        <div class="hero-split">
          <div class="hero-split-item">
            <p class="hero-meta-label">已还金额</p>
            <p class="hero-meta-value">{{ formatCurrency(paidAmount) }}</p>
          </div>
          <div class="hero-divider" />
          <div class="hero-split-item">
            <p class="hero-meta-label">负债笔数</p>
            <p class="hero-meta-value">{{ liabilityCount }} 笔</p>
          </div>
        </div>
      </div>
    </div>

    <section class="section">
      <h3 class="section-title">负债类别</h3>
      <div class="cat-grid">
        <div
          v-for="category in liabilitiesByCategory"
          :key="category.name"
          class="cat-card press"
          role="button"
          tabindex="0"
          @click="goCategory(category.name)"
        >
          <div class="cat-icon" :class="`wrap-${category.wrap}`">
            <van-icon :name="category.icon" size="20" class="cat-icon-inner" />
          </div>
          <p class="cat-name">{{ category.name }}</p>
          <p class="cat-value">
            {{ category.liabilities.length ? formatCurrency(category.remainingAmount) : '暂无' }}
          </p>
          <p v-if="isMortgageOrCar(category.name) && category.liabilities.length" class="cat-monthly">
            {{ formatCurrency(category.monthlyPaymentTotal) }}
          </p>
          <p class="cat-meta">{{ category.liabilities.length }} 笔记录</p>
        </div>
      </div>
    </section>

    <section class="section section-list">
      <h3 class="section-title">明细列表</h3>
      <div v-if="detailRows.length" class="list-card">
        <div
          v-for="(category, index) in detailRows"
          :key="category.name"
          class="list-row press"
          :class="{ 'is-last': index === detailRows.length - 1 }"
          role="button"
          tabindex="0"
          @click="goCategory(category.name)"
        >
          <div class="list-left">
            <span class="list-dot" :style="{ backgroundColor: dotColor(category.wrap) }" />
            <div>
              <p class="list-name">{{ category.name }}</p>
              <p class="list-sub">{{ categoryMeta(category) }}</p>
            </div>
          </div>
          <div class="list-right">
            <span class="list-amt">{{ formatCurrency(category.remainingAmount) }}</span>
            <van-icon name="arrow" size="14" color="#d1d5db" />
          </div>
        </div>
      </div>
      <div v-else class="empty-panel">
        <div class="empty-panel-icon">
          <van-icon name="notes-o" size="32" color="#d1d5db" />
        </div>
        <h4 class="empty-panel-title">暂无负债记录</h4>
        <p class="empty-panel-text">添加你的第一笔负债，开始管理还款计划</p>
        <van-button type="primary" round block class="empty-cta" color="#f43f5e" @click="addLiability">
          添加负债
        </van-button>
      </div>
    </section>

    <ModernBottomSheet
      v-model="showAddLiabilitySheet"
      title="新增负债"
      mode="create"
      type="liability"
      submit-text="添加负债"
      @submit="onSaveLiability"
    />
    </div>
  </div>
</template>

<style lang="less" scoped>
@import (reference) '@/styles/finance-theme.less';

.liabilities-page {
  min-height: 100%;
  background: @finance-page-bg;
  padding-bottom: 32px;
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
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: none;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;

  &:active {
    background: #e5e7eb;
  }

  &.plain {
    background: transparent;

    &:active {
      background: #f3f4f6;
    }
  }
}

.hero-wrap {
  padding: 16px 20px 0;
}

.hero-card {
  position: relative;
  border-radius: 24px;
  padding: 24px;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(to bottom right, #f43f5e, #db2777);
  box-shadow: @finance-card-shadow;
}

.hero-deco {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.1);
}

.hero-deco-a {
  width: 160px;
  height: 160px;
  right: -40px;
  top: -40px;
}

.hero-deco-b {
  width: 128px;
  height: 128px;
  left: -40px;
  bottom: -40px;
  background: rgba(255, 255, 255, 0.05);
}

.hero-label {
  position: relative;
  z-index: 1;
  margin: 0 0 4px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.88);
  font-weight: 500;
}

.hero-amount {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.hero-split {
  position: relative;
  z-index: 1;
  display: flex;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.hero-split-item {
  flex: 1;
}

.hero-divider {
  width: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 16px;
}

.hero-meta-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
}

.hero-meta-value {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
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
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: @finance-card-shadow;
}

.cat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;

  &.wrap-blue {
    background: #eff6ff;
  }

  &.wrap-red {
    background: #fef2f2;
  }

  &.wrap-gray {
    background: #f9fafb;
  }
}

.wrap-blue .cat-icon-inner {
  color: #2563eb;
}

.wrap-red .cat-icon-inner {
  color: #ef4444;
}

.wrap-gray .cat-icon-inner {
  color: #6b7280;
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
}

.cat-monthly {
  margin: 6px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: #e11d48;
}

.cat-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.list-card {
  background: #fff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: @finance-card-shadow;
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #fafafa;

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
  gap: 12px;
  min-width: 0;
}

.list-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  flex-shrink: 0;
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
}

.empty-panel {
  background: #fff;
  border-radius: 24px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: @finance-card-shadow;
}

.empty-panel-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 9999px;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-panel-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.empty-panel-text {
  margin: 0 0 20px;
  font-size: 14px;
  color: #9ca3af;
  line-height: 1.5;
}

.empty-cta {
  font-weight: 500;
}

.press:active {
  transform: scale(0.99);
  transition: transform 0.1s;
}
</style>
