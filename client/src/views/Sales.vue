<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">销售记录</h1>
      <p class="page-subtitle">点击右下角添加新记录</p>
    </header>

    <!-- 销售列表 -->
    <div class="list" v-if="sales.length">
      <div class="list-item" v-for="item in sales" :key="item.id">
        <div class="list-item-content">
          <div class="list-item-title">
            {{ item.product_name }}
            <span v-if="item.is_custom" class="tag tag-orange">定制</span>
            <span class="tag tag-green">x{{ item.quantity }}</span>
          </div>
          <div class="list-item-desc">
            {{ item.sale_date }}
            <span v-if="item.customer"> | {{ item.customer }}</span>
            <span v-if="item.remark"> | {{ item.remark }}</span>
          </div>
        </div>
        <div class="list-item-right">
          <div class="list-item-extra">¥{{ (item.price * item.quantity).toFixed(2) }}</div>
          <div class="list-item-profit">利润 ¥{{ ((item.price - item.cost) * item.quantity).toFixed(2) }}</div>
          <button v-if="canDelete" class="delete-btn" @click.stop="deleteSale(item)">删除</button>
        </div>
      </div>
    </div>

    <div v-else class="empty">
      <div class="empty-icon">💰</div>
      <div class="empty-text">暂无销售记录</div>
    </div>

    <!-- 添加按钮 -->
    <button v-if="canCreate" class="fab" @click="openModal">+</button>

    <!-- 添加弹窗 -->
    <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">记录销售</span>
          <span class="modal-close" @click="closeModal">×</span>
        </div>
        <div class="modal-body">
          <!-- 选择方式 -->
          <div class="form-group">
            <div class="toggle-btns">
              <button :class="['toggle-btn', { active: !isCustom }]" @click="isCustom = false">选择商品</button>
              <button :class="['toggle-btn', { active: isCustom }]" @click="isCustom = true">定制品</button>
            </div>
          </div>

          <!-- 选择已有商品 -->
          <div v-if="!isCustom" class="form-group">
            <label class="form-label">选择商品 *</label>
            <select class="form-select" v-model="form.product_id" @change="onProductSelect">
              <option value="">请选择商品</option>
              <option v-for="p in products" :key="p.id" :value="p.id">
                {{ p.name }} (库存: {{ p.stock }})
              </option>
            </select>
          </div>

          <!-- 定制品名称 -->
          <div v-else class="form-group">
            <label class="form-label">商品名称 *</label>
            <input type="text" class="form-input" v-model="form.product_name" placeholder="请输入商品名称">
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">数量 *</label>
              <input type="number" class="form-input" v-model.number="form.quantity" min="1" placeholder="1">
            </div>
            <div class="form-group">
              <label class="form-label">日期</label>
              <input type="date" class="form-input" v-model="form.sale_date">
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">售价</label>
              <input type="number" class="form-input" v-model.number="form.price" placeholder="0.00" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">成本价</label>
              <input type="number" class="form-input" v-model.number="form.cost" placeholder="0.00" step="0.01">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">客户信息</label>
            <input type="text" class="form-input" v-model="form.customer" placeholder="选填">
          </div>

          <div class="form-group">
            <label class="form-label">备注</label>
            <textarea class="form-textarea" v-model="form.remark" placeholder="选填"></textarea>
          </div>

          <!-- 预览 -->
          <div class="preview-card" v-if="form.quantity > 0 && form.price > 0">
            <div class="preview-row">
              <span>销售金额</span>
              <span class="money">{{ (form.price * form.quantity).toFixed(2) }}</span>
            </div>
            <div class="preview-row">
              <span>预计利润</span>
              <span class="profit">¥{{ ((form.price - (form.cost || 0)) * form.quantity).toFixed(2) }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default btn-block" @click="closeModal">取消</button>
          <button class="btn btn-primary btn-block" @click="saveSale">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { salesApi, productApi } from '../api'
import { hasPermission } from '../auth'

export default {
  name: 'Sales',
  data() {
    return {
      sales: [],
      products: [],
      showModal: false,
      isCustom: false,
      form: {
        product_id: '',
        product_name: '',
        quantity: 1,
        price: '',
        cost: '',
        customer: '',
        remark: '',
        sale_date: new Date().toISOString().split('T')[0]
      }
    }
  },
  computed: {
    canCreate() {
      return hasPermission('sale:create')
    },
    canDelete() {
      return hasPermission('sale:delete')
    }
  },
  mounted() {
    this.loadSales()
    this.loadProducts()
  },
  methods: {
    async loadSales() {
      try {
        const { data } = await salesApi.list()
        this.sales = data
      } catch (error) {
        console.error('加载销售记录失败:', error)
      }
    },
    async loadProducts() {
      try {
        const { data } = await productApi.list()
        this.products = data.filter(p => !p.is_custom)
      } catch (error) {
        console.error('加载商品失败:', error)
      }
    },
    openModal() {
      this.showModal = true
      this.form.sale_date = new Date().toISOString().split('T')[0]
    },
    onProductSelect() {
      const product = this.products.find(p => p.id === this.form.product_id)
      if (product) {
        this.form.product_name = product.name
        this.form.price = product.price
        this.form.cost = product.cost
      }
    },
    async saveSale() {
      if (!this.isCustom && !this.form.product_id) {
        alert('请选择商品')
        return
      }
      if (this.isCustom && !this.form.product_name.trim()) {
        alert('请输入商品名称')
        return
      }
      if (!this.form.quantity || this.form.quantity <= 0) {
        alert('数量必须大于0')
        return
      }

      try {
        await salesApi.create({
          ...this.form,
          is_custom: this.isCustom,
          product_id: this.isCustom ? null : this.form.product_id
        })
        this.closeModal()
        this.loadSales()
        this.loadProducts() // 刷新库存
      } catch (error) {
        alert('保存失败: ' + (error.response?.data?.error || error.message))
      }
    },
    async deleteSale(item) {
      if (!confirm('确定删除该销售记录吗？')) return
      try {
        await salesApi.delete(item.id)
        this.loadSales()
        this.loadProducts()
      } catch (error) {
        alert('删除失败: ' + (error.response?.data?.error || error.message))
      }
    },
    closeModal() {
      this.showModal = false
      this.isCustom = false
      this.form = {
        product_id: '',
        product_name: '',
        quantity: 1,
        price: '',
        cost: '',
        customer: '',
        remark: '',
        sale_date: new Date().toISOString().split('T')[0]
      }
    }
  }
}
</script>

<style scoped>
@import '../styles/common.css';

.list-item-right {
  text-align: right;
}

.list-item-profit {
  font-size: 11px;
  color: #07c160;
  margin-top: 2px;
}

.delete-btn {
  margin-top: 4px;
  padding: 2px 8px;
  font-size: 11px;
  background: #ffebee;
  color: #fa5151;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.toggle-btns {
  display: flex;
  background: #f5f5f5;
  border-radius: 6px;
  padding: 4px;
}

.toggle-btn {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.toggle-btn.active {
  background: #fff;
  color: #07c160;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.preview-card {
  background: #f8f8f8;
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 14px;
}
</style>
