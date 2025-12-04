import { reactive } from 'vue'
import { authApi } from './api'

// 用户状态（响应式）
export const authState = reactive({
  user: null,
  permissions: {},
  isLoggedIn: false,
  isLoading: true
})

// 初始化认证状态
export async function initAuth() {
  authState.isLoading = true

  const token = localStorage.getItem('token')
  const savedUser = localStorage.getItem('user')

  if (token && savedUser) {
    try {
      const user = JSON.parse(savedUser)
      authState.user = user
      authState.permissions = user.permissions || {}
      authState.isLoggedIn = true

      // 可选：后台静默刷新用户信息（不阻塞页面）
      authApi.me().then(({ data }) => {
        authState.user = data
        authState.permissions = data.permissions || {}
        localStorage.setItem('user', JSON.stringify(data))
      }).catch(error => {
        console.error('刷新用户信息失败:', error)
        // 只有 401 才登出，其他错误保持登录状态
        if (error.response?.status === 401) {
          logout()
        }
      })
    } catch (error) {
      console.error('解析用户信息失败:', error)
      logout()
    }
  }

  authState.isLoading = false
}

// 登录（设置认证状态）- 同步函数，直接使用登录返回的数据
export function login(token, user) {
  // user 对象已包含 permissions（从登录接口返回）
  authState.user = user
  authState.permissions = user.permissions || {}
  authState.isLoggedIn = true

  return { token, user }
}

// 登出
export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  authState.user = null
  authState.permissions = {}
  authState.isLoggedIn = false
}

// 检查权限
export function hasPermission(permission) {
  return authState.permissions[permission] === true
}

// 检查是否有任意一个权限
export function hasAnyPermission(permissions) {
  return permissions.some(p => authState.permissions[p] === true)
}

// 检查是否为管理员
export function isAdmin() {
  return authState.user?.role === 'admin'
}

// 获取角色显示名称
export function getRoleLabel(role) {
  const labels = {
    admin: '管理员',
    staff: '店员',
    viewer: '查看者'
  }
  return labels[role] || role
}

// 监听登出事件
window.addEventListener('auth:logout', () => {
  logout()
})

export default {
  authState,
  initAuth,
  login,
  logout,
  hasPermission,
  hasAnyPermission,
  isAdmin,
  getRoleLabel
}
