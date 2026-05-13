<template>
  <van-popup
    v-model:show="showPopup"
    position="bottom"
    :style="{ maxHeight: '85vh' }"
    :overlay-style="{ background: 'rgba(0, 0, 0, 0.45)' }"
    class="modern-sheet-popup"
    round
    :close-on-click-overlay="true"
  >
    <div class="quick-sheet ledger-sheet" :style="panelThemeStyle">
      <div class="sheet-head">
        <h3 class="sheet-title">{{ title }}</h3>
        <button type="button" class="sheet-close" aria-label="关闭" @click="closeSheet">
          <van-icon name="cross" size="18" />
        </button>
      </div>

      <div class="sheet-scroll">
        <div v-if="!lockCategory" class="mode-tabs">
          <button
            v-for="item in typeOptions"
            :key="item"
            type="button"
            class="mode-tab"
            :class="{ active: activeType === item }"
            @click="activeType = item"
          >
            {{ item }}
          </button>
        </div>

        <van-field
          v-model="formData.name"
          :label="nameLabel"
          :placeholder="namePlaceholder"
          input-align="right"
          clearable
          class="sheet-field"
        />

        <van-field
          v-if="isInvestmentAsset"
          v-model="formData.quantity"
          type="number"
          :label="amountLabel"
          placeholder="请输入持有数量"
          input-align="right"
          clearable
          class="sheet-field amount-field"
        />
        <van-field
          v-else
          v-model="formData.amount"
          type="number"
          :label="amountLabel"
          :placeholder="amountPlaceholder"
          input-align="right"
          clearable
          class="sheet-field amount-field"
        />
        <p v-if="isInvestmentAsset" class="sheet-hint">可根据持有数量和当前价格自动计算总资产价值</p>

        <template v-if="isInvestmentAsset">
          <div class="sheet-block">
            <span class="sheet-label">投资类型</span>
            <div class="chip-row">
              <button
                v-for="opt in investmentTypeOptions"
                :key="opt.value"
                type="button"
                class="chip-btn"
                :class="{ active: formData.investmentType === opt.value }"
                @click="formData.investmentType = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <van-field
            v-model="formData.symbol"
            label="标的代码"
            placeholder="例如 510300 / AAPL / BTC"
            input-align="right"
            clearable
            class="sheet-field"
          />
          <div class="quote-actions">
            <button
              type="button"
              class="quote-button"
              :disabled="!canLookupQuote || isLookingUpQuote"
              @click="refreshInvestmentQuote"
            >
              {{ isLookingUpQuote ? '查询中...' : '查询价格' }}
            </button>
            <span class="quote-status">{{ quoteStatusText }}</span>
          </div>
          <van-field
            v-model="formData.unitPrice"
            type="text"
            inputmode="decimal"
            :label="unitPriceLabel"
            placeholder="用于计算当前总价值"
            input-align="right"
            clearable
            class="sheet-field"
          />
          <van-field
            v-model="formData.costPrice"
            type="text"
            inputmode="decimal"
            label="成本价"
            placeholder="选填"
            input-align="right"
            clearable
            class="sheet-field"
          />
          <van-field
            :model-value="investmentValuePreview"
            label="当前总价值（试算）"
            readonly
            input-align="right"
            class="sheet-field"
          />
        </template>

        <template v-if="type === 'liability' && isAmortizingSheet">
          <div class="sheet-block">
            <span class="sheet-label">还款方式</span>
            <div class="chip-row">
              <button
                v-for="opt in repaymentMethodOptions"
                :key="opt.value"
                type="button"
                class="chip-btn"
                :class="{ active: formData.repaymentMethod === opt.value }"
                @click="formData.repaymentMethod = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <van-field
            v-model="formData.termMonths"
            type="digit"
            label="总期数（月）"
            placeholder="例如 360"
            input-align="right"
            clearable
            class="sheet-field"
          />
          <van-field
            v-model="formData.interestRate"
            type="text"
            inputmode="decimal"
            label="年利率（%）"
            placeholder="必填"
            input-align="right"
            clearable
            class="sheet-field"
          />
          <van-field
            :model-value="previewMonthly"
            label="月供（试算）"
            readonly
            input-align="right"
            class="sheet-field"
          />
        </template>
        <template v-else-if="type === 'liability'">
          <van-field
            v-model="formData.monthlyPayment"
            type="digit"
            label="月供（元）"
            placeholder="选填"
            input-align="right"
            clearable
            class="sheet-field"
          />
          <van-field
            v-model="formData.interestRate"
            type="text"
            inputmode="decimal"
            label="年利率（%）"
            placeholder="选填"
            input-align="right"
            clearable
            class="sheet-field"
          />
        </template>

        <van-field
          :model-value="formData.date"
          :label="dateLabel"
          readonly
          clickable
          right-icon="notes-o"
          input-align="right"
          class="sheet-field"
          @click="showDatePicker = true"
        />

        <van-field
          v-model="formData.description"
          label="备注"
          type="textarea"
          rows="2"
          autosize
          maxlength="80"
          :placeholder="remarkPlaceholder"
          input-align="right"
          clearable
          class="sheet-field"
        />
      </div>

      <div class="sheet-actions">
        <button type="button" class="save-btn" :disabled="!computedCanSubmit" @click="submitAsset">{{ submitText }}</button>
      </div>
    </div>

    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        v-model="pickerDate"
        title="选择日期"
        @confirm="confirmDate"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </van-popup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { showToast } from 'vant';
import { assetCanonicalLabel } from '@/domain/ledgerCategories';
import { parseInterestRatePercent, scheduledMonthlyPayment, todayYmd } from '@/domain/loanSchedule';
import { hasMarketDataApiKey, lookupInvestmentQuote, requiresApiKeyForInvestmentType } from '@/services/marketData';
import { formatPriceDecimal } from '@/utils/amountDisplay';
import type { AssetCurrency, InvestmentAssetType } from '@/types/ledger';

interface FormData {
  id: string;
  name: string;
  amount: string;
  quantity: string;
  category: string;
  description: string;
  date: string;
  valuationMode: 'manual_amount' | 'market_quantity';
  investmentType: InvestmentAssetType;
  unitPrice: string;
  exchangeRate: string;
  quoteUpdatedAt: string;
  costPrice: string;
  symbol: string;
  currency: AssetCurrency;
  monthlyPayment: string;
  interestRate: string;
  termMonths: string;
  repaymentMethod: 'equal_payment' | 'equal_principal';
}

interface Props {
  modelValue: boolean;
  title: string;
  type: 'asset' | 'liability';
  lockCategory?: boolean;
  /** create：新建；edit：编辑（影响负债金额文案等） */
  mode?: 'create' | 'edit';
  initialData?: Partial<{
    id: string;
    name: string;
    amount: number | string;
    category: string;
    description: string;
    date: string;
    valuationMode: 'manual_amount' | 'market_quantity';
    investmentType: InvestmentAssetType;
    quantity: number | string;
    unitPrice: number | string;
    exchangeRate: number | string;
    quoteUpdatedAt: string;
    costPrice: number | string;
    symbol: string;
    currency: AssetCurrency;
    monthlyPayment: number | string;
    interestRate: number | string;
    termMonths: number | string;
    repaymentMethod: 'equal_payment' | 'equal_principal';
  }>;
  submitText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  lockCategory: false,
  submitText: '保存',
  mode: 'create',
  initialData: () => ({})
});

const lockCategory = computed(() => props.lockCategory);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'submit': [data: Record<string, any>];
}>();

const showPopup = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const today = new Date();
const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const formData = ref<FormData>({
  id: '',
  name: '',
  amount: '',
  quantity: '',
  category: '',
  description: '',
  date: defaultDate,
  valuationMode: 'manual_amount',
  investmentType: 'security',
  unitPrice: '',
  exchangeRate: '',
  quoteUpdatedAt: '',
  costPrice: '',
  symbol: '',
  currency: 'CNY',
  monthlyPayment: '',
  interestRate: '',
  termMonths: '',
  repaymentMethod: 'equal_payment'
});

const repaymentMethodOptions = [
  { value: 'equal_payment' as const, label: '等额本息' },
  { value: 'equal_principal' as const, label: '等额本金' }
];

const showDatePicker = ref(false);
const pickerDate = ref([
  String(today.getFullYear()),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0')
]);

const themePalette = computed(() =>
  props.type === 'asset'
    ? {
        accent: '#10b981',
        accentDeep: '#047857',
        accentSoft: '#ecfdf5',
        tagBorder: '#a7f3d0'
      }
    : {
        accent: '#f43f5e',
        accentDeep: '#be123c',
        accentSoft: '#fff1f2',
        tagBorder: '#fecdd3'
      }
);
const typeOptions = computed(() =>
  props.type === 'asset' ? ['投资', '现金', '银行', '其他'] : ['房贷', '车贷', '信用卡', '其他']
);
const activeType = ref(typeOptions.value[0]);
const investmentTypeOptions = [
  { value: 'security' as const, label: '股票/基金' },
  { value: 'crypto' as const, label: '加密货币' }
];
const isAmortizingSheet = computed(
  () => props.type === 'liability' && (activeType.value === '房贷' || activeType.value === '车贷')
);
const isInvestmentAsset = computed(() => props.type === 'asset' && activeType.value === '投资');

const submitText = computed(() => props.submitText);
const amountLabel = computed(() => {
  if (props.type === 'asset') return isInvestmentAsset.value ? '持有数量' : '当前金额';
  if (isAmortizingSheet.value) return '合同本金（元）';
  if (props.mode === 'edit') return '当前剩余本金';
  return '负债金额';
});
const amountPlaceholder = computed(() => {
  if (props.type === 'asset') return '请输入当前资产金额';
  return isAmortizingSheet.value ? '请输入合同本金' : '请输入负债金额';
});
const dateLabel = computed(() => {
  if (props.type === 'asset') return '记录日期';
  if (isAmortizingSheet.value) return '第一期还款日';
  return '发生日期';
});
const unitPriceLabel = computed(() =>
  formData.value.investmentType === 'crypto' ? '当前价格（USDT）' : '当前价格（人民币）'
);

const previewMonthly = computed(() => {
  if (!isAmortizingSheet.value) return '暂无数据';
  const P = Number(formData.value.amount || 0);
  const n = Number(formData.value.termMonths || 0);
  const parsed = parseInterestRatePercent(formData.value.interestRate);
  const rateRaw = formData.value.interestRate.trim();
  if (rateRaw !== '' && parsed === null) return '暂无数据';
  const rate = parsed ?? 0;
  if (!P || !n || n < 1) return '暂无数据';
  const first = formData.value.date;
  try {
    const v = scheduledMonthlyPayment(P, rate, n, formData.value.repaymentMethod, first, todayYmd());
    if (!Number.isFinite(v)) return '暂无数据';
    return v.toFixed(2);
  } catch {
    return '暂无数据';
  }
});
const nameLabel = computed(() => (props.type === 'asset' ? '资产名称' : '负债名称'));
const namePlaceholder = computed(() => {
  if (props.type !== 'asset') return '输入负债名称...';
  if (isInvestmentAsset.value) return '例如 纳指ETF、苹果、比特币';
  return '输入资产名称...';
});
const remarkPlaceholder = computed(() => (props.type === 'asset' ? '添加备注...' : '添加负债备注...'));
const investmentValuePreview = computed(() => {
  const quantity = Number(formData.value.quantity || 0);
  const unitPrice = Number(formData.value.unitPrice || 0);
  const exchangeRate = Number(formData.value.exchangeRate || 0);
  if (!quantity || !unitPrice) return '暂无数据';
  if (formData.value.investmentType === 'crypto' && !exchangeRate) return '暂无数据';
  const cnyAmount = formData.value.investmentType === 'crypto' ? quantity * unitPrice * exchangeRate : quantity * unitPrice;
  return (Math.round(cnyAmount * 100) / 100).toFixed(2);
});
const computedCanSubmit = computed(() => {
  if (!formData.value.name.trim()) return false;
  if (props.type === 'asset' && isInvestmentAsset.value) {
    if (!Number(formData.value.quantity || 0)) return false;
    if (!Number(formData.value.unitPrice || 0)) return false;
    if (formData.value.investmentType === 'crypto' && !Number(formData.value.exchangeRate || 0)) return false;
    return true;
  }
  if (!Number(formData.value.amount || 0)) return false;
  if (props.type === 'liability' && isAmortizingSheet.value) {
    const n = Number(formData.value.termMonths || 0);
    return Number.isInteger(n) && n > 0 && parseInterestRatePercent(formData.value.interestRate) !== null;
  }
  return true;
});
const panelThemeStyle = computed(() => ({
  '--sheet-accent': themePalette.value.accent,
  '--sheet-accent-deep': themePalette.value.accentDeep,
  '--sheet-accent-soft': themePalette.value.accentSoft,
  '--sheet-accent-border': themePalette.value.tagBorder
}));
const isLookingUpQuote = ref(false);
const quoteStatusText = ref('可按类型查询价格');
const initialUnitPrice = ref('');
const requiresApiKey = computed(
  () => isInvestmentAsset.value && requiresApiKeyForInvestmentType(formData.value.investmentType)
);
const canLookupQuote = computed(
  () =>
    isInvestmentAsset.value &&
    !!formData.value.symbol.trim() &&
    (!requiresApiKey.value || hasMarketDataApiKey())
);

const normalizeInvestmentType = (value?: InvestmentAssetType): InvestmentAssetType => {
  if (value === 'fund' || value === 'stock') return 'security';
  return value ?? 'security';
};

const shouldTrackQuoteUpdatedAt = () =>
  formData.value.investmentType === 'security' || formData.value.investmentType === 'crypto';

const formatLocalQuoteTime = (value?: string) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

watch(activeType, (value) => {
  formData.value.category = value;
  if (props.type === 'asset') {
    formData.value.valuationMode = value === '投资' ? 'market_quantity' : 'manual_amount';
  }
});

watch(
  () => props.initialData,
  (newData) => {
    const merged: FormData = {
      id: newData?.id || '',
      name: newData?.name || '',
      amount: newData?.amount !== undefined && newData?.amount !== '' ? String(newData.amount) : '',
      quantity: newData?.quantity !== undefined && newData?.quantity !== '' ? String(newData.quantity) : '',
      category: newData?.category || String(typeOptions.value[0]),
      description: newData?.description || '',
      date: newData?.date || defaultDate,
      valuationMode: newData?.valuationMode === 'market_quantity' ? 'market_quantity' : 'manual_amount',
      investmentType: normalizeInvestmentType(newData?.investmentType),
      unitPrice: newData?.unitPrice !== undefined && newData?.unitPrice !== '' ? String(newData.unitPrice) : '',
      exchangeRate: newData?.exchangeRate !== undefined && newData?.exchangeRate !== '' ? String(newData.exchangeRate) : '',
      quoteUpdatedAt: newData?.quoteUpdatedAt || '',
      costPrice: newData?.costPrice !== undefined && newData?.costPrice !== '' ? String(newData.costPrice) : '',
      symbol: newData?.symbol || '',
      currency: normalizeInvestmentType(newData?.investmentType) === 'crypto' ? 'USDT' : 'CNY',
      monthlyPayment: String(newData?.monthlyPayment ?? ''),
      interestRate: String(newData?.interestRate ?? ''),
      termMonths:
        newData?.termMonths !== undefined && newData?.termMonths !== ''
          ? String(newData.termMonths)
          : '',
      repaymentMethod: newData?.repaymentMethod === 'equal_principal' ? 'equal_principal' : 'equal_payment'
    };
    formData.value = merged;
    initialUnitPrice.value = merged.unitPrice;

    const rawCat = merged.category || String(typeOptions.value[0]);
    const normalized =
      props.type === 'asset' ? assetCanonicalLabel(rawCat) : rawCat;
    const opts = typeOptions.value as readonly string[];
    activeType.value = opts.includes(normalized) ? normalized : String(typeOptions.value[0]);
    formData.value.category = activeType.value;
    formData.value.valuationMode = activeType.value === '投资' ? 'market_quantity' : merged.valuationMode;

    const [year, month, day] = merged.date.split('-');
    if (year && month && day) {
      pickerDate.value = [year, month, day];
    }
  },
  { immediate: true, deep: true }
);

watch(showPopup, (visible) => {
  if (visible) {
    quoteStatusText.value =
      requiresApiKey.value && !hasMarketDataApiKey()
        ? '股票/基金需配置 API Key；加密货币走 CoinMarketCap 代理'
        : '可按类型查询价格';
  }
});

watch(
  () => formData.value.investmentType,
  (value) => {
    if (!isInvestmentAsset.value) return;
    formData.value.currency = value === 'crypto' ? 'USDT' : 'CNY';
    if (value !== 'crypto') {
      formData.value.exchangeRate = '';
    }
    quoteStatusText.value =
      requiresApiKeyForInvestmentType(value) && !hasMarketDataApiKey()
        ? '股票/基金需配置 API Key；加密货币走 CoinMarketCap 代理'
        : value === 'crypto'
          ? '加密货币按 USDT 报价并折算人民币'
          : '可按类型查询价格';
  },
  { immediate: true }
);

const closeSheet = () => {
  emit('update:modelValue', false);
};

const refreshInvestmentQuote = async () => {
  if (!isInvestmentAsset.value) return;
  if (requiresApiKey.value && !hasMarketDataApiKey()) {
    showToast('股票/基金请先配置行情 API Key');
    return;
  }

  try {
    isLookingUpQuote.value = true;
    quoteStatusText.value = '正在查询价格...';
    const quote = await lookupInvestmentQuote({
      symbol: formData.value.symbol,
      investmentType: formData.value.investmentType,
      currency: 'CNY'
    });
    formData.value.unitPrice = formatPriceDecimal(quote.price);
    formData.value.exchangeRate =
      quote.exchangeRate !== undefined ? quote.exchangeRate.toFixed(6).replace(/\.?0+$/, '') : '';
    if (shouldTrackQuoteUpdatedAt()) {
      formData.value.quoteUpdatedAt = quote.asOf ?? new Date().toISOString();
    }
    const rateText = quote.exchangeRate ? ` · USDT/CNY ${quote.exchangeRate.toFixed(4)}` : '';
    quoteStatusText.value = formData.value.quoteUpdatedAt
      ? `已更新：${formatLocalQuoteTime(formData.value.quoteUpdatedAt)}${rateText}`
      : `价格已更新${rateText}`;
  } catch (error) {
    quoteStatusText.value = error instanceof Error ? error.message : '价格查询失败';
    showToast(quoteStatusText.value);
  } finally {
    isLookingUpQuote.value = false;
  }
};

const confirmDate = () => {
  formData.value.date = `${pickerDate.value[0]}-${pickerDate.value[1]}-${pickerDate.value[2]}`;
  showDatePicker.value = false;
};

const submitAsset = () => {
  if (!formData.value.name.trim()) {
    showToast('请输入名称');
    return;
  }

  if (props.type === 'asset' && isInvestmentAsset.value) {
    if (!Number(formData.value.quantity || 0)) {
      showToast('请输入持有数量');
      return;
    }
    if (!Number(formData.value.unitPrice || 0)) {
      showToast('请输入当前价格');
      return;
    }
    if (formData.value.investmentType === 'crypto' && !Number(formData.value.exchangeRate || 0)) {
      showToast('请先查询 USDT/CNY 汇率');
      return;
    }
  } else if (!Number(formData.value.amount || 0)) {
    showToast('请输入金额');
    return;
  }

  const payload: Record<string, unknown> = {
    name: formData.value.name.trim(),
    amount: Number(formData.value.amount),
    category: activeType.value,
    description: formData.value.description,
    date: formData.value.date,
    purchaseDate: formData.value.date,
    dueDate: formData.value.date
  };

  if (formData.value.id) {
    payload.id = formData.value.id;
  }

  if (props.type === 'liability' && isAmortizingSheet.value) {
    const n = Number(formData.value.termMonths || 0);
    if (!Number.isInteger(n) || n < 1) {
      showToast('请填写有效的总期数（月）');
      return;
    }
    const rateParsed = parseInterestRatePercent(formData.value.interestRate);
    if (rateParsed === null) {
      showToast('请填写年利率');
      return;
    }
    payload.termMonths = n;
    payload.repaymentMethod = formData.value.repaymentMethod;
    payload.interestRate = rateParsed;
    const pm = Number(previewMonthly.value);
    payload.monthlyPayment = Number.isFinite(pm) ? pm : 0;
  } else if (props.type === 'liability') {
    payload.monthlyPayment = Number(formData.value.monthlyPayment || 0);
    const ir = formData.value.interestRate.trim();
    if (ir !== '') {
      const rp = parseInterestRatePercent(formData.value.interestRate);
      if (rp === null) {
        showToast('年利率输入有误');
        return;
      }
      payload.interestRate = rp;
    } else {
      payload.interestRate = 0;
    }
  } else if (isInvestmentAsset.value) {
    payload.category = '投资';
    payload.valuationMode = 'market_quantity';
    payload.quantity = Number(formData.value.quantity || 0);
    payload.unitPrice = Number(formData.value.unitPrice || 0);
    payload.exchangeRate =
      formData.value.investmentType === 'crypto' ? Number(formData.value.exchangeRate || 0) : undefined;
    payload.costPrice = formData.value.costPrice.trim() ? Number(formData.value.costPrice) : undefined;
    payload.investmentType = formData.value.investmentType;
    payload.symbol = formData.value.symbol.trim() || undefined;
    payload.currency = formData.value.investmentType === 'crypto' ? 'USDT' : 'CNY';
    payload.amount = Number(investmentValuePreview.value || 0);
    if (shouldTrackQuoteUpdatedAt()) {
      payload.quoteUpdatedAt =
        formData.value.quoteUpdatedAt ||
        (formData.value.unitPrice !== initialUnitPrice.value ? new Date().toISOString() : undefined);
    }
  } else if (props.type === 'asset') {
    payload.valuationMode = 'manual_amount';
  }

  emit('submit', payload);

  emit('update:modelValue', false);
};
</script>

<style lang="less" scoped>
.quick-sheet {
  box-sizing: border-box;
  max-height: 85vh;
  padding: 18px 20px calc(16px + env(safe-area-inset-bottom, 0));
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.sheet-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 12px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &.active {
    background: var(--sheet-accent-soft);
    color: var(--sheet-accent-deep);
    box-shadow: inset 0 0 0 1px var(--sheet-accent-border);
  }
}

.sheet-hint {
  margin: 0px 0 10px;
  color: #9ca3af;
  font-size: 12px;
  text-align: right;
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
    background: var(--sheet-accent-soft);
    color: var(--sheet-accent-deep);
    box-shadow: inset 0 0 0 1px var(--sheet-accent-border);
  }
}

.quote-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0 12px;
  border-top: 1px solid #f3f4f6;
}

.quote-button {
  flex: 0 0 auto;
  min-width: 78px;
  min-height: 44px;
  border: none;
  border-radius: 14px;
  background: var(--sheet-accent-soft);
  color: var(--sheet-accent-deep);
  box-shadow: inset 0 0 0 1px var(--sheet-accent-border);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    color: #9ca3af;
    background: #f3f4f6;
    box-shadow: none;
    cursor: not-allowed;
  }
}

.quote-status {
  min-width: 0;
  flex: 1 1 auto;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.45;
}

.sheet-actions {
  padding-top: 14px;
  border-top: 1px solid #f3f4f6;
}

.save-btn {
  width: 100%;
  min-height: 44px;
  border: none;
  border-radius: 14px;
  background: var(--sheet-accent);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;

  &:active {
    opacity: 0.82;
  }

  &:disabled {
    background: #e5e7eb;
    color: #9ca3af;
    cursor: not-allowed;
  }
}

:deep(.ledger-sheet .van-cell) {
  padding: 12px 0;
}

:deep(.ledger-sheet .van-cell::after) {
  left: 0;
  right: 0;
}

:deep(.ledger-sheet .van-field__label) {
  color: #6b7280;
}

:deep(.ledger-sheet .van-field__control) {
  color: #111827;
  font-weight: 600;
}

:deep(.ledger-sheet .van-field__control::placeholder) {
  color: #d1d5db;
  font-weight: 500;
}

:deep(.ledger-sheet .van-field__right-icon) {
  color: #9ca3af;
}

:deep(.ledger-sheet .amount-field .van-field__control) {
  font-size: 20px;
  font-weight: 700;
}

:global(.modern-sheet-popup) {
  background: transparent !important;
  overflow: hidden !important;
  border-radius: 24px 24px 0 0 !important;
}
</style>
