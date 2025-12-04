const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件存储在 /app/data 目录（方便持久化）
const dbPath = process.env.NODE_ENV === 'production'
  ? '/app/data/inventory.db'
  : path.join(__dirname, '../data/inventory.db');

// 确保目录存在
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据库表
db.exec(`
  -- 商品表
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 销售记录表
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price REAL NOT NULL,
    cost REAL NOT NULL DEFAULT 0,
    is_custom INTEGER NOT NULL DEFAULT 0,
    customer TEXT,
    remark TEXT,
    sale_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  -- 库存记录表（入库/出库）
  CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('in', 'out')),
    quantity INTEGER NOT NULL,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`);

module.exports = db;
