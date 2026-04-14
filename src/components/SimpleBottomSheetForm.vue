<template>
  <van-popup
    v-model:show="showPopup"
    position="bottom"
    round
    :style="{ height: '60%' }"
    closeable
    close-icon="close"
    :close-on-click-overlay="true"
  >
    <div class="sheet-content">
      <div class="sheet-header">
        <h2 class="sheet-title">{{ title }}</h2>
      </div>

      <div class="form-content">
        <van-form @submit="onSubmit">
          <van-cell-group inset>
            <van-field
              v-model="formData.name"
              name="name"
              label="名称"
              placeholder="请输入名称"
              :rules="[{ required: true, message: '请填写名称' }]"
            />

            <van-field
              v-model="formData.amount"
              name="amount"
              type="number"
              label="金额"
              placeholder="请输入金额"
              :rules="[{ required: true, message: '请填写金额' }]"
            >
              <template #input>
                <input
                  v-model="formData.amount"
                  type="number"
                  placeholder="请输入金额"
                  class="van-field__control"
                />
              </template>
            </van-field>

            <van-field
              name="category"
              label="类别"
              :placeholder="categoryPlaceholder"
              readonly
              clickable
              @click="showCategoryPicker = true"
            />

            <van-field
              v-model="formData.description"
              name="description"
              label="备注"
              type="textarea"
              placeholder="添加备注（可选）"
              rows="2"
              autosize
            />

            <van-field
              v-if="isLiability"
              v-model="formData.monthlyPayment"
              name="monthlyPayment"
              type="number"
              label="月还款额"
              placeholder="请输入月还款额"
            >
              <template #input>
                <input
                  v-model="formData.monthlyPayment"
                  type="number"
                  placeholder="请输入月还款额"
                  class="van-field__control"
                />
              </template>
            </van-field>
          </van-cell-group>

          <div style="margin: 16px;">
            <van-button
              round
              block
              type="primary"
              native-type="submit"
            >
              {{ submitText }}
            </van-button>
          </div>
        </van-form>
      </div>
    </div>

    <!-- 类别选择器 -->
    <van-popup
      v-model:show="showCategoryPicker"
      position="bottom"
      round
    >
      <van-picker
        :columns="categoryColumns"
        @confirm="onCategoryConfirm"
        @cancel="showCategoryPicker = false"
      />
    </van-popup>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface FormData {
  id?: string;
  name: string;
  amount: string | number;
  category: string;
  description?: string;
  monthlyPayment?: string | number;
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
  'submit': [data: FormData];
}>();

const showPopup = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const formData = ref<FormData>({
  name: '',
  amount: '',
  category: '',
  description: '',
  monthlyPayment: ''
});

const showCategoryPicker = ref(false);

const categoryPlaceholder = computed(() =>
  props.type === 'asset' ? '选择资产类别' : '选择负债类别'
);

const assetCategories = [
  '现金', '银行资金', '投资', '不动产', '其他'
];

const liabilityCategories = [
  '房贷', '车贷', '信用卡', '其他'
];

const categoryColumns = computed(() =>
  props.type === 'asset' ? assetCategories : liabilityCategories
);

const isLiability = computed(() => props.type === 'liability');

// 监听初始数据变化
watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      formData.value = {
        name: newData.name || '',
        amount: newData.amount || '',
        category: newData.category || '',
        description: newData.description || '',
        monthlyPayment: newData.monthlyPayment || ''
      };
    }
  },
  { immediate: true }
);

const onCategoryConfirm = (value: string) => {
  formData.value.category = value;
  showCategoryPicker.value = false;
};

const onSubmit = () => {
  emit('submit', {
    ...formData.value,
    amount: Number(formData.value.amount),
    monthlyPayment: formData.value.monthlyPayment ? Number(formData.value.monthlyPayment) : undefined
  });
  showPopup.value = false;
};
</script>

<style lang="less" scoped>
.sheet-content {
  height: 100%;
  display: flex;
  flex-direction: column;

  .sheet-header {
    padding: 16px 20px 8px;
    border-bottom: 1px solid var(--van-border-color);

    .sheet-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--van-text-color);
    }
  }

  .form-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 0;
    background: var(--van-background-1);
  }
}

:deep(.van-cell) {
  background: var(--van-background-2);
  border-radius: 12px;
  margin: 4px 16px;
}
</style>