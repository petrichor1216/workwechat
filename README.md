# 私域进销存管理系统

企业微信自建应用，用于私域销售的进销存管理。

## 功能特性

- **商品管理**：商品的增删改查，支持标记定制品
- **销售记录**：记录每笔销售，自动扣减库存
- **库存管理**：入库/出库操作，库存预警提醒
- **数据统计**：销售额、利润统计，图表展示

## 技术栈

- 后端：Node.js + Express + SQLite
- 前端：Vue 3 + Vite
- 部署：Docker + 微信云托管

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务
npm run dev
```

开发模式下：
- 后端运行在 http://localhost:80
- 前端运行在 http://localhost:3000（自动代理 API 请求）

## 构建部署

### 本地构建测试

```bash
# 构建 Docker 镜像
docker build -t inventory-app .

# 运行容器
docker run -p 80:80 -v $(pwd)/data:/app/data inventory-app
```

### 微信云托管部署

1. 在微信云托管控制台创建服务
2. 选择「代码仓库」或「本地代码」方式上传
3. 系统会自动根据 Dockerfile 构建并部署

### 数据持久化

生产环境中，SQLite 数据库存储在 `/app/data/inventory.db`。

建议在微信云托管中配置持久存储卷，挂载到 `/app/data` 目录，以保证数据不会因容器重启而丢失。

## 目录结构

```
workwechat/
├── server/                 # 后端代码
│   ├── index.js           # 入口文件
│   ├── database.js        # 数据库初始化
│   └── routes/            # API 路由
│       ├── products.js    # 商品管理
│       ├── sales.js       # 销售记录
│       ├── inventory.js   # 库存管理
│       └── stats.js       # 数据统计
├── client/                 # 前端代码
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── api.js         # API 封装
│   │   └── styles/        # 公共样式
│   └── ...
├── Dockerfile             # Docker 构建文件
├── container.config.json  # 云托管配置
└── package.json
```

## API 接口

### 商品管理

- `GET /api/products` - 获取商品列表
- `POST /api/products` - 新增商品
- `PUT /api/products/:id` - 更新商品
- `DELETE /api/products/:id` - 删除商品

### 销售记录

- `GET /api/sales` - 获取销售记录
- `POST /api/sales` - 新增销售记录
- `DELETE /api/sales/:id` - 删除销售记录

### 库存管理

- `GET /api/inventory` - 获取库存列表
- `GET /api/inventory/logs` - 获取出入库记录
- `POST /api/inventory/in` - 入库操作
- `POST /api/inventory/out` - 出库操作

### 数据统计

- `GET /api/stats/overview` - 概览数据
- `GET /api/stats/daily` - 每日统计
- `GET /api/stats/monthly` - 每月统计
- `GET /api/stats/ranking` - 商品排行
