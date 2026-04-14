<script setup lang="ts">
interface DataItem {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: DataItem[];
  size?: number;
  strokeWidth?: number;
  radius?: number;
  center?: number;
  totalValue?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 88,
  strokeWidth: 14,
  radius: 30,
  center: 44,
  totalValue: 0,
});

// 计算总数，如果没有传入的话
const calculateTotal = () => {
  if (props.totalValue > 0) return props.totalValue;
  return props.data.reduce((sum, item) => sum + item.value, 0);
};

const total = calculateTotal();

// 计算路径数据
const getPathData = () => {
  let currentStartPercent = 0;
  const paths = [];

  for (const item of props.data) {
    const percent = total > 0 ? item.value / total : 0;

    // 计算起始角度和结束角度（转换为0-100之间的百分比）
    const startPercent = currentStartPercent;
    const endPercent = currentStartPercent + percent;

    // 将百分比转换为角度 (从-90度开始，顺时针方向)
    const startAngle = (startPercent * 360) - 90;
    const endAngle = (endPercent * 360) - 90;

    paths.push({
      color: item.color,
      name: item.name,
      value: item.value,
      percent: percent,
      startAngle: startAngle,
      endAngle: endAngle,
      startPercent: startPercent,
      endPercent: endPercent
    });

    currentStartPercent = endPercent;
  }

  return paths;
};

const paths = getPathData();

// 辅助函数：将角度转换为x,y坐标
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
};

// 创建弧形路径
const describeArc = (startAngle: number, endAngle: number) => {
  const start = polarToCartesian(props.center, props.center, props.radius, startAngle);
  const end = polarToCartesian(props.center, props.center, props.radius, endAngle);

  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? "0" : "1";

  if (start.x === end.x && start.y === end.y) {
    // 如果起始点和终点相同，则绘制完整的圆环
    return [
      "M", start.x, start.y,
      "A", props.radius, props.radius, 0, "1", 0, start.x - 0.01, start.y
    ].join(" ");
  }

  return [
    "M", start.x, start.y,
    "A", props.radius, props.radius, 0, largeArcFlag, 1, end.x, end.y
  ].join(" ");
};
</script>

<template>
  <div class="donut-chart-container">
    <svg :width="size" :height="size" viewBox="0 0 88 88" class="donut-svg">
      <g fill="none" stroke-width="strokeWidth">
        <path
          v-for="(path, index) in paths"
          :key="index"
          :d="describeArc(path.startAngle, path.endAngle)"
          :stroke="path.color"
          :stroke-width="strokeWidth"
          fill="none"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.donut-chart-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.donut-svg {
  width: 100%;
  height: 100%;
}
</style>