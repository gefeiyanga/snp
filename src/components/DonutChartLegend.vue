<script setup lang="ts">
interface LegendItem {
  name: string;
  color: string;
}

interface Props {
  data: LegendItem[];
}

defineProps<Props>();
</script>

<template>
  <div class="legend-container">
    <div
      v-for="(item, index) in data"
      :key="index"
      class="legend-item"
    >
      <div class="legend-dot" :style="{ backgroundColor: item.color }"></div>
      <span class="legend-label">{{ item.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.legend-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
</style>