<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showConfirmDialog } from 'vant';
import ModernBottomSheet from '@/components/ModernBottomSheet.vue';
import { useAssetRecords } from '@/composables/useFinancialLedger';
import { assetMatchesGroupLabel } from '@/domain/ledgerCategories';
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

const formatUnitPrice = (row: AssetRecord) => {
  if (!row.unitPrice) return '';
  if (row.investmentType === 'crypto') return `${row.unitPrice.toLocaleString('zh-CN')} USDT`;
  return formatCurrency(row.unitPrice);
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
            <div>
              <div class="cell-title">{{ row.name }}</div>
              <div class="cell-sub">{{ investmentSummary(row) }}</div>
              <div v-if="quoteUpdatedText(row)" class="cell-meta">{{ quoteUpdatedText(row) }}</div>
            </div>
            <div class="cell-amt">{{ formatCurrency(row.amount) }}</div>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #fff;
}

.cell-title {
  font-size: 15px;
  font-weight: 500;
  color: #111827;
}

.cell-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-meta {
  margin-top: 3px;
  font-size: 11px;
  color: #6b7280;
}

.cell-amt {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  flex-shrink: 0;
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
