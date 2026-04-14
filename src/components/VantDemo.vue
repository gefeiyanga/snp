<script setup lang="ts">
import { ref } from 'vue';

const username = ref('');
const password = ref('');

const showToast = () => {
  Toast('Hello Vant Toast!');
};

const showDialog = async () => {
  try {
    await Dialog.confirm({
      title: 'Confirmation',
      message: 'Are you sure you want to proceed?',
    });
    Toast.success('Confirmed!');
  } catch {
    Toast('Cancelled');
  }
};
</script>

<template>
  <div class="vant-demo">
    <h2>Vant 4 Component Demo</h2>

    <van-cell-group inset>
      <van-field
        v-model="username"
        label="Username"
        placeholder="Enter your username"
        left-icon="manager"
      />
      <van-field
        v-model="password"
        type="password"
        label="Password"
        placeholder="Enter your password"
        left-icon="lock"
      />
    </van-cell-group>

    <div class="button-group">
      <van-button type="primary" size="normal" @click="showToast">
        Show Toast
      </van-button>
      <van-button type="danger" size="normal" @click="showDialog">
        Show Dialog
      </van-button>
    </div>

    <div class="features">
      <h3>Features:</h3>
      <ul>
        <li>Mobile-optimized UI components</li>
        <li>Lightweight and fast</li>
        <li>Customizable themes</li>
        <li>Accessibility support</li>
        <li>iOS/Android native feel</li>
      </ul>
    </div>
  </div>
</template>

<style lang="less" scoped>
.vant-demo {
  padding: 20px;

  h2 {
    text-align: center;
    color: var(--van-text-color); // 使用Vant文本颜色变量
    margin-bottom: 20px;
  }

  .button-group {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin: 20px 0;

    .van-button {
      flex: 1;
      max-width: 200px;
    }
  }

  .features {
    margin-top: 30px;

    h3 {
      color: var(--van-primary-color); // 使用Vant主要颜色变量
      margin-bottom: 10px;
    }

    ul {
      text-align: left;
      padding-left: 20px;

      li {
        margin-bottom: 8px;
        color: var(--van-gray-7); // 使用Vant灰色变量
      }
    }
  }
}
</style>