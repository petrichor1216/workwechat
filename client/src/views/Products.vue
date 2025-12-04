<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">商品管理</h1>
      <p class="page-subtitle">共 {{ products.length }} 件商品</p>
    </header>

    <!-- 商品列表 -->
    <div class="list" v-if="products.length">
      <div class="list-item" v-for="item in products" :key="item.id" @click="editProduct(item)">
        <div class="list-item-content">
          <div class="list-item-title">
            {{ item.name }}
            <span v-if="item.is_custom" class="tag tag-orange">定制品</span>
            <span v-if="!item.is_custom && item.stock < 5" class="tag tag-red">库存不足</span>
          </div>
          <div class="list-item-desc">
            售价: ¥{{ item.price }} | 成本: ¥{{ item.cost }}
            <span v-if="!item.is_custom"> | 库存: {{ item.stock }}</span>
          </div>
        </div>
        <div class="list-item-extra">
          ¥{{ (item.price - item.cost).toFixed(2) }}
        </div>
      </div>
    </div>

    <div v-else class="empty">
      <div class="empty-icon">📦</div>
      <div class="empty-text">暂无商品，点击右下角添加</div>
    </div>

    <!-- 添加按钮 -->
    <button class="fab" @click="showModal = true">+</button>

    <!-- 添加/编辑弹窗 -->
    <div class="modal-overlay" v-if="showModal" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">{{ editingId ? '编辑商品' : '添加商品' }}</span>
          <span class="modal-close" @click="closeModal">×</span>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">商品名称 *</label>
            <input type="text" class="form-input" v-model="form.name" placeholder="请输入商品名称">
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
          <div class="form-group" v-if="!form.is_custom">
            <label class="form-label">库存数量</label>
            <input type="number" class="form-input" v-model.number="form.stock" placeholder="0">
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.is_custom">
              <span>标记为定制品（不计库存）</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default btn-block" @click="closeModal">取消</button>
          <button class="btn btn-primary btn-block" @click="saveProduct">保存</button>
        </div>
        <div class="modal-footer" v-if="editingId" style="border-top: none; padding-top: 0;">
          <button class="btn btn-danger btn-block" @click="deleteProduct">删除商品</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { productApi } from '../api'

export default {
  name: 'Products',
  data() {
    return {
      products: [],
      showModal: false,
      editingId: null,
      form: {
        name: '',
        price: '',
        cost: '',
        stock: 0,
        is_custom: false
      }
    }
  },
  mounted() {
    this.loadProducts()
  },
  methods: {
    async loadProducts() {
      try {
        const { data } = await productApi.list()
        this.products = data
      } catch (error) {
        console.error('加载商品失败:', error)
      }
    },
    editProduct(item) {
      this.editingId = item.id
      this.form = {
        name: item.name,
        price: item.price,
        cost: item.cost,
        stock: item.stock,
        is_custom: !!item.is_custom
      }
      this.showModal = true
    },
    async saveProduct() {
      if (!this.form.name.trim()) {
        alert('请输入商品名称')
        return
      }
      try {
        if (this.editingId) {
          await productApi.update(this.editingId, this.form)
        } else {
          await productApi.create(this.form)
        }
        this.closeModal()
        this.loadProducts()
      } catch (error) {
        alert('保存失败: ' + (error.response?.data?.error || error.message))
      }
    },
    async deleteProduct() {
      if (!confirm('确定删除该商品吗？')) return
      try {
        await productApi.delete(this.editingId)
        this.closeModal()
        this.loadProducts()
      } catch (error) {
        alert('删除失败: ' + (error.response?.data?.error || error.message))
      }
    },
    closeModal() {
      this.showModal = false
      this.editingId = null
      this.form = { name: '', price: '', cost: '', stock: 0, is_custom: false }
    }
  }
}
</script>

<style scoped>
@import '../styles/common.css';

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
}
</style>
