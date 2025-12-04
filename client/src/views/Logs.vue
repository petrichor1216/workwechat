<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">操作日志</h1>
      <p class="page-subtitle">记录所有重要操作，防止误删或恶意删除</p>
    </header>

    <!-- 筛选条件 -->
    <div class="card filter-card">
      <div class="filter-row">
        <select class="form-select filter-select" v-model="filters.action">
          <option value="">全部操作</option>
          <option value="create">新增</option>
          <option value="update">修改</option>
          <option value="delete">删除</option>
        </select>
        <select class="form-select filter-select" v-model="filters.target_type">
          <option value="">全部类型</option>
          <option value="product">商品</option>
          <option value="sale">销售</option>
          <option value="inventory">库存</option>
        </select>
      </div>
      <div class="filter-row">
        <input type="date" class="form-input filter-date" v-model="filters.start_date" placeholder="开始日期">
        <span class="filter-sep">至</span>
        <input type="date" class="form-input filter-date" v-model="filters.end_date" placeholder="结束日期">
      </div>
      <button class="btn btn-primary btn-block" @click="loadLogs">查询</button>
    </div>

    <!-- 日志列表 -->
    <div class="list" v-if="logs.length">
      <div class="log-item" v-for="item in logs" :key="item.id" @click="showDetail(item)">
        <div class="log-header">
          <span :class="['action-tag', `action-${item.action}`]">
            {{ actionLabels[item.action] || item.action }}
          </span>
          <span :class="['type-tag', `type-${item.target_type}`]">
            {{ typeLabels[item.target_type] || item.target_type }}
          </span>
          <span class="log-time">{{ formatTime(item.created_at) }}</span>
        </div>
        <div class="log-content">{{ item.content }}</div>
        <div class="log-meta">
          <span v-if="item.operator_name">操作人: {{ item.operator_name }}</span>
          <span v-else-if="item.device_id">设备: {{ shortenId(item.device_id) }}</span>
          <span v-if="item.ip_address"> | IP: {{ item.ip_address }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="empty">
      <div class="empty-icon">📝</div>
      <div class="empty-text">暂无操作日志</div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <!-- 加载更多 -->
    <div class="load-more" v-if="logs.length && hasMore">
      <button class="btn btn-default btn-block" @click="loadMore">加载更多</button>
    </div>

    <!-- 详情弹窗 -->
    <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">操作详情</span>
          <span class="modal-close" @click="showModal = false">×</span>
        </div>
        <div class="modal-body" v-if="currentLog">
          <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-row">
              <span class="detail-label">操作类型</span>
              <span :class="['action-tag', `action-${currentLog.action}`]">
                {{ actionLabels[currentLog.action] }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">目标类型</span>
              <span :class="['type-tag', `type-${currentLog.target_type}`]">
                {{ typeLabels[currentLog.target_type] }}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">目标名称</span>
              <span>{{ currentLog.target_name || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">操作时间</span>
              <span>{{ formatFullTime(currentLog.created_at) }}</span>
            </div>
          </div>

          <div class="detail-section">
            <h4>操作内容</h4>
            <p class="detail-content">{{ currentLog.content }}</p>
          </div>

          <div class="detail-section">
            <h4>操作人信息</h4>
            <div class="detail-row">
              <span class="detail-label">操作人</span>
              <span>{{ currentLog.operator_name || '未知' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">设备标识</span>
              <span>{{ currentLog.device_id || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">IP地址</span>
              <span>{{ currentLog.ip_address || '-' }}</span>
            </div>
          </div>

          <div class="detail-section" v-if="currentLog.before_data">
            <h4>操作前数据</h4>
            <pre class="json-block">{{ formatJson(currentLog.before_data) }}</pre>
          </div>

          <div class="detail-section" v-if="currentLog.after_data">
            <h4>操作后数据</h4>
            <pre class="json-block">{{ formatJson(currentLog.after_data) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { logsApi } from '../api'

export default {
  name: 'Logs',
  data() {
    return {
      logs: [],
      loading: false,
      showModal: false,
      currentLog: null,
      hasMore: true,
      offset: 0,
      limit: 30,
      filters: {
        action: '',
        target_type: '',
        start_date: '',
        end_date: ''
      },
      actionLabels: {
        create: '新增',
        update: '修改',
        delete: '删除'
      },
      typeLabels: {
        product: '商品',
        sale: '销售',
        inventory: '库存'
      }
    }
  },
  mounted() {
    this.loadLogs()
  },
  methods: {
    async loadLogs() {
      this.loading = true
      this.offset = 0
      try {
        const params = {
          ...this.filters,
          limit: this.limit,
          offset: 0
        }
        // 移除空值
        Object.keys(params).forEach(key => {
          if (!params[key]) delete params[key]
        })

        const { data } = await logsApi.list(params)
        this.logs = data
        this.hasMore = data.length >= this.limit
      } catch (error) {
        console.error('加载日志失败:', error)
      } finally {
        this.loading = false
      }
    },
    async loadMore() {
      this.offset += this.limit
      try {
        const params = {
          ...this.filters,
          limit: this.limit,
          offset: this.offset
        }
        Object.keys(params).forEach(key => {
          if (!params[key]) delete params[key]
        })

        const { data } = await logsApi.list(params)
        this.logs.push(...data)
        this.hasMore = data.length >= this.limit
      } catch (error) {
        console.error('加载更多失败:', error)
      }
    },
    showDetail(log) {
      this.currentLog = log
      this.showModal = true
    },
    formatTime(datetime) {
      if (!datetime) return ''
      const d = new Date(datetime)
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const logDate = d.toISOString().split('T')[0]

      const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`

      if (logDate === today) {
        return `今天 ${time}`
      }

      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      if (logDate === yesterday) {
        return `昨天 ${time}`
      }

      return `${d.getMonth() + 1}/${d.getDate()} ${time}`
    },
    formatFullTime(datetime) {
      if (!datetime) return ''
      const d = new Date(datetime)
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
    },
    formatJson(obj) {
      try {
        return JSON.stringify(obj, null, 2)
      } catch {
        return String(obj)
      }
    },
    shortenId(id) {
      if (!id) return ''
      if (id.length <= 12) return id
      return id.substring(0, 6) + '...' + id.substring(id.length - 4)
    }
  }
}
</script>

<style scoped>
@import '../styles/common.css';

.filter-card {
  margin-bottom: 0;
}

.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.filter-select {
  flex: 1;
}

.filter-date {
  flex: 1;
}

.filter-sep {
  color: #999;
  font-size: 12px;
}

.log-item {
  background: #fff;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.log-item:active {
  background: #f8f8f8;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.action-tag, .type-tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
}

.action-create {
  background: #e6f7ee;
  color: #07c160;
}

.action-update {
  background: #e6f4ff;
  color: #1890ff;
}

.action-delete {
  background: #ffebee;
  color: #fa5151;
}

.type-product {
  background: #fff3e0;
  color: #ff9800;
}

.type-sale {
  background: #f3e5f5;
  color: #9c27b0;
}

.type-inventory {
  background: #e3f2fd;
  color: #2196f3;
}

.log-time {
  margin-left: auto;
  font-size: 12px;
  color: #999;
}

.log-content {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  margin-bottom: 6px;
}

.log-meta {
  font-size: 12px;
  color: #999;
}

.load-more {
  padding: 16px;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h4 {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
}

.detail-row {
  display: flex;
  padding: 6px 0;
  font-size: 14px;
}

.detail-label {
  width: 80px;
  color: #999;
  flex-shrink: 0;
}

.detail-content {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  background: #f8f8f8;
  padding: 12px;
  border-radius: 6px;
}

.json-block {
  font-size: 12px;
  background: #f8f8f8;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}
</style>
