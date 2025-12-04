<template>
  <div class="page">
    <header class="page-header">
      <h1 class="page-title">用户管理</h1>
      <p class="page-subtitle">管理系统用户和权限</p>
    </header>

    <!-- 角色说明 -->
    <div class="card role-card">
      <h3 class="card-title">角色权限说明</h3>
      <div class="role-list">
        <div class="role-item">
          <span class="role-badge admin">管理员</span>
          <span class="role-desc">所有权限，可管理用户</span>
        </div>
        <div class="role-item">
          <span class="role-badge staff">店员</span>
          <span class="role-desc">添加销售/库存，不能删除</span>
        </div>
        <div class="role-item">
          <span class="role-badge viewer">查看者</span>
          <span class="role-desc">只能查看数据</span>
        </div>
      </div>
    </div>

    <!-- 用户列表 -->
    <div class="list" v-if="users.length">
      <div class="list-item" v-for="item in users" :key="item.userid" @click="editUser(item)">
        <div class="user-avatar">
          <img v-if="item.avatar" :src="item.avatar" :alt="item.name" />
          <span v-else>{{ (item.name || item.userid).charAt(0) }}</span>
        </div>
        <div class="list-item-content">
          <div class="list-item-title">
            {{ item.name || item.userid }}
            <span v-if="!item.is_active" class="tag tag-red">已禁用</span>
            <span v-if="item.userid === currentUser?.userid" class="tag tag-green">我</span>
          </div>
          <div class="list-item-desc">
            ID: {{ item.userid }}
            <span v-if="item.last_login_at"> | 最近登录: {{ formatTime(item.last_login_at) }}</span>
          </div>
        </div>
        <div class="list-item-extra">
          <span :class="['role-badge', item.role]">{{ getRoleLabel(item.role) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty">
      <div class="empty-icon">👥</div>
      <div class="empty-text">暂无用户</div>
    </div>

    <!-- 添加按钮 -->
    <button class="fab" @click="showAddModal = true">+</button>

    <!-- 添加用户弹窗 -->
    <div class="modal-overlay" v-if="showAddModal" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">添加用户</span>
          <span class="modal-close" @click="showAddModal = false">×</span>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">企业微信用户ID *</label>
            <input type="text" class="form-input" v-model="addForm.userid" placeholder="企业微信通讯录中的用户ID">
          </div>
          <div class="form-group">
            <label class="form-label">用户名称</label>
            <input type="text" class="form-input" v-model="addForm.name" placeholder="可选，不填则使用用户ID">
          </div>
          <div class="form-group">
            <label class="form-label">角色</label>
            <select class="form-select" v-model="addForm.role">
              <option value="viewer">查看者</option>
              <option value="staff">店员</option>
              <option value="admin">管理员</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default btn-block" @click="showAddModal = false">取消</button>
          <button class="btn btn-primary btn-block" @click="addUser">添加</button>
        </div>
      </div>
    </div>

    <!-- 编辑用户弹窗 -->
    <div class="modal-overlay" v-if="showEditModal" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">编辑用户</span>
          <span class="modal-close" @click="closeEditModal">×</span>
        </div>
        <div class="modal-body" v-if="editingUser">
          <div class="user-info">
            <div class="user-avatar large">
              <img v-if="editingUser.avatar" :src="editingUser.avatar" :alt="editingUser.name" />
              <span v-else>{{ (editingUser.name || editingUser.userid).charAt(0) }}</span>
            </div>
            <div class="user-name">{{ editingUser.name || editingUser.userid }}</div>
            <div class="user-id">ID: {{ editingUser.userid }}</div>
          </div>

          <div class="form-group">
            <label class="form-label">用户名称</label>
            <input type="text" class="form-input" v-model="editForm.name">
          </div>
          <div class="form-group">
            <label class="form-label">角色</label>
            <select class="form-select" v-model="editForm.role" :disabled="editingUser.userid === currentUser?.userid">
              <option value="viewer">查看者</option>
              <option value="staff">店员</option>
              <option value="admin">管理员</option>
            </select>
            <p v-if="editingUser.userid === currentUser?.userid" class="form-hint">不能修改自己的角色</p>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="editForm.is_active"
                :disabled="editingUser.userid === currentUser?.userid"
              />
              <span>启用账号</span>
            </label>
            <p v-if="editingUser.userid === currentUser?.userid" class="form-hint">不能禁用自己的账号</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default btn-block" @click="closeEditModal">取消</button>
          <button class="btn btn-primary btn-block" @click="updateUser">保存</button>
        </div>
        <div class="modal-footer" v-if="editingUser?.userid !== currentUser?.userid" style="border-top: none; padding-top: 0;">
          <button class="btn btn-danger btn-block" @click="deleteUser">删除用户</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { userApi } from '../api'
import { authState, getRoleLabel } from '../auth'

export default {
  name: 'Users',
  data() {
    return {
      users: [],
      showAddModal: false,
      showEditModal: false,
      editingUser: null,
      addForm: {
        userid: '',
        name: '',
        role: 'viewer'
      },
      editForm: {
        name: '',
        role: 'viewer',
        is_active: true
      }
    }
  },
  computed: {
    currentUser() {
      return authState.user
    }
  },
  mounted() {
    this.loadUsers()
  },
  methods: {
    getRoleLabel,
    async loadUsers() {
      try {
        const { data } = await userApi.list()
        this.users = data
      } catch (error) {
        console.error('加载用户失败:', error)
        if (error.response?.status === 403) {
          alert('没有权限查看用户列表')
          this.$router.push('/')
        }
      }
    },
    editUser(user) {
      this.editingUser = user
      this.editForm = {
        name: user.name,
        role: user.role,
        is_active: !!user.is_active
      }
      this.showEditModal = true
    },
    closeEditModal() {
      this.showEditModal = false
      this.editingUser = null
    },
    async addUser() {
      if (!this.addForm.userid.trim()) {
        alert('请输入用户ID')
        return
      }

      try {
        await userApi.create(this.addForm)
        this.showAddModal = false
        this.addForm = { userid: '', name: '', role: 'viewer' }
        this.loadUsers()
      } catch (error) {
        alert('添加失败: ' + (error.response?.data?.error || error.message))
      }
    },
    async updateUser() {
      try {
        await userApi.update(this.editingUser.userid, this.editForm)
        this.closeEditModal()
        this.loadUsers()
      } catch (error) {
        alert('保存失败: ' + (error.response?.data?.error || error.message))
      }
    },
    async deleteUser() {
      if (!confirm(`确定删除用户 ${this.editingUser.name || this.editingUser.userid} 吗？`)) {
        return
      }

      try {
        await userApi.delete(this.editingUser.userid)
        this.closeEditModal()
        this.loadUsers()
      } catch (error) {
        alert('删除失败: ' + (error.response?.data?.error || error.message))
      }
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

.role-card {
  margin-bottom: 0;
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.role-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-badge {
  display: inline-block;
  padding: 2px 10px;
  font-size: 12px;
  border-radius: 4px;
  font-weight: 500;
}

.role-badge.admin {
  background: #ffebee;
  color: #fa5151;
}

.role-badge.staff {
  background: #e6f7ee;
  color: #07c160;
}

.role-badge.viewer {
  background: #f5f5f5;
  color: #666;
}

.role-desc {
  font-size: 12px;
  color: #666;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #07c160;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  margin-right: 12px;
  overflow: hidden;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar.large {
  width: 60px;
  height: 60px;
  font-size: 24px;
  margin: 0 auto 12px;
}

.user-info {
  text-align: center;
  padding: 16px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.user-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.user-id {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

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

.tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  margin-left: 8px;
}

.tag-green {
  background: #e6f7ee;
  color: #07c160;
}

.tag-red {
  background: #ffebee;
  color: #fa5151;
}

.fab {
  position: fixed;
  right: 20px;
  bottom: 80px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #07c160;
  color: #fff;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4);
  border: none;
  cursor: pointer;
}
</style>
