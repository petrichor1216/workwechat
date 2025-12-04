import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// 路由配置
const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: () => import('./views/Dashboard.vue'), meta: { title: '首页' } },
  { path: '/products', component: () => import('./views/Products.vue'), meta: { title: '商品管理' } },
  { path: '/sales', component: () => import('./views/Sales.vue'), meta: { title: '销售记录' } },
  { path: '/inventory', component: () => import('./views/Inventory.vue'), meta: { title: '库存管理' } },
  { path: '/stats', component: () => import('./views/Stats.vue'), meta: { title: '数据统计' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title ? `${to.meta.title} - 进销存` : '私域进销存管理系统'
  next()
})

const app = createApp(App)
app.use(router)
app.mount('#app')
