const mysql = require('mysql2/promise');

// 数据库配置（通过环境变量配置）
const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.MYSQL_ADDRESS?.split(':')[0] || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || process.env.MYSQL_ADDRESS?.split(':')[1] || '3306'),
  user: process.env.MYSQL_USER || process.env.MYSQL_USERNAME || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 初始化数据库表
async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    // 商品表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        cost DECIMAL(10,2) NOT NULL DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        is_custom TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 销售记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT,
        product_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        cost DECIMAL(10,2) NOT NULL DEFAULT 0,
        is_custom TINYINT(1) NOT NULL DEFAULT 0,
        customer VARCHAR(255),
        remark TEXT,
        sale_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 库存记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        type ENUM('in', 'out') NOT NULL,
        quantity INT NOT NULL,
        remark VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 操作日志表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        operator_id VARCHAR(100),
        operator_name VARCHAR(100),
        device_id VARCHAR(100),
        action VARCHAR(50) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id INT,
        target_name VARCHAR(255),
        content TEXT,
        before_data JSON,
        after_data JSON,
        ip_address VARCHAR(50),
        user_agent VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_action (action),
        INDEX idx_target_type (target_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('数据库表初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 操作日志记录函数
async function logOperation(req, {
  action,           // 操作类型: create, update, delete
  targetType,       // 目标类型: product, sale, inventory
  targetId,         // 目标ID
  targetName,       // 目标名称
  content,          // 操作内容描述
  beforeData,       // 操作前数据
  afterData         // 操作后数据
}) {
  try {
    // 从请求头获取设备标识（后续可以接入企业微信用户身份）
    const deviceId = req.headers['x-device-id'] || req.headers['x-forwarded-for'] || req.ip;
    const operatorId = req.headers['x-operator-id'] || null;
    const operatorName = req.headers['x-operator-name'] || null;
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
    // 不抛出错误，日志记录失败不影响主业务
  }
}

module.exports = {
  pool,
  initDatabase,
  logOperation
};
