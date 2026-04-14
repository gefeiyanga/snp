<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useStorage } from '@/composables/useStorage';
import ModernBottomSheet from '@/components/ModernBottomSheet.vue';

const router = useRouter();
const { getItem, setItem } = useStorage();

// 控制底部表单的显示
const showAddLiabilitySheet = ref(false);

// 负债分类数据
const liabilitiesByCategory = ref<any[]>([]);

// 负债分类
const liabilityCategories = [
  { name: '房贷', icon: 'home-o', iconBg: '#f3f4f6', iconColor: '#6b7280', dotColor: '#f87171' },
  { name: '车贷', icon: 'logistics', iconBg: '#f3f4f6', iconColor: '#6b7280', dotColor: '#f87171' },
  { name: '信用卡', icon: 'credit-pay', iconBg: '#f3f4f6', iconColor: '#6b7280', dotColor: '#f87171' },
  { name: '其他', icon: 'more-o', iconBg: '#f3f4f6', iconColor: '#6b7280', dotColor: '#f87171' }
];

// 加载负债数据
const loadLiabilities = async () => {
  const liabilities = await getItem<any[]>('liabilities') || [];

  // 按类别整理负债
  const categorizedLiabilities: any[] = [];
  liabilityCategories.forEach(category => {
    const categoryLiabilities = liabilities.filter(liability => liability.category === category.name);
    const totalAmount = categoryLiabilities.reduce((sum, liability) => sum + (liability.amount || 0), 0);
    const remainingAmount = categoryLiabilities.reduce((sum, liability) => sum + (liability.remaining || liability.amount || 0), 0);

    categorizedLiabilities.push({
      ...category,
      liabilities: categoryLiabilities,
      totalAmount,
      remainingAmount
    });
  });

  liabilitiesByCategory.value = categorizedLiabilities;
};

onMounted(() => {
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

// 导航到首页
const goHome = () => {
  router.push('/');
};

// 添加新负债
const addLiability = () => {
  showAddLiabilitySheet.value = true;
};

// 保存新负债
const onSaveLiability = async (data: any) => {
  const liabilities = await getItem<any[]>('liabilities') || [];
  const newLiability = {
    id: Date.now().toString(), // 简单的ID生成
    name: data.name,
    amount: Number(data.amount),
    category: data.category,
    description: data.description,
    monthlyPayment: data.monthlyPayment ? Number(data.monthlyPayment) : 0,
    interestRate: data.interestRate ? Number(data.interestRate) : 0,
    dueDate: data.dueDate,
    remaining: Number(data.amount) // 初始化剩余金额为总金额
  };
  liabilities.push(newLiability);
  await setItem('liabilities', liabilities);
  loadLiabilities(); // 重新加载数据
};

// 格式化数字为货币格式
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0
  }).format(value);
};
</script>

<template>
  <div class="liabilities-page">
    <van-nav-bar
      class="nav-bar"
      title="负债"
      left-arrow
      :border="false"
      @click-left="goHome"
    >
      <template #right>
        <van-icon name="plus" size="20" color="#333" @click="addLiability" />
      </template>
    </van-nav-bar>

    <div class="total-card">
      <div class="total-label">总负债</div>
      <div class="total-amount">{{ formatCurrency(totalLiabilities) }}</div>
      <div class="total-meta">
        <div class="meta-item">
          <div class="meta-label">已还金额</div>
          <div class="meta-value paid-value">{{ formatCurrency(paidAmount) }}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">负债笔数</div>
          <div class="meta-value debt-count">{{ liabilitiesByCategory.reduce((sum, category) => sum + category.liabilities.length, 0) }}笔</div>
        </div>
      </div>
    </div>

    <div class="section-title">负债类别</div>
    <div class="categories-grid">
      <div
        v-for="(category, index) in liabilitiesByCategory"
        :key="index"
        class="category-card"
      >
        <div class="category-icon" :style="{ background: category.iconBg }">
          <van-icon :name="category.icon" size="16" :color="category.iconColor" />
        </div>
        <div class="category-info">
          <div class="category-name">{{ category.name }}</div>
          <div class="category-value">{{ formatCurrency(category.remainingAmount) }}</div>
        </div>
      </div>
    </div>

    <div class="detail-list-container">
      <div class="detail-list-title">明细列表</div>
      <van-cell-group :border="false">
        <div
          v-for="(category, index) in liabilitiesByCategory"
          :key="index"
          class="detail-row"
        >
          <div class="detail-left">
            <span class="detail-dot" :style="{ backgroundColor: category.dotColor }"></span>
            <div>
              <div class="detail-name">{{ category.name }}</div>
              <div class="detail-subtitle">{{ category.liabilities.length }}项记录</div>
            </div>
          </div>
          <div class="detail-right">
            <span class="detail-amount">{{ formatCurrency(category.remainingAmount) }}</span>
            <van-icon name="arrow" size="12" color="#d1d5db" />
          </div>
        </div>
      </van-cell-group>
    </div>

    <!-- 底部表单 -->
    <ModernBottomSheet
      v-model="showAddLiabilitySheet"
      title="新增负债"
      type="liability"
      submit-text="添加负债"
      @submit="onSaveLiability"
    />
  </div>
</template>

<style lang="less" scoped>
@import (reference) '@/styles/finance-theme.less';

.liabilities-page {
  padding-bottom: 24px;
  background: @finance-page-bg;

  .nav-bar {
    .finance-nav-bar();
  }

  .total-card {
    --finance-total-card-bg: rgba(220, 38, 38, 0.08);
    --finance-total-card-text: #111827;
    .finance-total-card();

    .paid-value {
      color: #111827;
    }

    .debt-count {
      color: #111827;
    }
  }

  .section-title {
    .finance-section-title();
    color: #6b7280;
  }

  .categories-grid {
    .finance-two-col-grid();

    .category-card {
      .finance-mini-card();

      .category-icon {
        .finance-icon-box();
      }

      .category-name {
        font-size: 11px;
        color: #6b7280;
      }

      .category-value {
        margin-top: 2px;
        font-size: 13px;
        font-weight: 500;
        color: #111827;
      }
    }
  }

  .detail-list-container {
    .finance-detail-list-container();

    .detail-name {
      color: #111827;
    }

    .detail-subtitle {
      color: #9ca3af;
    }

    .detail-amount {
      color: #111827;
    }
  }
}
</style>