import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

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

export default api
