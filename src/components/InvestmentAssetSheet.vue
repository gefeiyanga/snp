<template>
  <van-popup
    v-model:show="showPopup"
    position="bottom"
    :style="{ height: 'auto', maxHeight: '90vh' }"
    round
    :close-on-click-overlay="true"
  >
    <div class="sheet-container">
      <div class="sheet-header">
        <h2 class="sheet-title">{{ title }}</h2>
      </div>

      <div class="form-wrapper" ref="formWrapperRef">
        <van-form @submit="onSubmit">
          <!-- 投资名称 -->
          <div class="input-group">
            <label class="input-label">投资名称</label>
            <van-field
              v-model="formData.name"
              name="name"
              placeholder="输入投资名称"
              class="custom-input"
              :rules="[{ required: true, message: '请输入投资名称' }]"
            />
          </div>

          <!-- 投资类型 -->
          <div class="input-group">
            <label class="input-label">投资类型</label>
            <van-field
              readonly
              :model-value="formData.investmentType || investmentTypePlaceholder"
              :placeholder="investmentTypePlaceholder"
              @click="showInvestmentTypePicker = true"
              class="custom-input"
            />
          </div>

          <!-- 数量 -->
          <div class="input-group">
            <label class="input-label">持有数量</label>
            <van-field
              v-model="formData.quantity"
              name="quantity"
              type="number"
              placeholder="0"
              class="custom-input"
              :rules="[{ required: true, message: '请输入持有数量' }]"
            />
          </div>

          <!-- 购买单价 -->
          <div class="input-group">
            <label class="input-label">购买单价 (¥)</label>
            <van-field
              v-model="formData.purchasePrice"
              name="purchasePrice"
              type="number"
              placeholder="0.00"
              class="custom-input"
            >
              <template #input>
                <div class="currency-input">
                  <span class="currency-symbol">¥</span>
                  <input
                    v-model="formData.purchasePrice"
                    type="number"
                    placeholder="0.00"
                    class="amount-control"
                  />
                </div>
              </template>
            </van-field>
          </div>

          <!-- 购买日期 -->
          <div class="input-group">
            <label class="input-label">购买日期</label>
            <van-field
              readonly
              :model-value="formData.purchaseDate"
              placeholder="选择购买日期"
              @click="showDatePicker = true"
              class="custom-input"
            />
          </div>

          <!-- 当前单价 -->
          <div class="input-group">
            <label class="input-label">当前单价 (¥)</label>
            <van-field
              v-model="formData.currentPrice"
              name="currentPrice"
              type="number"
              placeholder="0.00"
              class="custom-input"
            >
              <template #input>
                <div class="currency-input">
                  <span class="currency-symbol">¥</span>
                  <input
                    v-model="formData.currentPrice"
                    type="number"
                    placeholder="0.00"
                    class="amount-control"
                  />
                </div>
              </template>
            </van-field>
          </div>

          <!-- 估值计算（只读） -->
          <div class="input-group">
            <label class="input-label">当前估值 (¥)</label>
            <van-field
              :model-value="calculatedValue"
              readonly
              class="custom-input readonly-field"
              input-align="right"
            >
              <template #input>
                <div class="currency-input">
                  <span class="currency-symbol">¥</span>
                  <span class="amount-display">{{ calculatedValue }}</span>
                </div>
              </template>
            </van-field>
          </div>

          <!-- 盈亏金额（只读） -->
          <div class="input-group">
            <label class="input-label">盈亏金额 (¥)</label>
            <van-field
              :model-value="profitLossAmount"
              readonly
              class="custom-input readonly-field"
              :class="{ 'positive-profit': profitLossAmount >= 0, 'negative-profit': profitLossAmount < 0 }"
              input-align="right"
            >
              <template #input>
                <div class="currency-input">
                  <span class="currency-symbol">¥</span>
                  <span class="amount-display">{{ profitLossAmount }}</span>
                </div>
              </template>
            </van-field>
          </div>

          <!-- 盈亏比例（只读） -->
          <div class="input-group">
            <label class="input-label">盈亏比例 (%)</label>
            <van-field
              :model-value="profitLossPercentage"
              readonly
              class="custom-input readonly-field"
              :class="{ 'positive-profit': profitLossPercentage >= 0, 'negative-profit': profitLossPercentage < 0 }"
              input-align="right"
            >
              <template #input>
                <div class="percentage-display">
                  <span class="percentage-value">{{ profitLossPercentage }}%</span>
                </div>
              </template>
            </van-field>
          </div>

          <!-- 描述 -->
          <div class="input-group">
            <label class="input-label">描述</label>
            <van-field
              v-model="formData.description"
              name="description"
              type="textarea"
              placeholder="添加投资说明..."
              rows="2"
              autosize
              class="custom-textarea"
            />
          </div>

          <div class="submit-section">
            <van-button
              round
              block
              type="primary"
              native-type="submit"
              class="submit-button"
            >
              {{ submitText }}
            </van-button>
          </div>
        </van-form>
      </div>
    </div>

    <!-- 投资类型选择器 -->
    <van-action-sheet
      v-model:show="showInvestmentTypePicker"
      :actions="investmentTypeActions"
      cancel-text="取消"
      @cancel="showInvestmentTypePicker = false"
      @select="onInvestmentTypeSelect"
    />

    <!-- 日期选择器 -->
    <van-popup
      v-model:show="showDatePicker"
      position="bottom"
      round
      :style="{ height: '40%', maxHeight: '40vh' }"
    >
      <div class="date-picker-header">
        <van-button type="default" @click="showDatePicker = false">取消</van-button>
        <h3>选择购买日期</h3>
        <van-button type="primary" @click="confirmDate">确定</van-button>
      </div>

      <div class="date-picker-body">
        <van-picker
          :columns="dateColumns"
          @change="onDateChange"
          :default-index="[yearIndex, monthIndex, dayIndex]"
        />
      </div>
    </van-popup>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface InvestmentFormData {
  id?: string;
  name: string;
  investmentType: string;
  quantity: number | string;
  purchasePrice: number | string;
  currentPrice: number | string;
  purchaseDate: string;
  description?: string;
}

interface Props {
  modelValue: boolean;
  title: string;
  initialData?: Partial<InvestmentFormData>;
  submitText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  submitText: '保存',
  initialData: () => ({})
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'submit': [data: InvestmentFormData];
}>();

const showPopup = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value);
  }
});

const formData = ref<InvestmentFormData>({
  name: '',
  investmentType: '',
  quantity: '',
  purchasePrice: '',
  currentPrice: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  description: ''
});

// 控制选择器的显示
const showInvestmentTypePicker = ref(false);
const showDatePicker = ref(false);
const formWrapperRef = ref<HTMLElement | null>(null);

// 日期选择相关
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const selectedDay = ref(new Date().getDate());

// 计算当前日期索引
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const currentDay = new Date().getDate();

const yearIndex = computed(() => Math.max(0, selectedYear.value - 2000));
const monthIndex = computed(() => selectedMonth.value - 1);
const dayIndex = computed(() => selectedDay.value - 1);

// 生成年份列（从2000年开始到未来几年）
const years = Array.from({ length: 30 }, (_, i) => `${2000 + i}年`);
const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
const days = Array.from({ length: 31 }, (_, i) => `${i + 1}日`);

// 根据选择的月份更新天数
const updateDays = () => {
  // 计算当前月有多少天
  const daysInMonth = new Date(selectedYear.value, selectedMonth.value, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => `${i + 1}日`);
};

// 日期选择列
const dateColumns = computed(() => [
  { values: years, defaultIndex: yearIndex.value },
  { values: months, defaultIndex: monthIndex.value },
  { values: updateDays(), defaultIndex: dayIndex.value }
]);

// 投资类型选项
const investmentTypes = [
  { name: '股票', value: '股票' },
  { name: '基金', value: '基金' },
  { name: '加密货币', value: '加密货币' },
  { name: '债券', value: '债券' },
  { name: '期货', value: '期货' },
  { name: '外汇', value: '外汇' },
  { name: '贵金属', value: '贵金属' },
  { name: '其他投资', value: '其他投资' }
];

const investmentTypePlaceholder = computed(() => '选择投资类型');
const investmentTypeActions = computed(() => investmentTypes.map(type => ({ name: type.name })));

// 计算属性
const calculatedValue = computed(() => {
  const quantity = parseFloat(formData.value.quantity as string) || 0;
  const currentPrice = parseFloat(formData.value.currentPrice as string) || 0;
  return (quantity * currentPrice).toFixed(2);
});

const profitLossAmount = computed(() => {
  const quantity = parseFloat(formData.value.quantity as string) || 0;
  const purchasePrice = parseFloat(formData.value.purchasePrice as string) || 0;
  const currentPrice = parseFloat(formData.value.currentPrice as string) || 0;
  return ((currentPrice - purchasePrice) * quantity).toFixed(2);
});

const profitLossPercentage = computed(() => {
  const purchasePrice = parseFloat(formData.value.purchasePrice as string) || 0;
  const currentPrice = parseFloat(formData.value.currentPrice as string) || 0;

  if (purchasePrice === 0) return '0.00';

  const percentage = ((currentPrice - purchasePrice) / purchasePrice) * 100;
  return percentage.toFixed(2);
});

// 监听初始数据变化
watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      formData.value = {
        name: newData.name || '',
        investmentType: newData.investmentType || '',
        quantity: newData.quantity || '',
        purchasePrice: newData.purchasePrice || '',
        currentPrice: newData.currentPrice || '',
        purchaseDate: newData.purchaseDate || new Date().toISOString().split('T')[0],
        description: newData.description || ''
      };

      // 解析日期并更新选择的年月日
      const dateParts = formData.value.purchaseDate.split('-');
      if (dateParts.length === 3) {
        selectedYear.value = parseInt(dateParts[0]);
        selectedMonth.value = parseInt(dateParts[1]);
        selectedDay.value = parseInt(dateParts[2]);
      }
    }
  },
  { immediate: true }
);

// 投资类型选择处理
const onInvestmentTypeSelect = (action: { name: string }) => {
  formData.value.investmentType = action.name;
  showInvestmentTypePicker.value = false;
};

// 日期选择处理
const onDateChange = (values: string[]) => {
  const yearStr = values[0].replace('年', '');
  const monthStr = values[1].replace('月', '');
  const dayStr = values[2].replace('日', '');

  selectedYear.value = parseInt(yearStr);
  selectedMonth.value = parseInt(monthStr);
  selectedDay.value = parseInt(dayStr);
};

const confirmDate = () => {
  const dateStr = `${selectedYear.value}-${selectedMonth.value.toString().padStart(2, '0')}-${selectedDay.value.toString().padStart(2, '0')}`;
  formData.value.purchaseDate = dateStr;
  showDatePicker.value = false;
};

const onSubmit = () => {
  emit('submit', {
    ...formData.value,
    quantity: parseFloat(formData.value.quantity as string),
    purchasePrice: parseFloat(formData.value.purchasePrice as string),
    currentPrice: parseFloat(formData.value.currentPrice as string)
  });
  emit('update:modelValue', false);
};
</script>

<style lang="less" scoped>
.sheet-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100vh;
  background: var(--van-background-1);
  overflow: hidden;

  .sheet-header {
    flex-shrink: 0;
    padding: 16px;
    padding-bottom: 8px;
    background: var(--van-background-1);
    z-index: 10;
    position: relative;

    .sheet-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--van-text-color);
      text-align: center;
    }

    .divider {
      height: 1px;
      background: var(--van-border-color);
      margin-top: 12px;
    }
  }

  .form-wrapper {
    flex: 1;
    overflow-y: scroll;
    -webkit-overflow-scrolling: touch;
    padding: 0 16px 16px;
    background: var(--van-background-1);
    position: relative;

    // 针对不同平台的滚动条优化
    &::-webkit-scrollbar {
      display: none;
    }

    -ms-overflow-style: none;
    scrollbar-width: none;

    .input-group {
      margin-bottom: 16px;

      .input-label {
        display: block;
        font-size: 14px;
        color: var(--van-text-color-2);
        margin-bottom: 8px;
        font-weight: 500;
      }

      .custom-input {
        :deep(.van-field__control) {
          font-size: 16px;
          padding: 12px 16px;
          border: 1px solid var(--van-border-color);
          border-radius: 8px;
          background: var(--van-background-2);
        }

        :deep(.van-field__body) {
          align-items: center;
          min-height: 48px;
        }

        :deep(.van-field__right-icon) {
          align-self: center;
        }

        &.readonly-field {
          :deep(.van-field__control) {
            color: var(--van-text-color);
          }

          &.positive-profit {
            :deep(.van-field__control) {
              color: var(--van-success-color);
            }
          }

          &.negative-profit {
            :deep(.van-field__control) {
              color: var(--van-danger-color);
            }
          }
        }
      }

      .currency-input {
        display: flex;
        align-items: center;
        width: 100%;

        .currency-symbol {
          font-size: 16px;
          color: var(--van-text-color-2);
          margin-right: 8px;
          font-weight: 600;
        }

        .amount-control {
          flex: 1;
          border: none;
          outline: none;
          font-size: 16px;
          background: transparent;

          &::placeholder {
            color: var(--van-text-color-3);
          }
        }

        .amount-display {
          flex: 1;
          font-size: 16px;
          color: var(--van-text-color);
        }
      }

      .percentage-display {
        width: 100%;
        display: flex;
        justify-content: flex-end;

        .percentage-value {
          font-size: 16px;
          color: var(--van-text-color);
          font-weight: 600;
        }
      }

      .custom-textarea {
        :deep(.van-field__control) {
          font-size: 16px;
          padding: 12px 16px;
          border: 1px solid var(--van-border-color);
          border-radius: 8px;
          background: var(--van-background-2);
          min-height: 80px;
        }
      }
    }

    .submit-section {
      margin-top: 24px;

      .submit-button {
        height: 48px;
        font-size: 16px;
        font-weight: 600;
        border: none;
        background: linear-gradient(135deg, var(--van-primary-color), #667eea);

        :deep(.van-button__text) {
          color: white;
        }
      }
    }
  }
}

.date-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--van-border-color);
  background: var(--van-background-1);
  position: relative;
  z-index: 10;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
}

.date-picker-body {
  height: calc(40vh - 65px);
  overflow: hidden;
  background: var(--van-background-1);
}

:deep(.van-popup) {
  border-top-left-radius: 16px !important;
  border-top-right-radius: 16px !important;
  overflow: hidden;
}

:deep(.van-picker__columns) {
  height: 100%;
}
</style>