const mysql = require('mysql2/promise');

// TiDB Cloud / MySQL 连接池配置
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
  port: parseInt(process.env.MYSQL_PORT) || 4000,
  user: process.env.MYSQL_USER || 'w3W3AJWN97UbeYa.root',
  password: process.env.MYSQL_PASSWORD || 'wSMmDRAHwRwmb2rp',
  database: process.env.MYSQL_DATABASE || 'inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  ssl: {
    rejectUnauthorized: true
  }
});

// 默认管理员列表
const DEFAULT_ADMINS = ['ZengLingFeng', 'Kuan-k', 'HanSenBoYi'];

// 初始化数据库表
async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    // 创建 products 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) DEFAULT 0,
        cost DECIMAL(10, 2) DEFAULT 0,
        stock INT DEFAULT 0,
        is_custom BOOLEAN DEFAULT FALSE,
        alert_threshold INT DEFAULT 10,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 创建 sales 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_name VARCHAR(255),
        quantity INT DEFAULT 1,
        price DECIMAL(10, 2),
        cost DECIMAL(10, 2) DEFAULT 0,
        profit DECIMAL(10, 2) DEFAULT 0,
        sale_date DATE,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 inventory_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT,
        product_name VARCHAR(255),
        type ENUM('in', 'out'),
        quantity INT,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 operation_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(50),
        target VARCHAR(100),
        detail TEXT,
        operator VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 users 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userid VARCHAR(100) UNIQUE,
        role ENUM('admin', 'staff') DEFAULT 'staff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 初始化默认管理员
    for (const userid of DEFAULT_ADMINS) {
      try {
        await connection.execute(
          'INSERT IGNORE INTO users (userid, role) VALUES (?, ?)',
          [userid, 'admin']
        );
      } catch (e) {
        // 忽略重复插入错误
      }
    }

    console.log('MySQL 数据库表初始化完成');
  } finally {
    connection.release();
  }
}

// 操作日志记录函数（简化版）
async function logOperation(req, {
  action,
  targetType,
  targetId,
  targetName,
  content,
  beforeData,
  afterData
}) {
  try {
    const operator = req.user?.name || req.user?.userid || 'system';
    const target = targetType ? `${targetType}:${targetId || targetName}` : targetName;
    const detail = content || '';

    await pool.execute(`
      INSERT INTO operation_logs (action, target, detail, operator)
      VALUES (?, ?, ?, ?)
    `, [action, target, detail, operator]);
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

module.exports = {
  pool,
  initDatabase,
  logOperation,
  DEFAULT_ADMINS
};
