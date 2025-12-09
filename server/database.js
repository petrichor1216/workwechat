const mysql = require('mysql2/promise');

// MySQL 连接池配置
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

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
        is_custom TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 创建 sales 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT,
        product_name VARCHAR(255) NOT NULL,
        quantity INT DEFAULT 1,
        price DECIMAL(10, 2) DEFAULT 0,
        cost DECIMAL(10, 2) DEFAULT 0,
        is_custom TINYINT(1) DEFAULT 0,
        customer VARCHAR(255),
        remark TEXT,
        sale_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 创建 inventory_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        product_name VARCHAR(255),
        type ENUM('in', 'out') NOT NULL,
        quantity INT NOT NULL,
        before_stock INT,
        after_stock INT,
        remark TEXT,
        operator_id VARCHAR(255),
        operator_name VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 创建 operation_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        operator_id VARCHAR(255),
        operator_name VARCHAR(255),
        device_id VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        target_type VARCHAR(50),
        target_id INT,
        target_name VARCHAR(255),
        content TEXT,
        before_data JSON,
        after_data JSON,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('MySQL 数据库表初始化完成');
  } finally {
    connection.release();
  }
}

// 操作日志记录函数
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
    const operatorId = req.user?.userid || req.headers['x-operator-id'] || null;
    const operatorName = req.user?.name || req.headers['x-operator-name'] || null;
    const deviceId = req.headers['x-device-id'] || req.headers['x-forwarded-for'] || req.ip;
    const ipAddress = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    await pool.execute(`
      INSERT INTO operation_logs
      (operator_id, operator_name, device_id, action, target_type, target_id, target_name, content, before_data, after_data, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      operatorId,
      operatorName,
      deviceId,
      action,
      targetType,
      targetId || null,
      targetName || null,
      content,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      ipAddress,
      userAgent
    ]);
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

module.exports = {
  pool,
  initDatabase,
  logOperation
};
