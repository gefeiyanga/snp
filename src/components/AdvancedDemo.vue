<script setup lang="ts">
import { useStorage } from '@/composables/useStorage';

const { getItem, setItem } = useStorage();
const counter = ref(0);
const name = ref('');

// 使用VueUse的useLocalStorage
const localStorageCounter = useStorage<number>('counter', 0);

const increment = () => {
  counter.value++;
  localStorageCounter.value = counter.value;
};

const decrement = () => {
  counter.value--;
  localStorageCounter.value = counter.value;
};

// 使用VueUse的useDark
const isDark = useDark();

// 使用VueUse的onClickOutside
const menuRef = ref(null);
const isOpen = ref(false);

onClickOutside(menuRef, () => {
  isOpen.value = false;
});

// 使用useStorage composable
const saveName = async () => {
  if (name.value) {
    await setItem('userName', name.value);
  }
};

const loadName = async () => {
  const storedName = await getItem<string>('userName');
  if (storedName) {
    name.value = storedName;
  }
};
</script>

<template>
  <div class="advanced-demo">
    <h2>Advanced Features Demo</h2>

    <div class="section">
      <h3>Counter with Local Storage</h3>
      <p>Current Count: {{ counter }}</p>
      <p>Stored Count: {{ localStorageCounter }}</p>
      <div class="button-group">
        <van-button @click="increment" type="primary">Increment</van-button>
        <van-button @click="decrement" type="warning">Decrement</van-button>
      </div>
    </div>

    <div class="section">
      <h3>Name Storage</h3>
      <van-field v-model="name" placeholder="Enter your name" label="Name" />
      <div class="button-group">
        <van-button @click="saveName" type="primary">Save Name</van-button>
        <van-button @click="loadName" type="success">Load Name</van-button>
      </div>
    </div>

    <div class="section">
      <h3>Theme Toggle</h3>
      <van-switch v-model="isDark" size="20" />
      <span>{{ isDark ? 'Dark Theme' : 'Light Theme' }}</span>
    </div>

    <div class="section">
      <h3>Click Outside Demo</h3>
      <div ref="menuRef" class="dropdown-container">
        <van-button @click="isOpen = !isOpen" type="default">Toggle Menu</van-button>
        <div v-show="isOpen" class="dropdown-menu">
          <p>Click outside to close</p>
          <p>This demonstrates onClickOutside</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.advanced-demo {
  padding: 20px;

  .section {
    margin-bottom: 30px;
    padding: 15px;
    border: 1px solid var(--van-border-color); // 使用Vant边框颜色变量
    border-radius: 8px;
    background-color: var(--van-background-2); // 使用Vant背景色变量

    h3 {
      color: var(--van-primary-color); // 使用Vant主要颜色变量
      margin-bottom: 15px;
    }
  }

  .button-group {
    display: flex;
    gap: 10px;
    margin-top: 10px;

    .van-button {
      flex: 1;
    }
  }

  .dropdown-container {
    position: relative;

    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      width: 100%;
      background: var(--van-background-1); // 使用Vant背景色变量
      border: 1px solid var(--van-border-color); // 使用Vant边框颜色变量
      border-radius: 4px;
      padding: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      z-index: 1000;
    }
  }
}
</style>