# 私域进销存管理系统

企业微信自建应用，用于私域销售的进销存管理。

## 功能特性

- **商品管理**：商品的增删改查，支持标记定制品
- **销售记录**：记录每笔销售，自动扣减库存
- **库存管理**：入库/出库操作，库存预警提醒
- **数据统计**：销售额、利润统计，图表展示
- **操作日志**：记录所有操作，支持追溯（新增）

## 技术栈

- 后端：Node.js + Express + MySQL
- 前端：Vue 3 + Vite
- 部署：Docker + 微信云托管

## 本地开发

### 前置条件

需要 MySQL 数据库，可以使用 Docker 快速启动：

```bash
docker run -d --name mysql \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=inventory \
  -p 3306:3306 \
  mysql:8.0
```

### 启动开发服务

```bash
# 设置数据库连接（或使用默认值）
export MYSQL_HOST=localhost
export MYSQL_USER=root
export MYSQL_PASSWORD=123456
export MYSQL_DATABASE=inventory

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

开发模式下：
- 后端运行在 http://localhost:80
- 前端运行在 http://localhost:3000（自动代理 API 请求）

## 数据库配置

通过环境变量配置 MySQL 连接：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| MYSQL_HOST | 数据库主机 | localhost |
| MYSQL_PORT | 数据库端口 | 3306 |
| MYSQL_USER | 数据库用户名 | root |
| MYSQL_PASSWORD | 数据库密码 | (空) |
| MYSQL_DATABASE | 数据库名 | inventory |

**腾讯云 CloudBase 环境变量**（自动识别）：
- `MYSQL_ADDRESS` - 格式为 `host:port`
- `MYSQL_USERNAME` - 用户名

## 构建部署

### 本地构建测试

```bash
# 构建 Docker 镜像
docker build -t inventory-app .

# 运行容器（需要连接 MySQL）
docker run -p 80:80 \
  -e MYSQL_HOST=host.docker.internal \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=123456 \
  -e MYSQL_DATABASE=inventory \
  inventory-app
```

### 微信云托管部署

1. 在微信云托管控制台创建 MySQL 数据库
2. 创建服务，选择「代码仓库」或「本地代码」方式上传
3. 在服务设置中配置环境变量（数据库连接信息）
4. 系统会自动根据 Dockerfile 构建并部署

### 数据持久化

使用 MySQL 云数据库，数据自动持久化，无需担心容器重启导致数据丢失。

## 操作日志

系统会自动记录以下操作：
- 商品：新增、修改、删除
- 销售：添加销售记录、删除销售记录
- 库存：入库、出库

日志包含：
- 操作时间
- 操作人/设备标识
- 操作类型
- 操作内容
- 操作前后的数据（用于追溯）

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
│       ├── stats.js       # 数据统计
│       └── logs.js        # 操作日志
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

### 操作日志

- `GET /api/logs` - 获取操作日志列表
- `GET /api/logs/:id` - 获取日志详情
- `GET /api/logs/stats` - 获取日志统计
