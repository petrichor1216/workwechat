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
      authState.user = JSON.parse(savedUser)
      authState.isLoggedIn = true

      // 从服务器获取最新的用户信息和权限
      const { data } = await authApi.me()
      authState.user = data
      authState.permissions = data.permissions || {}
      localStorage.setItem('user', JSON.stringify(data))
    } catch (error) {
      console.error('获取用户信息失败:', error)
      // Token 可能已过期
      if (error.response?.status === 401) {
        logout()
      }
    }
  }

  authState.isLoading = false
}

// 登录（设置认证状态）
export async function login(token, user) {
  authState.user = user
  authState.isLoggedIn = true

  // 获取完整权限
  try {
    const { data: userData } = await authApi.me()
    authState.permissions = userData.permissions || {}
    authState.user = userData
    localStorage.setItem('user', JSON.stringify(userData))
  } catch (e) {
    console.error('获取用户权限失败:', e)
  }

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
