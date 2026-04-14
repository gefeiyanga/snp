<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// 模拟数据
const chartData = ref([
  { name: '现金', value: 15000, color: '#4CAF50' },
  { name: '银行', value: 45000, color: '#2196F3' },
  { name: '投资', value: 120000, color: '#FF9800' },
  { name: '房产', value: 2500000, color: '#9C27B0' },
  { name: '其他', value: 30000, color: '#E91E63' }
]);

const liabilityData = ref([
  { name: '房贷', value: 1800000, color: '#42a5f5' },
  { name: '车贷', value: 120000, color: '#ff7043' },
  { name: '信用卡', value: 15000, color: '#ffca28' },
  { name: '其他', value: 5000, color: '#ef5350' }
]);

// 导航到首页
const goHome = () => {
  router.push('/');
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
  <div class="statistics-page">
    <!-- 顶部导航 -->
    <van-nav-bar
      class="nav-bar"
      :bordered="false"
      @click-left="goHome"
    >
      <template #left>
        <van-icon name="arrow-left" size="18" />
      </template>
      <template #title>
        <span class="nav-title">统计</span>
      </template>
    </van-nav-bar>

    <!-- 资产分布图 -->
    <van-cell-group inset class="chart-section" title="资产分布">
      <div class="chart-placeholder">
        <div class="chart-title">资产分布</div>
        <div class="pie-chart">
          <!-- 饼图占位 -->
          <div class="chart-visual">
            <div class="pie-segment" v-for="(item, index) in chartData" :key="index" :style="{ backgroundColor: item.color }">
              <span class="segment-label">{{ item.name }}</span>
            </div>
          </div>
        </div>
        <div class="chart-summary">
          <div class="summary-item">
            <div class="summary-label">总资产</div>
            <div class="summary-value">¥2,720,000</div>
          </div>
        </div>
      </div>
    </van-cell-group>

    <!-- 负债分布图 -->
    <van-cell-group inset class="chart-section" title="负债分布" style="margin-top: 16px;">
      <div class="chart-placeholder">
        <div class="chart-title">负债分布</div>
        <div class="pie-chart">
          <!-- 饼图占位 -->
          <div class="chart-visual">
            <div class="pie-segment" v-for="(item, index) in liabilityData" :key="index" :style="{ backgroundColor: item.color }">
              <span class="segment-label">{{ item.name }}</span>
            </div>
          </div>
        </div>
        <div class="chart-summary">
          <div class="summary-item">
            <div class="summary-label">总负债</div>
            <div class="summary-value negative">¥1,940,000</div>
          </div>
        </div>
      </div>
    </van-cell-group>

    <!-- 净资产趋势 -->
    <van-cell-group inset class="chart-section" title="净资产趋势" style="margin-top: 16px;">
      <div class="chart-placeholder">
        <div class="chart-title">净资产趋势</div>
        <div class="trend-chart">
          <!-- 趋势图占位 -->
          <div class="trend-visual">
            <div class="trend-line">
              <div class="trend-point" style="bottom: 60%; left: 0;"></div>
              <div class="trend-point" style="bottom: 50%; left: 20%;"></div>
              <div class="trend-point" style="bottom: 40%; left: 40%;"></div>
              <div class="trend-point" style="bottom: 30%; left: 60%;"></div>
              <div class="trend-point" style="bottom: 20%; left: 80%;"></div>
              <div class="trend-point" style="bottom: 10%; left: 100%;"></div>
            </div>
          </div>
        </div>
        <div class="chart-summary">
          <div class="summary-item">
            <div class="summary-label">当前净资产</div>
            <div class="summary-value positive">¥780,000</div>
          </div>
        </div>
      </div>
    </van-cell-group>
  </div>
</template>

<style lang="less" scoped>
.statistics-page {
  padding-bottom: 20px;
  background: var(--van-background-1);
  min-height: 100vh;

  .nav-bar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--van-background-1);
    padding-top: env(safe-area-inset-top);

    :deep(.van-nav-bar__content) {
      background: var(--van-background-1);
    }

    .nav-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--van-text-color);
    }
  }

  .chart-section {
    margin: 16px;
    border-radius: 16px;

    :deep(.van-cell-group__title) {
      font-weight: 600;
      color: var(--van-text-color);
      padding: 16px 16px 8px 16px;
    }
  }

  .chart-placeholder {
    padding: 20px 0;
    text-align: center;

    .chart-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--van-text-color);
      margin-bottom: 16px;
    }

    .chart-visual {
      height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .pie-chart {
      .chart-visual {
        position: relative;
        width: 150px;
        height: 150px;
        margin: 0 auto;

        .pie-segment {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          clip-path: inset(0 50% 50% 0);

          .segment-label {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 12px;
            font-weight: bold;
          }
        }
      }
    }

    .trend-chart {
      .trend-visual {
        height: 120px;
        position: relative;
        margin: 0 20px;

        .trend-line {
          position: absolute;
          bottom: 20px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--van-gray-3);

          .trend-point {
            position: absolute;
            width: 8px;
            height: 8px;
            background: var(--van-primary-color);
            border-radius: 50%;
            transform: translateX(-50%);
          }
        }
      }
    }

    .chart-summary {
      display: flex;
      justify-content: center;
      gap: 24px;

      .summary-item {
        text-align: center;

        .summary-label {
          font-size: 12px;
          color: var(--van-gray-6);
          margin-bottom: 4px;
        }

        .summary-value {
          font-size: 18px;
          font-weight: 700;
          color: var(--van-text-color);

          &.positive {
            color: #00c853;
          }

          &.negative {
            color: #ff5252;
          }
        }
      }
    }
  }
}
</style>