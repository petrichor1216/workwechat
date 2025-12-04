const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, db, COLLECTIONS } = require('./database');
const { authMiddleware } = require('./auth');

const app = express();
const PORT = process.env.PORT || 80;

// 中间件
app.use(cors());
app.use(express.json());

// 信任代理（用于获取真实IP）
app.set('trust proxy', true);

// 认证中间件（放在 API 路由之前）
app.use('/api', authMiddleware);

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/logs', require('./routes/logs'));

// 企业微信域名验证文件
app.get('/WW_verify_TPwwZLx540FK1rsM.txt', (req, res) => {
  res.type('text/plain').send('TPwwZLx540FK1rsM');
});

// 生产环境提供静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));

  // SPA 路由回退
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// 数据库初始化状态
let dbReady = false;
let dbError = null;

// 健康检查端点（云托管需要）- 立即返回OK，不等待数据库
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', dbReady, dbError: dbError?.message || null });
});

// 详细健康检查（调试用）
app.get('/health/detail', async (req, res) => {
  try {
    await db.collection(COLLECTIONS.USERS).count();
    res.status(200).json({ status: 'ok', database: 'cloudbase', dbReady });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// 启动服务器 - 先启动HTTP，再异步初始化数据库
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);

  // 异步初始化数据库
  initDatabase()
    .then(() => {
      dbReady = true;
      console.log('CloudBase 数据库连接成功');
    })
    .catch((error) => {
      dbError = error;
      console.error('数据库初始化失败:', error);
    });
});
