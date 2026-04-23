<template>
  <van-popup
    v-model:show="showPopup"
    position="bottom"
    :style="{ height: '70vh' }"
    class="modern-sheet-popup"
    round
    :close-on-click-overlay="true"
  >
    <div class="sheet-page">
      <div
        class="content-panel"
        ref="contentPanelRef"
        :style="{
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s ease'
        }"
      >
        <div
          class="drag-handle-zone"
          @touchstart="onDragStart"
          @touchmove="onDragMove"
          @touchend="onDragEnd"
          @touchcancel="onDragEnd"
        >
          <div class="drag-bar"></div>
        </div>

        <div class="sheet-scroll">
          <div v-if="!lockCategory" class="type-tags">
            <van-tag
              v-for="item in typeOptions"
              :key="item"
              round
              size="medium"
              :plain="activeType !== item"
              :style="activeType === item ? activeTagStyle : inactiveTagStyle"
              @click="activeType = item"
            >
              {{ item }}
            </van-tag>
          </div>

          <div class="amount-section">
            <div class="amount-label">{{ amountLabel }}</div>
            <div class="amount-value">
              <template v-if="isInvestmentAsset">
                <input
                  v-model="formData.quantity"
                  type="number"
                  placeholder="0.00"
                  class="amount-input"
                  :class="{ empty: !hasPrimaryAmount }"
                />
              </template>
              <template v-else>
                <span class="amount-prefix">¥ </span>
                <input
                  v-model="formData.amount"
                  type="number"
                  placeholder="0.00"
                  class="amount-input"
                  :class="{ empty: !hasPrimaryAmount }"
                />
              </template>
            </div>
            <p v-if="isInvestmentAsset" class="amount-helper">按持仓数量和当前单价计算总价值</p>
          </div>

          <div class="form-item">
            <div class="field-label">{{ nameLabel }}</div>
            <div class="field-wrapper">
              <van-field
                v-model="formData.name"
                :border="false"
                :placeholder="namePlaceholder"
                class="form-field"
              />
            </div>
          </div>

          <div class="form-item">
            <div class="field-label">{{ dateLabel }}</div>
            <div class="field-wrapper">
              <van-field
                :model-value="formData.date"
                :border="false"
                readonly
                clickable
                right-icon="notes-o"
                class="form-field"
                @click="showDatePicker = true"
              />
            </div>
          </div>

          <div class="form-item">
            <div class="field-label">备注说明</div>
            <div class="field-wrapper textarea-wrapper">
              <van-field
                v-model="formData.description"
                type="textarea"
                rows="3"
                autosize
                :border="false"
                :placeholder="remarkPlaceholder"
                class="form-field"
              />
            </div>
          </div>

          <template v-if="isInvestmentAsset">
            <div class="form-item">
              <div class="field-label">投资类型</div>
              <div class="type-tags">
                <van-tag
                  v-for="opt in investmentTypeOptions"
                  :key="opt.value"
                  round
                  size="medium"
                  :plain="formData.investmentType !== opt.value"
                  :style="formData.investmentType === opt.value ? activeTagStyle : inactiveTagStyle"
                  @click="formData.investmentType = opt.value"
                >
                  {{ opt.label }}
                </van-tag>
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">标的代码</div>
              <div class="field-wrapper">
                <van-field
                  v-model="formData.symbol"
                  :border="false"
                  placeholder="例如 510300 / AAPL / BTC"
                  class="form-field"
                />
              </div>
              <div class="quote-actions">
                <van-button
                  size="small"
                  round
                  plain
                  :disabled="!canLookupQuote || isLookingUpQuote"
                  @click="refreshInvestmentQuote"
                >
                  {{ isLookingUpQuote ? '查询中...' : '查询价格' }}
                </van-button>
                <span class="quote-status">{{ quoteStatusText }}</span>
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">当前单价</div>
              <div class="field-wrapper">
                <van-field
                  v-model="formData.unitPrice"
                  type="text"
                  inputmode="decimal"
                  :border="false"
                  placeholder="用于计算当前总价值"
                  class="form-field"
                />
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">成本价</div>
              <div class="field-wrapper">
                <van-field
                  v-model="formData.costPrice"
                  type="text"
                  inputmode="decimal"
                  :border="false"
                  placeholder="选填"
                  class="form-field"
                />
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">币种</div>
              <div class="type-tags">
                <van-tag
                  v-for="opt in currencyOptions"
                  :key="opt"
                  round
                  size="medium"
                  :plain="formData.currency !== opt"
                  :style="formData.currency === opt ? activeTagStyle : inactiveTagStyle"
                  @click="formData.currency = opt"
                >
                  {{ opt }}
                </van-tag>
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">当前总价值（试算）</div>
              <div class="field-wrapper">
                <van-field :model-value="investmentValuePreview" readonly :border="false" class="form-field" />
              </div>
            </div>
          </template>

          <template v-if="type === 'liability' && isAmortizingSheet">
            <div class="form-item">
              <div class="field-label">还款方式</div>
              <div class="type-tags">
                <van-tag
                  v-for="opt in repaymentMethodOptions"
                  :key="opt.value"
                  round
                  size="medium"
                  :plain="formData.repaymentMethod !== opt.value"
                  :style="formData.repaymentMethod === opt.value ? activeTagStyle : inactiveTagStyle"
                  @click="formData.repaymentMethod = opt.value"
                >
                  {{ opt.label }}
                </van-tag>
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">总期数（月）</div>
              <div class="field-wrapper">
                <van-field
                  v-model="formData.termMonths"
                  type="digit"
                  :border="false"
                  placeholder="例如 360"
                  class="form-field"
                />
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">年利率（%）</div>
              <div class="field-wrapper">
                <van-field
                  v-model="formData.interestRate"
                  type="text"
                  inputmode="decimal"
                  :border="false"
                  placeholder="必填"
                  class="form-field"
                />
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">月供（试算，只读）</div>
              <div class="field-wrapper">
                <van-field :model-value="previewMonthly" readonly :border="false" class="form-field" />
              </div>
            </div>
          </template>
          <template v-else-if="type === 'liability'">
            <div class="form-item">
              <div class="field-label">月供（元）</div>
              <div class="field-wrapper">
                <van-field
                  v-model="formData.monthlyPayment"
                  type="digit"
                  :border="false"
                  placeholder="选填"
                  class="form-field"
                />
              </div>
            </div>
            <div class="form-item">
              <div class="field-label">年利率（%）</div>
              <div class="field-wrapper">
                <van-field
                  v-model="formData.interestRate"
                  type="text"
                  inputmode="decimal"
                  :border="false"
                  placeholder="选填"
                  class="form-field"
                />
              </div>
            </div>
          </template>

        </div>

        <div class="sheet-footer">
          <van-button
            round
            class="confirm-button"
            :style="confirmButtonStyle"
            @click="submitAsset"
          >
            {{ submitText }}
          </van-button>
        </div>
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
  investmentType: 'fund',
  unitPrice: '',
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
        tagBg: '#ecfdf5',
        tagText: '#047857',
        tagBorder: '#a7f3d0',
        buttonShadow: 'rgba(16, 185, 129, 0.26)'
      }
    : {
        accent: '#f87171',
        tagBg: '#fff1f2',
        tagText: '#be123c',
        tagBorder: '#fecdd3',
        buttonShadow: 'rgba(248, 113, 113, 0.28)'
      }
);
const typeOptions = computed(() =>
  props.type === 'asset' ? ['投资', '现金', '银行', '其他'] : ['房贷', '车贷', '信用卡', '其他']
);
const activeType = ref(typeOptions.value[0]);
const investmentTypeOptions = [
  { value: 'fund' as const, label: '基金' },
  { value: 'stock' as const, label: '股票' },
  { value: 'crypto' as const, label: '加密货币' }
];
const currencyOptions: AssetCurrency[] = ['CNY', 'USD', 'USDT'];

const isAmortizingSheet = computed(
  () => props.type === 'liability' && (activeType.value === '房贷' || activeType.value === '车贷')
);
const isInvestmentAsset = computed(() => props.type === 'asset' && activeType.value === '投资');

const hasPrimaryAmount = computed(() =>
  isInvestmentAsset.value ? Number(formData.value.quantity || 0) > 0 : Number(formData.value.amount || 0) > 0
);
const submitText = computed(() => props.submitText);
const amountLabel = computed(() => {
  if (props.type === 'asset') return isInvestmentAsset.value ? '持有数量' : '金额';
  if (isAmortizingSheet.value) return '合同本金（元）';
  if (props.mode === 'edit') return '当前剩余本金';
  return '负债金额';
});
const dateLabel = computed(() => {
  if (props.type === 'asset') return '记录日期';
  if (isAmortizingSheet.value) return '第一期还款日';
  return '发生日期';
});

const previewMonthly = computed(() => {
  if (!isAmortizingSheet.value) return '—';
  const P = Number(formData.value.amount || 0);
  const n = Number(formData.value.termMonths || 0);
  const parsed = parseInterestRatePercent(formData.value.interestRate);
  const rateRaw = formData.value.interestRate.trim();
  if (rateRaw !== '' && parsed === null) return '—';
  const rate = parsed ?? 0;
  if (!P || !n || n < 1) return '—';
  const first = formData.value.date;
  try {
    const v = scheduledMonthlyPayment(P, rate, n, formData.value.repaymentMethod, first, todayYmd());
    if (!Number.isFinite(v)) return '—';
    return v.toFixed(2);
  } catch {
    return '—';
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
  if (!quantity || !unitPrice) return '—';
  return (Math.round(quantity * unitPrice * 100) / 100).toFixed(2);
});

const activeTagStyle = computed(
  () =>
    `background:${themePalette.value.tagBg};color:${themePalette.value.tagText};border:1px solid ${themePalette.value.tagBorder};padding:6px 14px;font-size:11px`
);
const inactiveTagStyle = 'background:white;color:#6b7280;border:1px solid #e2e5eb;padding:6px 14px;font-size:11px';
const confirmButtonStyle = computed(() => ({
  background: themePalette.value.accent,
  color: '#ffffff',
  boxShadow: `0 8px 18px ${themePalette.value.buttonShadow}`
}));
const isLookingUpQuote = ref(false);
const quoteStatusText = ref('可按类型查询价格');
const dragOffsetY = ref(0);
const isDragging = ref(false);
const dragStartY = ref(0);
const contentPanelRef = ref<HTMLElement | null>(null);

const closeThresholdPx = computed(() => {
  const panelHeight = contentPanelRef.value?.clientHeight || window.innerHeight * 0.7;
  return Math.max(110, panelHeight * 0.2);
});
const requiresApiKey = computed(
  () => isInvestmentAsset.value && requiresApiKeyForInvestmentType(formData.value.investmentType)
);
const canLookupQuote = computed(
  () =>
    isInvestmentAsset.value &&
    !!formData.value.symbol.trim() &&
    (!requiresApiKey.value || hasMarketDataApiKey())
);

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
      investmentType: newData?.investmentType ?? 'fund',
      unitPrice: newData?.unitPrice !== undefined && newData?.unitPrice !== '' ? String(newData.unitPrice) : '',
      costPrice: newData?.costPrice !== undefined && newData?.costPrice !== '' ? String(newData.costPrice) : '',
      symbol: newData?.symbol || '',
      currency: newData?.currency ?? 'CNY',
      monthlyPayment: String(newData?.monthlyPayment ?? ''),
      interestRate: String(newData?.interestRate ?? ''),
      termMonths:
        newData?.termMonths !== undefined && newData?.termMonths !== ''
          ? String(newData.termMonths)
          : '',
      repaymentMethod: newData?.repaymentMethod === 'equal_principal' ? 'equal_principal' : 'equal_payment'
    };
    formData.value = merged;

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
    dragOffsetY.value = 0;
    isDragging.value = false;
    quoteStatusText.value = requiresApiKey.value && !hasMarketDataApiKey() ? '股票/基金需配置 API Key；加密货币免 Key' : '可按类型查询价格';
  }
});

watch(
  () => formData.value.investmentType,
  (value) => {
    if (!isInvestmentAsset.value) return;
    quoteStatusText.value =
      requiresApiKeyForInvestmentType(value) && !hasMarketDataApiKey()
        ? '股票/基金需配置 API Key；加密货币免 Key'
        : value === 'crypto'
          ? '加密货币走 Binance 免 Key'
          : '可按类型查询价格';
  },
  { immediate: true }
);

const closeSheet = () => {
  emit('update:modelValue', false);
};

const onDragStart = (event: TouchEvent) => {
  if (showDatePicker.value) return;
  isDragging.value = true;
  dragStartY.value = event.touches[0].clientY;
  dragOffsetY.value = 0;
};

const onDragMove = (event: TouchEvent) => {
  if (!isDragging.value) return;
  const deltaY = event.touches[0].clientY - dragStartY.value;
  if (deltaY <= 0) {
    dragOffsetY.value = 0;
    return;
  }
  dragOffsetY.value = deltaY;
  event.preventDefault();
};

const onDragEnd = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  if (dragOffsetY.value > closeThresholdPx.value) {
    closeSheet();
    return;
  }
  dragOffsetY.value = 0;
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
      currency: formData.value.currency
    });
    formData.value.unitPrice = quote.price.toFixed(4).replace(/\.?0+$/, '');
    quoteStatusText.value = quote.asOf ? `已更新：${quote.asOf}` : '价格已更新';
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
      showToast('请输入当前单价');
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
    payload.costPrice = formData.value.costPrice.trim() ? Number(formData.value.costPrice) : undefined;
    payload.investmentType = formData.value.investmentType;
    payload.symbol = formData.value.symbol.trim() || undefined;
    payload.currency = formData.value.currency;
    payload.amount = Number(investmentValuePreview.value || 0);
  } else if (props.type === 'asset') {
    payload.valuationMode = 'manual_amount';
  }

  emit('submit', payload);

  emit('update:modelValue', false);
};
</script>

<style lang="less" scoped>
.sheet-page {
  height: 100%;
  background: transparent;
  overflow: hidden;
}

.content-panel {
  background: white;
  border-radius: 24px 24px 0 0;
  margin-top: 0;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  box-shadow: 0 -8px 24px rgba(17, 24, 39, 0.08);
}

.sheet-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 0 20px calc(92px + env(safe-area-inset-bottom, 0px));
}

.drag-handle-zone {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 0 0 44px;
  padding-top: 6px;
  padding-bottom: 6px;
  box-sizing: border-box;
  touch-action: none;
}

.drag-bar {
  width: 36px;
  height: 4px;
  background: #e2e5eb;
  border-radius: 2px;
  margin: 0 auto;
}

.type-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  overflow: visible;
  margin-bottom: 18px;
}

.amount-section {
  text-align: center;
  padding: 8px 0 18px;
}

.amount-helper {
  margin: 8px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.amount-label {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 6px;
}

.amount-value {
  display: flex;
  justify-content: center;
  align-items: baseline;
}

.amount-prefix {
  color: #6b7280;
  font-size: 20px;
}

.amount-input {
  width: 150px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 32px;
  font-weight: 500;
  color: #111827;
  text-align: left;
}

.amount-input.empty {
  color: #d1d5db;
}

.amount-input::-webkit-outer-spin-button,
.amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.form-item {
  margin-bottom: 14px;
}

.quote-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.quote-status {
  font-size: 12px;
  color: #9ca3af;
}

.field-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}

.field-wrapper {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e8eaef;
  background: #f8f9fb;
}

.textarea-wrapper {
  overflow: hidden;
}

.form-field {
  background: transparent;

  :deep(.van-field__control) {
    color: #111827;
  }

  :deep(.van-field__control::placeholder) {
    color: #d1d5db;
  }

  :deep(.van-field__right-icon) {
    color: #9ca3af;
  }
}

.sheet-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  padding: 14px 20px calc(4px + env(safe-area-inset-bottom, 0px));
  background: transparent;
  border-top: none;
  pointer-events: none;
  z-index: 2;
}

.confirm-button {
  border: none;
  color: white;
  height: 50px;
  min-width: 140px;
  padding: 0 28px;
  font-size: 15px;
  font-weight: 500;
  border-radius: 32px;
  pointer-events: auto;
}

:global(.modern-sheet-popup) {
  background: transparent !important;
}
</style>
