<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';

// 注册ECharts模块
use([
  CanvasRenderer,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

interface Props {
  type?: 'pie' | 'bar';
  data: Array<{ name: string; value: number; color?: string }>;
  title?: string;
  height?: string;
  showLegend?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'pie',
  height: '300px',
  showLegend: true, // 默认显示图例
});

// 生成ECharts选项
const getOption = () => {
  const seriesData = props.data.map(item => ({
    value: item.value,
    name: item.name,
    itemStyle: item.color ? { color: item.color } : {}
  }));

  if (props.type === 'pie') {
    return {
      title: props.title ? { text: props.title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: props.showLegend
        ? {
            orient: 'vertical', // 垂直布局
            right: 10, // 位置在右侧
            top: 'center', // 垂直居中
            textStyle: {
              fontSize: 10 // 字体大小
            },
            itemGap: 6, // 间距
            itemWidth: 10, // 图例标记宽度
            itemHeight: 10, // 图例标记高度
            formatter: function (name: string) {
              const item = props.data.find(d => d.name === name);
              return `${name}: ${item ? item.value.toLocaleString() : ''}`;
            }
          }
        : undefined,
      series: [
        {
          name: props.title || '数据',
          type: 'pie',
          radius: ['30%', '70%'], // 增大环的内外半径
          center: ['35%', '50%'], // 将饼图向左移动到左侧，並調整大小以佔據更多空間
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false // 隐藏饼图上的标签
          },
          emphasis: {
            label: {
              show: false // 高亮时也不显示标签
            }
          },
          labelLine: {
            show: false // 隐藏引导线
          },
          data: seriesData
        }
      ]
    };
  } else { // bar chart
    return {
      title: props.title ? { text: props.title, left: 'center' } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: props.showLegend ? {
        orient: 'vertical',
        right: 10,
        top: 'center',
        data: props.data.map(item => item.name)
      } : undefined,
      xAxis: {
        type: 'category',
        data: props.data.map(item => item.name),
        axisLabel: {
          fontSize: 10,
          interval: 0 // 显示所有标签
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10
        }
      },
      series: [
        {
          name: props.title || '数据',
          type: 'bar',
          data: seriesData.map(item => item.value),
          itemStyle: {
            color: function(params: any) {
              return props.data[params.dataIndex]?.color || '#5470c6';
            }
          }
        }
      ]
    };
  }
};

// 图表实例引用
const chartOptions = ref(getOption());

// 监听数据变化
watch(() => props.data, () => {
  chartOptions.value = getOption();
}, { deep: true });
</script>

<template>
  <v-chart
    :option="chartOptions"
    :style="{ height }"
    autoresize
  />
</template>

<style scoped>
.chart-container {
  width: 100%;
}
</style>