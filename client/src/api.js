import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 请求拦截器 - 添加 token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // 登录过期，清除 token 并跳转到登录
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // 触发重新登录
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }
    return Promise.reject(error)
  }
)

// 认证相关
export const authApi = {
  loginAdmin: (password) => api.post('/auth/login/admin', { password }),
  loginStaff: () => api.post('/auth/login/staff'),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh')
}

// 用户管理相关
export const userApi = {
  list: (params) => api.get('/users', { params }),
  get: (userid) => api.get(`/users/${userid}`),
  create: (data) => api.post('/users', data),
  update: (userid, data) => api.put(`/users/${userid}`, data),
  delete: (userid) => api.delete(`/users/${userid}`),
  roles: () => api.get('/users/roles/info')
}

// 商品相关
export const productApi = {
  list: () => api.get('/products'),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`)
}

// 销售相关
export const salesApi = {
  list: (params) => api.get('/sales', { params }),
  get: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  delete: (id) => api.delete(`/sales/${id}`)
}

// 库存相关
export const inventoryApi = {
  list: () => api.get('/inventory'),
  logs: (params) => api.get('/inventory/logs', { params }),
  stockIn: (data) => api.post('/inventory/in', data),
  stockOut: (data) => api.post('/inventory/out', data)
}

// 统计相关
export const statsApi = {
  overview: () => api.get('/stats/overview'),
  daily: (params) => api.get('/stats/daily', { params }),
  monthly: (params) => api.get('/stats/monthly', { params }),
  ranking: (params) => api.get('/stats/ranking', { params })
}

// 操作日志相关
export const logsApi = {
  list: (params) => api.get('/logs', { params }),
  get: (id) => api.get(`/logs/${id}`),
  stats: () => api.get('/logs/stats')
}

export default api
