<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { useAccountRecords, useRecurringRuleRecords, useTransactionRecords } from '@/composables/useCashflowLedger';
import { useAssetRecords, useLiabilityRecords } from '@/composables/useFinancialLedger';
import { formatAmount } from '@/utils/amountDisplay';
import type { AccountRecord, AssetCurrency, RecurringOccurrence, TransactionRecord } from '@/types/ledger';

type DistributionItem = {
  name: string;
  value: number;
  color: string;
};

type AccountBalanceView = {
  account: AccountRecord;
  balance: number;
};

type QuickTransactionType = Extract<TransactionRecord['type'], 'income' | 'expense'>;

type QuickFormState = {
  amount: string;
  category: string;
  date: string;
  accountId: string;
  description: string;
};

const router = useRouter();
const assetsRepo = useAssetRecords();
const liabilityRepo = useLiabilityRecords();
const accountRepo = useAccountRecords();
const transactionRepo = useTransactionRecords();
const recurringRepo = useRecurringRuleRecords();

const totalAssets = ref(0);
const totalLiabilities = ref(0);
const netWorth = ref(0);
const accounts = ref<AccountRecord[]>([]);
const accountBalances = ref<AccountBalanceView[]>([]);
const recentTransactions = ref<TransactionRecord[]>([]);
const pendingOccurrences = ref<RecurringOccurrence[]>([]);
const maintenanceLoading = ref(false);
const quickSheetVisible = ref(false);
const quickType = ref<QuickTransactionType>('expense');
const quickForm = reactive<QuickFormState>({
  amount: '',
  category: '餐饮',
  date: '',
  accountId: '',
  description: ''
});

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
const computedActiveAccounts = computed(() => accounts.value.filter((account) => !account.archived));
const computedPendingTotal = computed(() =>
  pendingOccurrences.value.reduce((sum, occurrence) => sum + occurrence.amount, 0)
);
const computedRecentTransactions = computed(() => recentTransactions.value.slice(0, 3));
const computedQuickCategories = computed(() =>
  quickType.value === 'income' ? ['工资', '奖金', '副业', '投资收益', '其他收入'] : ['餐饮', '交通', '购物', '居住', '其他支出']
);
const computedQuickTitle = computed(() => (quickType.value === 'income' ? '记收入' : '记支出'));
const computedQuickSheetThemeStyle = computed(() =>
  quickType.value === 'income'
    ? {
        '--quick-accent': '#10b981',
        '--quick-accent-deep': '#047857',
        '--quick-accent-soft': '#ecfdf5',
        '--quick-accent-border': '#a7f3d0'
      }
    : {
        '--quick-accent': '#f43f5e',
        '--quick-accent-deep': '#be123c',
        '--quick-accent-soft': '#fff1f2',
        '--quick-accent-border': '#fecdd3'
      }
);

const todayYmd = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const monthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: todayYmd(start),
    end: todayYmd(end)
  };
};

const formatCurrency = (value: number, currency: AssetCurrency = 'CNY') => {
  return formatAmount(value, currency);
};

const legendPercent = (item: DistributionItem, total: number) => {
  if (total <= 0) return '0%';
  return `${((item.value / total) * 100).toFixed(1)}%`;
};

const formatDateShort = (date: string) => {
  const [, month, day] = date.split('-');
  return `${Number(month)}月${Number(day)}日`;
};

const occurrenceKindLabel = (kind: RecurringOccurrence['kind']) => {
  if (kind === 'income') return '收入';
  if (kind === 'loan_payment') return '还贷';
  if (kind === 'transfer') return '转账';
  return '支出';
};

const transactionTypeLabel = (type: TransactionRecord['type']) => {
  if (type === 'income') return '收入';
  if (type === 'transfer') return '转账';
  if (type === 'loan_payment') return '还贷';
  if (type === 'investment_buy') return '买入';
  if (type === 'investment_sell') return '卖出';
  if (type === 'balance_adjustment') return '调整';
  return '支出';
};

const signedTransactionAmount = (transaction: TransactionRecord) => {
  if (transaction.type === 'income' || transaction.type === 'investment_sell') return transaction.amount;
  if (transaction.type === 'balance_adjustment') return transaction.amount;
  return -transaction.amount;
};

const loadMaintenanceData = async () => {
  maintenanceLoading.value = true;
  try {
    const range = monthRange();
    const [accountRows, balanceRows, transactionRows, occurrences] = await Promise.all([
      accountRepo.list(),
      accountRepo.balances(),
      transactionRepo.list(),
      recurringRepo.pendingOccurrences(range.start, range.end)
    ]);
    const accountMap = new Map(accountRows.map((account) => [account.id, account]));
    accounts.value = accountRows;
    accountBalances.value = balanceRows
      .map((balance) => {
        const account = accountMap.get(balance.accountId);
        return account ? { account, balance: balance.balance } : null;
      })
      .filter((row): row is AccountBalanceView => row !== null);
    recentTransactions.value = transactionRows.filter((transaction) => transaction.status === 'confirmed');
    pendingOccurrences.value = occurrences;
  } finally {
    maintenanceLoading.value = false;
  }
};

const fetchData = async () => {
  const [assets, liabilities] = await Promise.all([assetsRepo.list(), liabilityRepo.list()]);

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

  await loadMaintenanceData();
};

const ensureDefaultAccount = async () => {
  const firstActive = computedActiveAccounts.value[0];
  if (firstActive) return firstActive;
  const account = await accountRepo.create({
    name: '默认现金账户',
    type: 'cash',
    side: 'asset',
    currency: 'CNY',
    openingBalance: 0,
    category: '现金'
  });
  await loadMaintenanceData();
  return account;
};

const openQuickSheet = async (type: QuickTransactionType) => {
  quickType.value = type;
  const account = await ensureDefaultAccount();
  quickForm.amount = '';
  quickForm.category = computedQuickCategories.value[0];
  quickForm.date = todayYmd();
  quickForm.accountId = account.id;
  quickForm.description = '';
  quickSheetVisible.value = true;
};

const selectQuickCategory = (category: string) => {
  quickForm.category = category;
};

const accountSideClass = (account: AccountRecord) => (account.side === 'liability' ? 'liability' : 'asset');

const submitQuickTransaction = async () => {
  const amount = Number(quickForm.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('请输入有效金额');
    return;
  }
  const account = computedActiveAccounts.value.find((item) => item.id === quickForm.accountId);
  if (!account) {
    showToast('请选择账户');
    return;
  }
  await transactionRepo.create({
    date: quickForm.date || todayYmd(),
    type: quickType.value,
    amount,
    currency: account.currency,
    accountId: account.id,
    category: quickForm.category,
    description: quickForm.description.trim() || undefined,
    status: 'confirmed',
    source: 'manual'
  });
  quickSheetVisible.value = false;
  showToast('已记入流水');
  await loadMaintenanceData();
};

const confirmOccurrence = async (occurrence: RecurringOccurrence) => {
  await recurringRepo.confirmOccurrence(occurrence);
  showToast(`已确认${occurrence.name}`);
  await loadMaintenanceData();
};

const confirmAllOccurrences = async () => {
  if (!pendingOccurrences.value.length) return;
  for (const occurrence of pendingOccurrences.value) {
    await recurringRepo.confirmOccurrence(occurrence);
  }
  showToast('已确认全部待办');
  await loadMaintenanceData();
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
              <div class="hero-divider" />
              <div class="hero-split-item">
                <span class="hero-split-label">较上月</span>
                <span class="hero-split-value muted">暂无数据</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel maintenance-panel animate-in" style="animation-delay: 0.1s">
        <div class="panel-head">
          <h3 class="panel-title">账务维护</h3>
          <span class="panel-total work" v-if="pendingOccurrences.length">
            待确认 {{ formatCurrency(computedPendingTotal) }}
          </span>
          <span class="panel-total muted" v-else>本月已同步</span>
        </div>

        <div class="quick-actions">
          <button type="button" class="quick-action income" @click="openQuickSheet('income')">
            <van-icon name="plus" size="18" />
            <span>记收入</span>
          </button>
          <button type="button" class="quick-action expense" @click="openQuickSheet('expense')">
            <van-icon name="minus" size="18" />
            <span>记支出</span>
          </button>
        </div>

        <div class="work-section">
          <div class="work-head">
            <span class="work-title">待确认</span>
            <button
              v-if="pendingOccurrences.length"
              type="button"
              class="text-action"
              @click="confirmAllOccurrences"
            >
              全部确认
            </button>
          </div>

          <div v-if="pendingOccurrences.length" class="work-list">
            <div v-for="occurrence in pendingOccurrences" :key="occurrence.id" class="work-row">
              <div class="work-main">
                <span class="work-date">{{ formatDateShort(occurrence.date) }}</span>
                <div class="work-copy">
                  <p class="work-name">{{ occurrence.name }}</p>
                  <p class="work-meta">{{ occurrenceKindLabel(occurrence.kind) }} · {{ occurrence.category }}</p>
                </div>
              </div>
              <div class="work-side">
                <span class="work-amount">{{ formatCurrency(occurrence.amount, occurrence.currency) }}</span>
                <button type="button" class="confirm-btn" @click="confirmOccurrence(occurrence)">确认</button>
              </div>
            </div>
          </div>
          <p v-else class="empty-hint">{{ maintenanceLoading ? '正在读取待办' : '暂无待确认事项' }}</p>
        </div>

        <div v-if="accountBalances.length" class="work-section">
          <div class="work-head">
            <span class="work-title">账户余额</span>
          </div>
          <div class="account-list">
            <div v-for="item in accountBalances" :key="item.account.id" class="account-row">
              <span class="account-name">{{ item.account.name }}</span>
              <span class="account-value">{{ formatCurrency(item.balance, item.account.currency) }}</span>
            </div>
          </div>
        </div>

        <div v-if="computedRecentTransactions.length" class="work-section">
          <div class="work-head">
            <span class="work-title">最近流水</span>
          </div>
          <div class="transaction-list">
            <div v-for="transaction in computedRecentTransactions" :key="transaction.id" class="transaction-row">
              <div class="transaction-main">
                <span class="transaction-type">{{ transactionTypeLabel(transaction.type) }}</span>
                <span class="transaction-name">{{ transaction.category }}</span>
              </div>
              <span
                class="transaction-amount"
                :class="{ income: signedTransactionAmount(transaction) >= 0 }"
              >
                {{ formatCurrency(signedTransactionAmount(transaction), transaction.currency) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="panel animate-in" style="animation-delay: 0.16s">
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
              <span class="donut-center-value">{{ formatCurrency(assetChartTotal) }}</span>
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

      <section class="panel panel-last animate-in" style="animation-delay: 0.24s">
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
              <span class="donut-center-value">{{ formatCurrency(liabilityChartTotal) }}</span>
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

    <van-popup v-model:show="quickSheetVisible" position="bottom" round>
      <div class="quick-sheet" :style="computedQuickSheetThemeStyle">
        <div class="sheet-head">
          <h3 class="sheet-title">{{ computedQuickTitle }}</h3>
          <button type="button" class="sheet-close" @click="quickSheetVisible = false">
            <van-icon name="cross" size="18" />
          </button>
        </div>

        <div class="mode-tabs">
          <button
            type="button"
            class="mode-tab"
            :class="{ active: quickType === 'expense' }"
            @click="quickType = 'expense'; quickForm.category = computedQuickCategories[0]"
          >
            支出
          </button>
          <button
            type="button"
            class="mode-tab"
            :class="{ active: quickType === 'income' }"
            @click="quickType = 'income'; quickForm.category = computedQuickCategories[0]"
          >
            收入
          </button>
        </div>

        <van-field
          v-model="quickForm.amount"
          type="number"
          label="金额"
          placeholder="0.00"
          input-align="right"
          clearable
        />
        <van-field v-model="quickForm.date" type="date" label="日期" input-align="right" />

        <div class="sheet-block">
          <span class="sheet-label">分类</span>
          <div class="chip-row">
            <button
              v-for="category in computedQuickCategories"
              :key="category"
              type="button"
              class="chip-btn"
              :class="{ active: quickForm.category === category }"
              @click="selectQuickCategory(category)"
            >
              {{ category }}
            </button>
          </div>
        </div>

        <div class="sheet-block">
          <span class="sheet-label">账户</span>
          <div class="chip-row">
            <button
              v-for="account in computedActiveAccounts"
              :key="account.id"
              type="button"
              class="chip-btn"
              :class="[accountSideClass(account), { active: quickForm.accountId === account.id }]"
              @click="quickForm.accountId = account.id"
            >
              {{ account.name }}
            </button>
          </div>
        </div>

        <van-field
          v-model="quickForm.description"
          label="备注"
          placeholder="可选"
          input-align="right"
          maxlength="40"
          clearable
        />

        <button type="button" class="save-btn" @click="submitQuickTransaction">保存流水</button>
      </div>
    </van-popup>
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
  display: none;
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
  min-height: 198px;
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  overflow: hidden;
  box-shadow: @finance-card-shadow;
  border: 1px solid rgba(15, 23, 42, 0.04);

}

.hero-blob {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
}

.hero-blob-a {
  right: -34px;
  top: -38px;
  width: 132px;
  height: 132px;
  background: #ecfdf5;
  opacity: 0.86;
}

.hero-blob-b {
  right: 24px;
  bottom: -44px;
  width: 104px;
  height: 104px;
  background: #f0fdf4;
  opacity: 0.68;
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
  letter-spacing: 0;
  color: #111827;
  font-variant-numeric: tabular-nums;
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
  min-width: 0;
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
  margin: 0 10px;
}

.hero-split-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: #9ca3af;
}

.hero-split-value {
  display: block;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;

  &.debt {
    color: #e11d48;
  }

  &.muted {
    color: #9ca3af;
    font-weight: 500;
  }
}

.press:active {
  transform: scale(0.98);
  transition: transform 0.1s;
}

.panel {
  margin: 24px 20px 0;
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: @finance-card-shadow;
  border: 1px solid rgba(15, 23, 42, 0.04);
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

  &.work {
    color: #047857;
    font-size: 12px;
  }

  &.muted {
    color: #9ca3af;
    font-size: 12px;
  }
}

.panel-body {
  display: flex;
  align-items: center;
  gap: 20px;
}

.maintenance-panel {
  padding-bottom: 18px;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.quick-action {
  height: 44px;
  border: none;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:active {
    opacity: 0.76;
  }

  &.expense {
    background: #fef2f2;
    color: #dc2626;
  }

  &.income {
    background: #ecfdf5;
    color: #059669;
  }
}

.work-section {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}

.work-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.work-title {
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
}

.text-action {
  border: none;
  background: transparent;
  color: #047857;
  font-size: 13px;
  font-weight: 600;
  padding: 2px 0;
  cursor: pointer;
}

.work-list,
.account-list,
.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.work-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.work-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.work-date {
  width: 48px;
  height: 28px;
  border-radius: 14px;
  background: #ecfdf5;
  color: #047857;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.work-copy {
  min-width: 0;
}

.work-name,
.work-meta {
  margin: 0;
}

.work-name {
  color: #111827;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-meta {
  margin-top: 2px;
  color: #9ca3af;
  font-size: 12px;
}

.work-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.work-amount {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.confirm-btn {
  border: none;
  border-radius: 12px;
  background: #10b981;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  height: 28px;
  padding: 0 10px;
  cursor: pointer;

  &:active {
    opacity: 0.78;
  }
}

.account-row,
.transaction-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.account-name,
.transaction-name {
  font-size: 13px;
  color: #4b5563;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  flex-shrink: 0;
}

.transaction-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.transaction-type {
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
}

.transaction-amount {
  font-size: 14px;
  font-weight: 600;
  color: #dc2626;
  flex-shrink: 0;

  &.income {
    color: #059669;
  }
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
  max-width: 82px;
  font-size: 11px;
  font-weight: 700;
  color: #111827;
  text-align: center;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
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
  font-variant-numeric: tabular-nums;
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

.quick-sheet {
  padding: 18px 20px calc(20px + env(safe-area-inset-bottom, 0));
  background: #fff;
  border-radius: 24px 24px 0 0;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.sheet-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #111827;
}

.sheet-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 16px;
  background: #f3f4f6;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: #f3f4f6;
  border-radius: 14px;
  padding: 4px;
  margin-bottom: 12px;
}

.mode-tab {
  border: none;
  border-radius: 11px;
  min-height: 44px;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &.active {
    background: var(--quick-accent-soft);
    color: var(--quick-accent-deep);
    box-shadow: inset 0 0 0 1px var(--quick-accent-border);
  }
}

.sheet-block {
  padding: 12px 0;
  border-top: 1px solid #f3f4f6;
}

.sheet-label {
  display: block;
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 10px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-btn {
  border: none;
  border-radius: 14px;
  background: #f3f4f6;
  color: #4b5563;
  min-height: 44px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &.active {
    background: var(--quick-accent-soft);
    color: var(--quick-accent-deep);
    box-shadow: inset 0 0 0 1px var(--quick-accent-border);
  }

  &.asset.active {
    background: #ecfdf5;
    color: #047857;
    box-shadow: inset 0 0 0 1px #a7f3d0;
  }

  &.liability.active {
    background: #fff1f2;
    color: #be123c;
    box-shadow: inset 0 0 0 1px #fecdd3;
  }
}

.save-btn {
  width: 100%;
  min-height: 44px;
  border: none;
  border-radius: 14px;
  background: var(--quick-accent);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  margin-top: 14px;
  cursor: pointer;

  &:active {
    opacity: 0.82;
  }
}

:deep(.quick-sheet .van-cell) {
  padding: 12px 0;
}

:deep(.quick-sheet .van-field__label) {
  color: #6b7280;
}

:deep(.quick-sheet .van-field__control) {
  font-weight: 600;
  color: #111827;
}
</style>
