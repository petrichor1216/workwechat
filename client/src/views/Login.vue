<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">私域进销存</h1>
      <p class="login-subtitle">请选择您的身份</p>

      <div v-if="loading" class="login-loading">
        <div class="spinner"></div>
        <p>正在登录...</p>
      </div>

      <div v-else class="login-buttons">
        <button class="login-btn admin-btn" @click="showAdminLogin">
          <span class="btn-icon">👔</span>
          <span class="btn-text">管理员登录</span>
          <span class="btn-hint">需要密码</span>
        </button>

        <button class="login-btn staff-btn" @click="staffLogin">
          <span class="btn-icon">🏪</span>
          <span class="btn-text">店员登录</span>
          <span class="btn-hint">无需密码</span>
        </button>
      </div>
    </div>

    <!-- 管理员密码弹窗 -->
    <div class="modal-overlay" v-if="showPasswordModal" @click.self="closePasswordModal">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">管理员登录</span>
          <span class="modal-close" @click="closePasswordModal">×</span>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">请输入管理员密码</label>
            <input
              type="password"
              class="form-input"
              v-model="password"
              placeholder="请输入密码"
              @keyup.enter="adminLogin"
              ref="passwordInput"
            />
          </div>
          <p v-if="error" class="error-text">{{ error }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="closePasswordModal">取消</button>
          <button class="btn btn-primary" @click="adminLogin" :disabled="!password">确认登录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { authApi } from '../api'
import { login as authLogin } from '../auth'

export default {
  name: 'Login',
  data() {
    return {
      loading: false,
      showPasswordModal: false,
      password: '',
      error: ''
    }
  },
  methods: {
    showAdminLogin() {
      this.showPasswordModal = true
      this.password = ''
      this.error = ''
      this.$nextTick(() => {
        this.$refs.passwordInput?.focus()
      })
    },
    closePasswordModal() {
      this.showPasswordModal = false
      this.password = ''
      this.error = ''
    },
    async adminLogin() {
      if (!this.password) {
        this.error = '请输入密码'
        return
      }

      this.loading = true
      this.error = ''

      try {
        const { data } = await authApi.loginAdmin(this.password)
        // 保存登录状态
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        // 触发 auth 更新
        authLogin(data.token, data.user)
        // 跳转首页
        this.$router.replace('/')
      } catch (error) {
        this.error = error.response?.data?.error || '登录失败'
        this.loading = false
      }
    },
    async staffLogin() {
      this.loading = true
      this.error = ''

      try {
        const { data } = await authApi.loginStaff()
        // 保存登录状态
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        // 触发 auth 更新
        authLogin(data.token, data.user)
        // 跳转首页
        this.$router.replace('/')
      } catch (error) {
        this.error = error.response?.data?.error || '登录失败'
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
  padding: 20px;
}

.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 30px;
  width: 100%;
  max-width: 360px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.login-subtitle {
  font-size: 14px;
  color: #999;
  margin-bottom: 30px;
}

.login-loading {
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: #07c160;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.admin-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.admin-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.staff-btn {
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
  color: #fff;
}

.staff-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(7, 193, 96, 0.4);
}

.btn-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.btn-text {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.btn-hint {
  font-size: 12px;
  opacity: 0.8;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 320px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
}

.modal-close {
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.form-group {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #07c160;
}

.error-text {
  color: #fa5151;
  font-size: 13px;
  margin-top: 12px;
  margin-bottom: 0;
}

.btn {
  flex: 1;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #07c160;
  color: #fff;
}

.btn-default {
  background: #f5f5f5;
  color: #333;
}
</style>
