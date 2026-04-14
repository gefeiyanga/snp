<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useStorage } from '@/composables/useStorage';

const { getItem, setItem, removeItem, clear, length, keys } = useStorage();
const inputValue = ref('');
const storedValue = ref('');
const allKeys = ref<string[]>([]);
const storageLength = ref<number>(0);
const message = ref('');

const saveData = async () => {
  if (!inputValue.value.trim()) {
    message.value = '请输入值';
    return;
  }

  try {
    await setItem('userInput', inputValue.value);
    message.value = '数据已保存到本地存储';
    inputValue.value = '';
    await refreshDisplay();
  } catch (error) {
    message.value = '保存失败: ' + (error as Error).message;
  }
};

const loadData = async () => {
  try {
    const value = await getItem<string>('userInput');
    if (value !== null) {
      storedValue.value = value;
      message.value = '数据已从本地存储加载';
    } else {
      storedValue.value = '';
      message.value = '未找到保存的数据';
    }
  } catch (error) {
    message.value = '加载失败: ' + (error as Error).message;
  }
};

const clearData = async () => {
  try {
    await clear();
    storedValue.value = '';
    inputValue.value = '';
    message.value = '存储已清空';
    await refreshDisplay();
  } catch (error) {
    message.value = '清空失败: ' + (error as Error).message;
  }
};

const refreshDisplay = async () => {
  storageLength.value = await length();
  allKeys.value = await keys();
};

onMounted(async () => {
  await refreshDisplay();
  // 尝试加载任何已保存的数据
  const savedValue = await getItem<string>('userInput');
  if (savedValue !== null) {
    storedValue.value = savedValue;
  }
});
</script>

<template>
  <div class="storage-container">
    <h2>本地存储演示</h2>

    <div class="input-section">
      <input
        v-model="inputValue"
        type="text"
        placeholder="输入要保存的数据"
        class="input-field"
      />
      <button @click="saveData" class="btn btn-save">保存</button>
    </div>

    <div class="display-section">
      <p>已保存的数据: <strong>{{ storedValue || '无数据' }}</strong></p>
    </div>

    <div class="controls">
      <button @click="loadData" class="btn btn-load">加载数据</button>
      <button @click="clearData" class="btn btn-clear">清空存储</button>
    </div>

    <div class="info-section">
      <p>存储项数量: {{ storageLength }}</p>
      <p>所有键名: {{ allKeys.join(', ') || '无数据' }}</p>
    </div>

    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<style lang="less" scoped>
.storage-container {
  max-width: 600px;
  margin: 20px auto;
  padding: 20px;
  border: 1px solid var(--van-border-color); // 使用Vant边框颜色变量
  border-radius: 8px;
  background-color: var(--van-background-2); // 使用Vant背景色变量

  h2 {
    text-align: center;
    color: var(--van-text-color); // 使用Vant文本颜色变量
    margin-bottom: 20px;
  }

  .input-section {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;

    .input-field {
      flex: 1;
      padding: 10px;
      border: 1px solid var(--van-border-color); // 使用Vant边框颜色变量
      border-radius: 4px;
      font-size: 16px;
      background-color: var(--van-background-1); // 使用Vant背景色变量
      color: var(--van-text-color); // 使用Vant文本颜色变量
    }
  }

  .controls {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;

    .btn {
      padding: 10px 15px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;

      &.btn-save {
        background-color: var(--van-primary-color); // 使用Vant主要颜色变量
        color: var(--van-white); // 使用Vant白色变量

        &:hover {
          background-color: var(--van-primary-color-dark-1); // 使用Vant主要颜色的深色变体
        }
      }

      &.btn-load {
        background-color: var(--van-success-color); // 使用Vant成功颜色变量
        color: var(--van-white); // 使用Vant白色变量

        &:hover {
          background-color: var(--van-success-color-dark-1); // 使用Vant成功颜色的深色变体
        }
      }

      &.btn-clear {
        background-color: var(--van-danger-color); // 使用Vant危险颜色变量
        color: var(--van-white); // 使用Vant白色变量

        &:hover {
          background-color: var(--van-danger-color-dark-1); // 使用Vant危险颜色的深色变体
        }
      }
    }
  }

  .display-section {
    margin-bottom: 20px;
    padding: 10px;
    background-color: var(--van-background-1); // 使用Vant背景色变量
    border-radius: 4px;
    border: 1px solid var(--van-border-color); // 使用Vant边框颜色变量
  }

  .info-section {
    margin-bottom: 15px;
    padding: 10px;
    background-color: var(--van-background-3); // 使用Vant浅色背景变量
    border-radius: 4px;
    border: 1px solid var(--van-border-color); // 使用Vant边框颜色变量
  }

  .message {
    padding: 10px;
    background-color: var(--van-background-3); // 使用Vant背景色变量
    border: 1px solid var(--van-border-color); // 使用Vant边框颜色变量
    border-radius: 4px;
    color: var(--van-text-color); // 使用Vant文本颜色变量
    text-align: center;
  }
}
</style>