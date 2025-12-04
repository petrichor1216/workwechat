<template>
  <div class="app">
    <!-- 加载中 -->
    <div v-if="isLoading" class="loading-screen">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 已登录 -->
    <template v-else-if="isLoggedIn">
      <main class="main-content">
        <router-view />
      </main>

      <!-- 用户菜单按钮 -->
      <div class="user-menu-btn" @click="showUserMenu = true">
        <div class="user-avatar-small">
          <img v-if="user?.avatar" :src="user.avatar" :alt="user.name" />
          <span v-else>{{ (user?.name || '?').charAt(0) }}</span>
        </div>
      </div>

      <!-- 用户菜单 -->
      <div class="user-menu-overlay" v-if="showUserMenu" @click.self="showUserMenu = false">
        <div class="user-menu">
          <div class="user-menu-header">
            <div class="user-avatar-large">
              <img v-if="user?.avatar" :src="user.avatar" :alt="user.name" />
              <span v-else>{{ (user?.name || '?').charAt(0) }}</span>
            </div>
            <div class="user-info">
              <div class="user-name">{{ user?.name || user?.userid }}</div>
              <div class="user-role">{{ getRoleLabel(user?.role) }}</div>
            </div>
          </div>
          <div class="user-menu-items">
            <router-link v-if="isAdmin" to="/users" class="menu-item" @click="showUserMenu = false">
              <span>👥</span> 用户管理
            </router-link>
            <div class="menu-item" @click="handleLogout">
              <span>🚪</span> 退出登录
            </div>
          </div>
        </div>
      </div>

      <nav class="tab-bar">
        <router-link to="/dashboard" class="tab-item" :class="{ active: $route.path === '/dashboard' }">
          <span class="tab-icon">📊</span>
          <span class="tab-text">首页</span>
        </router-link>
        <router-link to="/products" class="tab-item" :class="{ active: $route.path === '/products' }">
          <span class="tab-icon">📦</span>
          <span class="tab-text">商品</span>
        </router-link>
        <router-link to="/sales" class="tab-item" :class="{ active: $route.path === '/sales' }">
          <span class="tab-icon">💰</span>
          <span class="tab-text">销售</span>
        </router-link>
        <router-link to="/inventory" class="tab-item" :class="{ active: $route.path === '/inventory' }">
          <span class="tab-icon">📋</span>
          <span class="tab-text">库存</span>
        </router-link>
        <router-link to="/stats" class="tab-item" :class="{ active: $route.path === '/stats' }">
          <span class="tab-icon">📈</span>
          <span class="tab-text">统计</span>
        </router-link>
        <router-link v-if="canViewLogs" to="/logs" class="tab-item" :class="{ active: $route.path === '/logs' }">
          <span class="tab-icon">📝</span>
          <span class="tab-text">日志</span>
        </router-link>
      </nav>
    </template>

    <!-- 未登录 - 显示登录页 -->
    <router-view v-else />
  </div>
</template>

<script>
import { authState, initAuth, logout, hasPermission, getRoleLabel } from './auth'

export default {
  name: 'App',
  data() {
    return {
      showUserMenu: false
    }
  },
  computed: {
    isLoading() {
      return authState.isLoading
    },
    isLoggedIn() {
      return authState.isLoggedIn
    },
    user() {
      return authState.user
    },
    isAdmin() {
      return authState.user?.role === 'admin'
    },
    canViewLogs() {
      return hasPermission('logs:view')
    }
  },
  async created() {
    await initAuth()

    // 监听登出事件
    window.addEventListener('auth:logout', () => {
      this.$router.push('/login')
    })
  },
  watch: {
    isLoggedIn(val) {
      if (!val && this.$route.path !== '/login') {
        this.$router.push('/login')
      }
    }
  },
  methods: {
    getRoleLabel,
    handleLogout() {
      this.showUserMenu = false
      logout()
      this.$router.push('/login')
    }
  }
}
</script>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.loading-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: #07c160;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.main-content {
  flex: 1;
  padding-bottom: 60px;
  overflow-y: auto;
}

.user-menu-btn {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 100;
  cursor: pointer;
}

.user-avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #07c160;
  overflow: hidden;
}

.user-avatar-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}

.user-menu {
  background: #fff;
  width: 280px;
  height: 100%;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.user-menu-header {
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
  color: #fff;
  padding: 40px 20px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-avatar-large {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  overflow: hidden;
}

.user-avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 18px;
  font-weight: 600;
}

.user-role {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
}

.user-menu-items {
  padding: 8px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  color: #333;
  text-decoration: none;
  cursor: pointer;
}

.menu-item:active {
  background: #f5f5f5;
}

.menu-item span:first-child {
  font-size: 20px;
}

.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #fff;
  display: flex;
  justify-content: space-around;
  align-items: center;
  border-top: 1px solid #eee;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #999;
  font-size: 10px;
  flex: 1;
  padding: 6px 0;
}

.tab-item.active {
  color: #07c160;
}

.tab-icon {
  font-size: 20px;
  margin-bottom: 2px;
}

.tab-text {
  font-size: 11px;
}
</style>
