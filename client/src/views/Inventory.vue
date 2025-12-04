<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">库存管理</h1>
      <p class="page-subtitle">管理商品入库和出库</p>
    </header>

    <!-- Tab 切换 -->
    <div class="tabs">
      <div :class="['tab', { active: activeTab === 'stock' }]" @click="activeTab = 'stock'">当前库存</div>
      <div :class="['tab', { active: activeTab === 'logs' }]" @click="activeTab = 'logs'">出入库记录</div>
    </div>

    <!-- 当前库存 -->
    <div v-show="activeTab === 'stock'">
      <div class="list" v-if="inventory.length">
        <div class="list-item" v-for="item in inventory" :key="item.id">
          <div class="list-item-content">
            <div class="list-item-title">
              {{ item.name }}
              <span v-if="item.stock < 5" class="tag tag-red">库存不足</span>
            </div>
            <div class="list-item-desc">
              售价: ¥{{ item.price }} | 成本: ¥{{ item.cost }}
            </div>
          </div>
          <div class="list-item-right">
            <div class="stock-count" :class="{ low: item.stock < 5 }">{{ item.stock }}</div>
            <div class="stock-actions" v-if="canIn || canOut">
              <button v-if="canIn" class="action-btn-small" @click="openStockModal(item, 'in')">入库</button>
              <button v-if="canOut" class="action-btn-small out" @click="openStockModal(item, 'out')">出库</button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty">
        <div class="empty-icon">📋</div>
        <div class="empty-text">暂无商品库存<br>请先在商品管理中添加商品</div>
      </div>
    </div>

    <!-- 出入库记录 -->
    <div v-show="activeTab === 'logs'">
      <div class="list" v-if="logs.length">
        <div class="list-item" v-for="item in logs" :key="item.id">
          <div class="list-item-content">
            <div class="list-item-title">
              {{ item.product_name }}
              <span :class="['tag', item.type === 'in' ? 'tag-green' : 'tag-orange']">
                {{ item.type === 'in' ? '入库' : '出库' }}
              </span>
            </div>
            <div class="list-item-desc">
              {{ formatTime(item.created_at) }}
              <span v-if="item.remark"> | {{ item.remark }}</span>
            </div>
          </div>
          <div class="list-item-extra" :class="item.type === 'in' ? 'in' : 'out'">
            {{ item.type === 'in' ? '+' : '-' }}{{ item.quantity }}
          </div>
        </div>
      </div>
      <div v-else class="empty">
        <div class="empty-icon">📝</div>
        <div class="empty-text">暂无出入库记录</div>
      </div>
    </div>

    <!-- 入库/出库弹窗 -->
    <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">{{ stockType === 'in' ? '商品入库' : '商品出库' }}</span>
          <span class="modal-close" @click="closeModal">×</span>
        </div>
        <div class="modal-body">
          <div class="selected-product">
            <div class="product-name">{{ selectedProduct?.name }}</div>
            <div class="product-stock">当前库存: {{ selectedProduct?.stock }}</div>
          </div>

          <div class="form-group">
            <label class="form-label">{{ stockType === 'in' ? '入库' : '出库' }}数量 *</label>
            <input type="number" class="form-input" v-model.number="stockForm.quantity" min="1" placeholder="请输入数量">
          </div>

          <div class="form-group">
            <label class="form-label">备注</label>
            <input type="text" class="form-input" v-model="stockForm.remark" :placeholder="stockType === 'in' ? '如：进货补货' : '如：损耗报废'">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default btn-block" @click="closeModal">取消</button>
          <button class="btn btn-primary btn-block" @click="submitStock">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { inventoryApi } from '../api'
import { hasPermission } from '../auth'

export default {
  name: 'Inventory',
  data() {
    return {
      activeTab: 'stock',
      inventory: [],
      logs: [],
      showModal: false,
      stockType: 'in',
      selectedProduct: null,
      stockForm: {
        quantity: '',
        remark: ''
      }
    }
  },
  computed: {
    canIn() {
      return hasPermission('inventory:in')
    },
    canOut() {
      return hasPermission('inventory:out')
    }
  },
  mounted() {
    this.loadInventory()
    this.loadLogs()
  },
  methods: {
    async loadInventory() {
      try {
        const { data } = await inventoryApi.list()
        this.inventory = data
      } catch (error) {
        console.error('加载库存失败:', error)
      }
    },
    async loadLogs() {
      try {
        const { data } = await inventoryApi.logs()
        this.logs = data
      } catch (error) {
        console.error('加载记录失败:', error)
      }
    },
    openStockModal(product, type) {
      this.selectedProduct = product
      this.stockType = type
      this.showModal = true
    },
    async submitStock() {
      if (!this.stockForm.quantity || this.stockForm.quantity <= 0) {
        alert('请输入有效数量')
        return
      }

      try {
        const api = this.stockType === 'in' ? inventoryApi.stockIn : inventoryApi.stockOut
        await api({
          product_id: this.selectedProduct.id,
          quantity: this.stockForm.quantity,
          remark: this.stockForm.remark
        })
        this.closeModal()
        this.loadInventory()
        this.loadLogs()
      } catch (error) {
        alert('操作失败: ' + (error.response?.data?.error || error.message))
      }
    },
    closeModal() {
      this.showModal = false
      this.selectedProduct = null
      this.stockForm = { quantity: '', remark: '' }
    },
    formatTime(datetime) {
      if (!datetime) return ''
      const d = new Date(datetime)
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
  }
}
</script>

<style scoped>
@import '../styles/common.css';

.tabs {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 14px;
  font-size: 15px;
  color: #666;
  position: relative;
  cursor: pointer;
}

.tab.active {
  color: #07c160;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 3px;
  background: #07c160;
  border-radius: 2px;
}

.list-item-right {
  text-align: right;
}

.stock-count {
  font-size: 20px;
  font-weight: 600;
  color: #07c160;
}

.stock-count.low {
  color: #fa5151;
}

.stock-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.action-btn-small {
  padding: 4px 10px;
  font-size: 12px;
  background: #e6f7ee;
  color: #07c160;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.action-btn-small.out {
  background: #fff3e0;
  color: #ff9800;
}

.list-item-extra.in {
  color: #07c160;
  font-weight: 600;
}

.list-item-extra.out {
  color: #ff9800;
  font-weight: 600;
}

.selected-product {
  background: #f8f8f8;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.product-name {
  font-size: 16px;
  font-weight: 500;
}

.product-stock {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}
</style>
