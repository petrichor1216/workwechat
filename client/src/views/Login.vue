<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">私域进销存</h1>
      <p class="login-subtitle">企业微信登录</p>

      <div v-if="loading" class="login-loading">
        <div class="spinner"></div>
        <p>正在登录...</p>
      </div>

      <div v-else-if="error" class="login-error">
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="startLogin">重新登录</button>
      </div>

      <div v-else class="login-action">
        <button class="btn btn-primary btn-block btn-large" @click="startLogin">
          企业微信授权登录
        </button>
        <p class="login-hint">请在企业微信中打开本应用</p>

        <!-- 开发模式：模拟登录 -->
        <div v-if="isDev" class="dev-login">
          <p class="dev-hint">开发模式</p>
          <input
            type="text"
            class="form-input"
            v-model="devUserId"
            placeholder="输入用户ID"
          />
          <button class="btn btn-default btn-block" @click="devLogin">
            模拟登录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { login } from '../auth'
import { authApi } from '../api'

export default {
  name: 'Login',
  data() {
    return {
      loading: false,
      error: '',
      devUserId: 'admin',
      isDev: import.meta.env.DEV,
      corpId: '',
      agentId: ''
    }
  },
  async mounted() {
    // 获取企业微信配置
    try {
      const { data } = await authApi.config()
      this.corpId = data.corpId
      this.agentId = data.agentId
    } catch (e) {
      console.error('获取配置失败:', e)
    }

    // 检查 URL 中是否有 code 参数（OAuth 回调）
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    if (code) {
      await this.handleOAuthCallback(code)
    }
  },
  methods: {
    startLogin() {
      if (!this.corpId) {
        this.error = '企业微信配置未设置'
        return
      }

      // 构建企业微信 OAuth 授权 URL
      const redirectUri = encodeURIComponent(window.location.origin + '/login')
      const oauthUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${this.corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_privateinfo&agentid=${this.agentId}&state=STATE#wechat_redirect`

      window.location.href = oauthUrl
    },
    async handleOAuthCallback(code) {
      this.loading = true
      this.error = ''

      try {
        await login(code)
        // 登录成功，跳转到首页
        this.$router.replace('/')
      } catch (error) {
        console.error('登录失败:', error)
        this.error = error.response?.data?.error || '登录失败，请重试'
      } finally {
        this.loading = false
        // 清除 URL 中的 code 参数
        window.history.replaceState({}, '', '/login')
      }
    },
    async devLogin() {
      if (!this.devUserId.trim()) {
        this.error = '请输入用户ID'
        return
      }

      this.loading = true
      this.error = ''

      try {
        await login('dev_' + this.devUserId.trim())
        this.$router.replace('/')
      } catch (error) {
        console.error('登录失败:', error)
        this.error = error.response?.data?.error || '登录失败'
      } finally {
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
  padding: 20px;
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

.login-error {
  padding: 20px;
}

.login-error p {
  color: #fa5151;
  margin-bottom: 16px;
}

.login-action {
  padding: 10px 0;
}

.btn-large {
  padding: 14px 20px;
  font-size: 16px;
}

.login-hint {
  font-size: 12px;
  color: #999;
  margin-top: 16px;
}

.dev-login {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px dashed #ddd;
}

.dev-hint {
  font-size: 12px;
  color: #ff9800;
  margin-bottom: 12px;
}

.dev-login .form-input {
  margin-bottom: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary {
  background: #07c160;
  color: #fff;
}

.btn-default {
  background: #f5f5f5;
  color: #333;
}

.btn-block {
  display: flex;
  width: 100%;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
}
</style>
