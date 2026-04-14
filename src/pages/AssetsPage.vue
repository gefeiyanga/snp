<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStorage } from '@/composables/useStorage';
import ModernBottomSheet from '@/components/ModernBottomSheet.vue';

const router = useRouter();
const { getItem, setItem } = useStorage();

// 控制底部表单的显示
const showAddAssetSheet = ref(false);
const showAssetTypeSelector = ref(false);
const assetInitialData = ref<Record<string, any>>({});

// 资产分类数据
const assetsByCategory = ref<any[]>([]);

// 资产分类
const assetCategories = [
  {
    name: '现金',
    aliases: ['现金'],
    icon: 'gold-coin-o',
    iconBg: '#f3f4f6',
    iconColor: '#6b7280',
    dotColor: '#10b981'
  },
  {
    name: '银行',
    aliases: ['银行', '银行资金'],
    icon: 'balance-o',
    iconBg: '#f3f4f6',
    iconColor: '#6b7280',
    dotColor: '#10b981'
  },
  {
    name: '投资',
    aliases: ['投资'],
    icon: 'chart-trending-o',
    iconBg: '#f3f4f6',
    iconColor: '#6b7280',
    dotColor: '#10b981'
  },
  {
    name: '房产',
    aliases: ['房产', '不动产'],
    icon: 'home-o',
    iconBg: '#f3f4f6',
    iconColor: '#6b7280',
    dotColor: '#10b981'
  },
  {
    name: '其他',
    aliases: ['其他'],
    icon: 'more-o',
    iconBg: '#f3f4f6',
    iconColor: '#6b7280',
    dotColor: '#10b981'
  }
];

// 计算总资产、总负债和净资产
const totalAssets = ref(0);
const totalLiabilities = ref(0);
const netWorth = ref(0);

// 加载资产数据
const loadAssets = async () => {
  const assets = await getItem<any[]>('assets') || [];
  const liabilities = await getItem<any[]>('liabilities') || []; // 获取负债数据

  // 按类别整理资产
  const categorizedAssets: any[] = [];
  assetCategories.forEach(category => {
    const categoryAssets = assets.filter(asset => category.aliases.includes(asset.category));
    const totalAmount = categoryAssets.reduce((sum, asset) => sum + (asset.amount || 0), 0);

    categorizedAssets.push({
      ...category,
      assets: categoryAssets,
      totalAmount
    });
  });

  assetsByCategory.value = categorizedAssets;

  // 计算总资产
  totalAssets.value = assets.reduce((sum, asset) => sum + (asset.amount || 0), 0);

  // 计算总负债
  totalLiabilities.value = liabilities.reduce((sum, liability) => sum + (liability.amount || 0), 0);

  // 计算净资产
  netWorth.value = totalAssets.value - totalLiabilities.value;
};

onMounted(() => {
  loadAssets();
});

// 导航到首页
const goHome = () => {
  router.push('/');
};

// 添加新资产
const addAsset = () => {
  showAssetTypeSelector.value = true;
};

// 选择资产类型
const onSelectAssetType = (action: { name: string }) => {
  showAssetTypeSelector.value = false;

  if (action.name === '普通资产') {
    assetInitialData.value = {};
    showAddAssetSheet.value = true;
  } else if (action.name === '投资资产') {
    assetInitialData.value = { category: '投资' };
    showAddAssetSheet.value = true;
  }
};

// 资产类型选择选项
const assetTypeActions = computed(() => [
  { name: '普通资产', value: 'regular' },
  { name: '投资资产', value: 'investment' }
]);

// 保存普通资产
const onSaveAsset = async (data: any) => {
  const assets = await getItem<any[]>('assets') || [];
  const newAsset = {
    id: Date.now().toString(), // 简单的ID生成
    name: data.name,
    amount: Number(data.amount),
    category: data.category,
    description: data.description
  };
  assets.push(newAsset);
  await setItem('assets', assets);
  loadAssets(); // 重新加载数据
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
  <div class="assets-page">
    <!-- 顶部导航 -->
    <van-nav-bar
      class="nav-bar"
      title="资产"
      left-arrow
      :border="false"
      @click-left="goHome"
    >
      <template #right>
        <van-icon name="plus" size="20" color="#333" @click="addAsset" />
      </template>
    </van-nav-bar>

    <!-- 资产总览卡片 -->
    <div class="total-card">
      <div class="total-label">总资产</div>
      <div class="total-amount">{{ formatCurrency(totalAssets) }}</div>
      <div class="total-meta">
        <div class="meta-item">
          <div class="meta-label">净资产</div>
          <div class="meta-value net-value">{{ formatCurrency(netWorth) }}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">总负债</div>
          <div class="meta-value debt-value">{{ formatCurrency(totalLiabilities) }}</div>
        </div>
      </div>
    </div>

    <div class="section-title">资产类别</div>
    <div class="categories-grid">
      <div
        v-for="(category, index) in assetsByCategory"
        :key="index"
        class="category-card"
      >
        <div class="category-icon" :style="{ background: category.iconBg }">
          <van-icon :name="category.icon" size="16" :color="category.iconColor" />
        </div>
        <div class="category-info">
          <div class="category-name">{{ category.name }}</div>
          <div class="category-value">{{ formatCurrency(category.totalAmount) }}</div>
        </div>
      </div>
    </div>

    <!-- 底部明细列表 -->
    <div class="detail-list-container">
      <div class="detail-list-title">明细列表</div>
      <van-cell-group :border="false">
        <div
          v-for="(category, index) in assetsByCategory"
          :key="index"
          class="detail-row"
        >
          <div class="detail-left">
            <span class="detail-dot" :style="{ backgroundColor: category.dotColor }"></span>
            <div>
              <div class="detail-name">{{ category.name }}</div>
              <div class="detail-subtitle">{{ category.assets.length }}项记录</div>
            </div>
          </div>
          <div class="detail-right">
            <span class="detail-amount">{{ formatCurrency(category.totalAmount) }}</span>
            <van-icon name="arrow" size="12" color="#d1d5db" />
          </div>
        </div>
      </van-cell-group>
    </div>

    <!-- 资产类型选择器 -->
    <van-action-sheet
      v-model:show="showAssetTypeSelector"
      :actions="assetTypeActions"
      cancel-text="取消"
      @cancel="showAssetTypeSelector = false"
      @select="onSelectAssetType"
    />

    <!-- 普通资产录入表单 -->
    <ModernBottomSheet
      v-model="showAddAssetSheet"
      title="新增资产"
      type="asset"
      :initial-data="assetInitialData"
      submit-text="添加资产"
      @submit="onSaveAsset"
    />
  </div>
</template>

<style lang="less" scoped>
@import (reference) '@/styles/finance-theme.less';

.assets-page {
  padding-bottom: 24px;
  background: @finance-page-bg;

  .nav-bar {
    .finance-nav-bar();
  }

  .total-card {
    --finance-total-card-bg: rgba(22, 163, 74, 0.08);
    --finance-total-card-text: #111827;
    .finance-total-card();

    .net-value {
      color: #111827;
    }

    .debt-value {
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