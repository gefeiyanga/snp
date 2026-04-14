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

        <div class="type-tags">
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
            <span class="amount-prefix">¥ </span>
            <input
              v-model="formData.amount"
              type="number"
              placeholder="0.00"
              class="amount-input"
              :class="{ empty: !hasAmount }"
            />
          </div>
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

        <van-button
          block
          round
          class="confirm-button"
          :style="confirmButtonStyle"
          @click="submitAsset"
        >
          {{ submitText }}
        </van-button>
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

interface FormData {
  id?: string;
  name: string;
  amount: string;
  category: string;
  description: string;
  date: string;
}

interface Props {
  modelValue: boolean;
  title: string;
  type: 'asset' | 'liability';
  initialData?: Partial<FormData>;
  submitText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  submitText: '保存',
  initialData: () => ({})
});

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
  name: '',
  amount: '',
  category: '',
  description: '',
  date: defaultDate
});

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
  props.type === 'asset' ? ['投资', '现金', '银行', '房产', '其他'] : ['房贷', '车贷', '信用卡', '其他']
);
const activeType = ref(typeOptions.value[0]);

const hasAmount = computed(() => Number(formData.value.amount || 0) > 0);
const submitText = computed(() => props.submitText);
const amountLabel = computed(() => (props.type === 'asset' ? '买入金额' : '负债金额'));
const dateLabel = computed(() => (props.type === 'asset' ? '买入日期' : '发生日期'));
const nameLabel = computed(() => (props.type === 'asset' ? '资产名称' : '负债名称'));
const namePlaceholder = computed(() => (props.type === 'asset' ? '输入资产名称...' : '输入负债名称...'));
const remarkPlaceholder = computed(() => (props.type === 'asset' ? '添加投资备注...' : '添加负债备注...'));

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
const dragOffsetY = ref(0);
const isDragging = ref(false);
const dragStartY = ref(0);
const contentPanelRef = ref<HTMLElement | null>(null);

const closeThresholdPx = computed(() => {
  const panelHeight = contentPanelRef.value?.clientHeight || window.innerHeight * 0.7;
  return Math.max(110, panelHeight * 0.2);
});

watch(activeType, (value) => {
  formData.value.category = value;
});

watch(
  () => props.initialData,
  (newData) => {
    const merged = {
      name: newData?.name || '',
      amount: newData?.amount ? String(newData.amount) : '',
      category: newData?.category || typeOptions.value[0],
      description: newData?.description || '',
      date: newData?.date || defaultDate
    };
    formData.value = merged;
    activeType.value = merged.category;

    const [year, month, day] = merged.date.split('-');
    if (year && month && day) {
      pickerDate.value = [year, month, day];
    }
  },
  { immediate: true }
);

watch(showPopup, (visible) => {
  if (visible) {
    dragOffsetY.value = 0;
    isDragging.value = false;
  }
});

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

const confirmDate = () => {
  formData.value.date = `${pickerDate.value[0]}-${pickerDate.value[1]}-${pickerDate.value[2]}`;
  showDatePicker.value = false;
};

const submitAsset = () => {
  if (!formData.value.name.trim()) {
    showToast('请输入名称');
    return;
  }

  if (!Number(formData.value.amount || 0)) {
    showToast('请输入金额');
    return;
  }

  emit('submit', {
    name: formData.value.name.trim(),
    amount: Number(formData.value.amount),
    category: activeType.value,
    description: formData.value.description,
    date: formData.value.date,
    purchaseDate: formData.value.date,
    dueDate: formData.value.date
  });

  emit('update:modelValue', false);
};
</script>

<style lang="less" scoped>
.sheet-page {
  min-height: 70vh;
  height: 70vh;
  background: transparent;
  overflow: hidden;
}

.content-panel {
  background: white;
  border-radius: 24px 24px 0 0;
  margin-top: 0;
  padding: 20px;
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  box-shadow: 0 -8px 24px rgba(17, 24, 39, 0.08);
}

.drag-handle-zone {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 30px;
  margin: -8px 0 8px;
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
  gap: 7px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 18px;
  scrollbar-width: none;
}

.type-tags::-webkit-scrollbar {
  display: none;
}

.amount-section {
  text-align: center;
  padding: 8px 0 18px;
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

.confirm-button {
  border: none;
  color: white;
  height: 50px;
  font-size: 15px;
  font-weight: 500;
  border-radius: 32px;
  margin-top: 24px;
}

:global(.modern-sheet-popup) {
  background: transparent !important;
}
</style>