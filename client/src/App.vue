<template>
  <div class="app">
    <main class="main-content">
      <router-view />
    </main>
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
      <router-link to="/logs" class="tab-item" :class="{ active: $route.path === '/logs' }">
        <span class="tab-icon">📝</span>
        <span class="tab-text">日志</span>
      </router-link>
    </nav>
  </div>
</template>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding-bottom: 60px;
  overflow-y: auto;
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
