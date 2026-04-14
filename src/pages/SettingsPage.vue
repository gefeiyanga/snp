<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

// 导航到首页
const goHome = () => {
  router.push('/');
};

// 模拟功能函数
const handleBackup = () => {
  console.log('执行数据备份');
};

const handleRestore = () => {
  console.log('执行数据恢复');
};

const handleExport = () => {
  console.log('导出数据');
};

const handleAbout = () => {
  console.log('关于应用');
};
</script>

<template>
  <div class="settings-page">
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
        <span class="nav-title">设置</span>
      </template>
    </van-nav-bar>

    <div class="settings-content">
      <!-- 数据管理 -->
      <van-cell-group inset class="settings-group">
        <van-cell title="数据备份" is-link @click="handleBackup" />
        <van-cell title="数据恢复" is-link @click="handleRestore" />
        <van-cell title="导出数据" is-link @click="handleExport" />
      </van-cell-group>

      <!-- 应用信息 -->
      <van-cell-group inset class="settings-group" style="margin-top: 16px;">
        <van-cell title="关于应用" is-link @click="handleAbout" />
        <van-cell title="版本" value="v1.0.0" />
      </van-cell-group>
    </div>
  </div>
</template>

<style lang="less" scoped>
.settings-page {
  padding-bottom: 20px;
  background: var(--van-background-1);
  min-height: 100vh;

  .nav-bar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--van-background-2);
    padding-top: env(safe-area-inset-top);

    :deep(.van-nav-bar__content) {
      background: var(--van-background-2);
    }

    .nav-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--van-text-color);
    }
  }

  .settings-content {
    padding: 16px 0;
  }

  .settings-group {
    border-radius: 16px;
    margin: 0 16px;

    :deep(.van-cell) {
      border-radius: 12px;
      margin: 4px 0;

      &:first-child {
        margin-top: 0;
      }

      &:last-child {
        margin-bottom: 0;
      }
    }

    :deep(.van-cell__title) {
      font-weight: 500;
    }

    :deep(.van-cell__value) {
      color: var(--van-gray-6);
    }
  }
}
</style>