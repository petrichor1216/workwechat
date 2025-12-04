<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">私域进销存</h1>
      <p class="page-subtitle">{{ today }}</p>
    </header>

    <div class="dashboard-content">
      <!-- 今日概览 -->
      <div class="card">
        <h3 class="card-title">今日概览</h3>
        <div class="grid-3">
          <div class="stat-item">
            <div class="stat-value">{{ overview.today?.order_count || 0 }}</div>
            <div class="stat-label">订单数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value money">{{ formatMoney(overview.today?.revenue) }}</div>
            <div class="stat-label">销售额</div>
          </div>
          <div class="stat-item">
            <div class="stat-value profit">{{ formatMoney(overview.today?.profit) }}</div>
            <div class="stat-label">利润</div>
          </div>
        </div>
      </div>

      <!-- 本月统计 -->
      <div class="card">
        <h3 class="card-title">本月统计</h3>
        <div class="grid-3">
          <div class="stat-item">
            <div class="stat-value">{{ overview.month?.order_count || 0 }}</div>
            <div class="stat-label">订单数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value money">{{ formatMoney(overview.month?.revenue) }}</div>
            <div class="stat-label">销售额</div>
          </div>
          <div class="stat-item">
            <div class="stat-value profit">{{ formatMoney(overview.month?.profit) }}</div>
            <div class="stat-label">利润</div>
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="card">
        <h3 class="card-title">快捷操作</h3>
        <div class="quick-actions">
          <router-link to="/sales" class="action-btn">
            <span class="action-icon">💰</span>
            <span>记录销售</span>
          </router-link>
          <router-link to="/products" class="action-btn">
            <span class="action-icon">📦</span>
            <span>添加商品</span>
          </router-link>
          <router-link to="/inventory" class="action-btn">
            <span class="action-icon">📥</span>
            <span>商品入库</span>
          </router-link>
          <router-link to="/stats" class="action-btn">
            <span class="action-icon">📊</span>
            <span>查看报表</span>
          </router-link>
        </div>
      </div>

      <!-- 库存预警 -->
      <div class="card" v-if="overview.products?.low_stock > 0">
        <h3 class="card-title">
          库存预警
          <span class="tag tag-red">{{ overview.products.low_stock }}件</span>
        </h3>
        <p class="warning-text">有 {{ overview.products.low_stock }} 件商品库存不足5件，请及时补货</p>
        <router-link to="/inventory" class="btn btn-small btn-default" style="margin-top: 8px;">
          查看详情
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { statsApi } from '../api'

export default {
  name: 'Dashboard',
  data() {
    return {
      overview: {},
      loading: true
    }
  },
  computed: {
    today() {
      const d = new Date()
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    }
  },
  mounted() {
    this.loadOverview()
  },
  methods: {
    async loadOverview() {
      try {
        const { data } = await statsApi.overview()
        this.overview = data
      } catch (error) {
        console.error('加载数据失败:', error)
      } finally {
        this.loading = false
      }
    },
    formatMoney(value) {
      return (value || 0).toFixed(2)
    }
  }
}
</script>

<style scoped>
@import '../styles/common.css';

.dashboard-content {
  padding-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 8px 0;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background: #f8f8f8;
  border-radius: 8px;
  text-decoration: none;
  color: #333;
}

.action-icon {
  font-size: 24px;
  margin-bottom: 6px;
}

.action-btn span:last-child {
  font-size: 12px;
}

.warning-text {
  font-size: 13px;
  color: #666;
}
</style>
