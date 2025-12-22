<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">数据统计</h1>
      <p class="page-subtitle">销售与利润分析</p>
    </header>

    <!-- 时间范围选择 -->
    <div class="card">
      <div class="range-tabs">
        <div :class="['range-tab', { active: timeRange === '7' }]" @click="setTimeRange('7')">近7天</div>
        <div :class="['range-tab', { active: timeRange === '30' }]" @click="setTimeRange('30')">近30天</div>
        <div :class="['range-tab', { active: timeRange === '90' }]" @click="setTimeRange('90')">近90天</div>
      </div>
    </div>

    <!-- 汇总数据 -->
    <div class="card">
      <h3 class="card-title">数据汇总</h3>
      <div class="grid-2">
        <div class="summary-item">
          <div class="summary-value money">{{ formatMoney(totalRevenue) }}</div>
          <div class="summary-label">总销售额</div>
        </div>
        <div class="summary-item">
          <div class="summary-value profit">¥{{ formatMoney(totalProfit) }}</div>
          <div class="summary-label">总利润</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">{{ totalOrders }}</div>
          <div class="summary-label">订单数</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">{{ profitRate }}%</div>
          <div class="summary-label">利润率</div>
        </div>
      </div>
    </div>

    <!-- 销售趋势图 -->
    <div class="card">
      <h3 class="card-title">销售趋势</h3>
      <div class="chart-container">
        <canvas ref="trendChart"></canvas>
      </div>
    </div>

    <!-- 商品排行 -->
    <div class="card">
      <h3 class="card-title">商品销售排行</h3>
      <div class="ranking-list" v-if="ranking.length">
        <div class="ranking-item" v-for="(item, index) in ranking" :key="index">
          <div class="ranking-index" :class="{ top: index < 3 }">{{ index + 1 }}</div>
          <div class="ranking-content">
            <div class="ranking-name">{{ item.product_name }}</div>
            <div class="ranking-stats">
              销量: {{ item.total_quantity }} | 销售额: ¥{{ formatMoney(item.total_revenue) }}
            </div>
          </div>
          <div class="ranking-profit">
            利润 ¥{{ formatMoney(item.total_profit) }}
          </div>
        </div>
      </div>
      <div v-else class="empty-small">暂无数据</div>
    </div>
  </div>
</template>

<script>
import { statsApi } from '../api'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

export default {
  name: 'Stats',
  data() {
    return {
      timeRange: '30',
      dailyData: [],
      ranking: [],
      chart: null
    }
  },
  computed: {
    totalRevenue() {
      return this.dailyData.reduce((sum, d) => sum + d.revenue, 0)
    },
    totalProfit() {
      return this.dailyData.reduce((sum, d) => sum + d.profit, 0)
    },
    totalOrders() {
      return this.dailyData.reduce((sum, d) => sum + d.order_count, 0)
    },
    profitRate() {
      if (this.totalRevenue === 0) return '0.0'
      return (((parseFloat(this.totalProfit) || 0) / (parseFloat(this.totalRevenue) || 1)) * 100).toFixed(1)
    }
  },
  mounted() {
    this.loadData()
  },
  methods: {
    setTimeRange(range) {
      this.timeRange = range
      this.loadData()
    },
    async loadData() {
      try {
        const [dailyRes, rankingRes] = await Promise.all([
          statsApi.daily({ days: this.timeRange }),
          statsApi.ranking({ limit: 10 })
        ])
        this.dailyData = dailyRes.data
        this.ranking = rankingRes.data
        this.renderChart()
      } catch (error) {
        console.error('加载统计数据失败:', error)
      }
    },
    formatMoney(value) {
      const num = parseFloat(value) || 0
      return num.toFixed(2)
    },
    renderChart() {
      const ctx = this.$refs.trendChart
      if (!ctx) return

      if (this.chart) {
        this.chart.destroy()
      }

      const labels = this.dailyData.map(d => {
        const date = new Date(d.date)
        return `${date.getMonth() + 1}/${date.getDate()}`
      })

      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: '销售额',
              data: this.dailyData.map(d => d.revenue),
              borderColor: '#07c160',
              backgroundColor: 'rgba(7, 193, 96, 0.1)',
              fill: true,
              tension: 0.3
            },
            {
              label: '利润',
              data: this.dailyData.map(d => d.profit),
              borderColor: '#1890ff',
              backgroundColor: 'rgba(24, 144, 255, 0.1)',
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      })
    }
  }
}
</script>

<style scoped>
@import '../styles/common.css';

.range-tabs {
  display: flex;
  background: #f5f5f5;
  border-radius: 6px;
  padding: 4px;
}

.range-tab {
  flex: 1;
  text-align: center;
  padding: 8px;
  font-size: 14px;
  color: #666;
  border-radius: 4px;
  cursor: pointer;
}

.range-tab.active {
  background: #fff;
  color: #07c160;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-item {
  text-align: center;
  padding: 12px 0;
}

.summary-value {
  font-size: 22px;
  font-weight: 600;
  color: #333;
}

.summary-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.chart-container {
  height: 200px;
  margin-top: 8px;
}

.ranking-list {
  margin-top: 8px;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.ranking-item:last-child {
  border-bottom: none;
}

.ranking-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
  background: #f5f5f5;
  border-radius: 50%;
  margin-right: 12px;
}

.ranking-index.top {
  background: #07c160;
  color: #fff;
}

.ranking-content {
  flex: 1;
  min-width: 0;
}

.ranking-name {
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ranking-stats {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.ranking-profit {
  font-size: 12px;
  color: #07c160;
  white-space: nowrap;
}

.empty-small {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 13px;
}
</style>
