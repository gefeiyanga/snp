<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog } from 'vant';
import ModernBottomSheet from '@/components/ModernBottomSheet.vue';
import { useAssetRecords } from '@/composables/useFinancialLedger';
import { calculateInvestmentReturn } from '@/domain/investmentReturns';
import { assetMatchesGroupLabel } from '@/domain/ledgerCategories';
import { formatPrice } from '@/utils/amountDisplay';
import type { AssetRecord, LedgerFormPayload } from '@/types/ledger';

const route = useRoute();
const router = useRouter();
const assetsRepo = useAssetRecords();

const groupName = computed(() => String(route.params.name || ''));

const rows = ref<AssetRecord[]>([]);
const showSheet = ref(false);
const sheetTitle = ref('新增资产');
const sheetMode = ref<'create' | 'edit'>('create');
const sheetKey = ref('new');
const sheetInitial = ref<Record<string, unknown>>({});

const load = async () => {
  const all = await assetsRepo.list();
  rows.value = all.filter((a) => assetMatchesGroupLabel(a.category, groupName.value));
};

let stopQuoteRefreshListener: (() => void) | undefined;

onMounted(() => {
  load();
  stopQuoteRefreshListener = onInvestmentQuotesRefreshed(load);
});

onUnmounted(() => {
  stopQuoteRefreshListener?.();
});

onActivated(() => {
  load();
});

const goBack = () => {
  router.push('/assets');
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 0 }).format(value);

const formatSignedCurrency = (value: number) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCurrency(value)}`;
};

const formatPercent = (value: number) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
};

const investmentReturnText = (row: AssetRecord) => {
  const result = calculateInvestmentReturn(row);
  if (!result) return '';
  return `${formatSignedCurrency(result.profit)} ${formatPercent(result.profitRate)}`;
};

const investmentReturnClass = (row: AssetRecord) => {
  const result = calculateInvestmentReturn(row);
  if (!result) return '';
  if (result.profit > 0) return 'gain';
  if (result.profit < 0) return 'loss';
  return 'flat';
};

const formatUnitPrice = (row: AssetRecord) => {
  if (!row.unitPrice) return '';
  if (row.investmentType === 'crypto') return formatPrice(row.unitPrice, 'USDT');
  return formatPrice(row.unitPrice);
};

const formatQuoteUpdatedAt = (value?: string) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

const investmentSummary = (row: AssetRecord) => {
  if (row.category !== '投资' || !row.quantity) return row.description || '无备注';
  const priceText = row.unitPrice ? `价格 ${formatUnitPrice(row)}` : '';
  return [row.symbol || row.name, `${row.quantity}`, priceText].filter(Boolean).join(' · ');
};

const quoteUpdatedText = (row: AssetRecord) => {
  if (row.category !== '投资' || !row.quoteUpdatedAt) return '';
  return `更新时间 ${formatQuoteUpdatedAt(row.quoteUpdatedAt)}`;
};

const investmentMetaText = (row: AssetRecord) => {
  return [quoteUpdatedText(row), investmentReturnText(row)].filter(Boolean).join(' · ');
};

const openCreate = () => {
  sheetMode.value = 'create';
  sheetTitle.value = '新增资产';
  sheetKey.value = `create-${Date.now()}`;
  sheetInitial.value = { category: groupName.value };
  showSheet.value = true;
};

const openEdit = (row: AssetRecord) => {
  sheetMode.value = 'edit';
  sheetTitle.value = '编辑资产';
  sheetKey.value = row.id;
  sheetInitial.value = {
    id: row.id,
    name: row.name,
    amount: row.amount,
    category: row.category,
    description: row.description ?? '',
    date: row.purchaseDate ?? '',
    valuationMode: row.valuationMode,
    investmentType: row.investmentType,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    exchangeRate: row.exchangeRate,
    costPrice: row.costPrice,
    symbol: row.symbol,
    currency: row.currency,
    quoteUpdatedAt: row.quoteUpdatedAt
  };
  showSheet.value = true;
};

const onSubmit = async (data: Record<string, unknown>) => {
  await assetsRepo.upsertFromForm(data as LedgerFormPayload);
  await load();
};

const confirmDelete = async (row: AssetRecord) => {
  try {
    await showConfirmDialog({
      title: '删除资产',
      message: `确定删除「${row.name}」？`
    });
  } catch {
    return;
  }
  await assetsRepo.remove(row.id);
  await load();
};
</script>

<template>
  <div class="cat-page">
    <div class="page-max">
      <header class="page-header safe-top sticky-head">
        <button type="button" class="icon-btn plain" aria-label="返回" @click="goBack">
          <van-icon name="arrow-left" size="20" color="#374151" />
        </button>
        <h1 class="page-title">{{ groupName }} · 明细</h1>
        <button type="button" class="icon-btn" aria-label="新增" @click="openCreate">
          <van-icon name="plus" size="20" color="#4b5563" />
        </button>
      </header>

      <div class="hint">共 {{ rows.length }} 笔，左滑删除</div>

      <van-cell-group v-if="rows.length" inset class="list-group">
        <van-swipe-cell v-for="row in rows" :key="row.id">
          <div class="cell-row" role="button" tabindex="0" @click="openEdit(row)">
            <div class="cell-head">
              <div class="cell-title">{{ row.name }}</div>
              <div class="cell-amt">{{ formatCurrency(row.amount) }}</div>
            </div>
            <div class="cell-sub">{{ investmentSummary(row) }}</div>
            <div v-if="investmentMetaText(row)" class="cell-meta">
              <span>{{ quoteUpdatedText(row) }}</span>
              <span
                v-if="investmentReturnText(row)"
                class="cell-return"
                :class="investmentReturnClass(row)"
              >
                {{ quoteUpdatedText(row) ? ` · ${investmentReturnText(row)}` : investmentReturnText(row) }}
              </span>
            </div>
          </div>
          <template #right>
            <van-button square type="danger" class="swipe-del" text="删除" @click.stop="confirmDelete(row)" />
          </template>
        </van-swipe-cell>
      </van-cell-group>

      <div v-else class="empty">该类别下暂无记录，点击右上角添加</div>

      <ModernBottomSheet
        :key="sheetKey"
        v-model="showSheet"
        :title="sheetTitle"
        :mode="sheetMode"
        :lock-category="sheetMode === 'create'"
        type="asset"
        :initial-data="sheetInitial"
        :submit-text="sheetMode === 'edit' ? '保存' : '添加资产'"
        @submit="onSubmit"
      />
    </div>
  </div>
</template>

<style lang="less" scoped>
@import (reference) '@/styles/finance-theme.less';

.cat-page {
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
  font-size: 16px;
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
  }
}

.hint {
  padding: 12px 20px 8px;
  font-size: 12px;
  color: #9ca3af;
}

.list-group {
  margin: 0 16px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: @finance-card-shadow;
}

.list-group :deep(.van-swipe-cell:not(:last-child) .cell-row) {
  border-bottom: 1px solid #f3f4f6;
}

.cell-row {
  display: block;
  padding: 18px 32px;
  background: #fff;
}

.cell-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.cell-title {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  line-height: 1.35;
}

.cell-sub {
  margin-top: 8px;
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

.cell-meta {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}

.cell-amt {
  flex: 0 0 auto;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  text-align: right;
  white-space: nowrap;
}

.cell-return {
  font-weight: 600;

  &.gain {
    color: #dc2626;
  }

  &.loss {
    color: #059669;
  }

  &.flat {
    color: #6b7280;
  }
}

.swipe-del {
  height: 100%;
}

.empty {
  margin: 24px 20px;
  padding: 24px;
  text-align: center;
  font-size: 14px;
  color: #9ca3af;
  background: #fff;
  border-radius: 16px;
  box-shadow: @finance-card-shadow;
}
</style>
