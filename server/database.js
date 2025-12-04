const cloudbase = require('@cloudbase/node-sdk');

// 初始化 CloudBase
const app = cloudbase.init({
  env: process.env.ENV_ID || process.env.CBR_ENV_ID
});

// 获取数据库引用
const db = app.database();
const _ = db.command;

// 集合名称
const COLLECTIONS = {
  PRODUCTS: 'products',
  SALES: 'sales',
  INVENTORY_LOGS: 'inventory_logs',
  OPERATION_LOGS: 'operation_logs',
  USERS: 'users'
};

// 初始化数据库（创建索引等）
async function initDatabase() {
  try {
    // 检查并创建默认管理员
    const usersCollection = db.collection(COLLECTIONS.USERS);
    const { total } = await usersCollection
      .where({ role: 'admin' })
      .count();

    if (total === 0) {
      const defaultAdmin = process.env.DEFAULT_ADMIN_USERID || 'admin';
      await usersCollection.add({
        userid: defaultAdmin,
        name: '管理员',
        role: 'admin',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('默认管理员已创建');
    }

    console.log('CloudBase 数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    // 不抛出错误，让应用继续启动
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
    const operatorId = req.user?.userid || req.headers['x-operator-id'] || null;
    const operatorName = req.user?.name || req.headers['x-operator-name'] || null;
    const deviceId = req.headers['x-device-id'] || req.headers['x-forwarded-for'] || req.ip;
    const ipAddress = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    await db.collection(COLLECTIONS.OPERATION_LOGS).add({
      operator_id: operatorId,
      operator_name: operatorName,
      device_id: deviceId,
      action,
      target_type: targetType,
      target_id: targetId || null,
      target_name: targetName || null,
      content,
      before_data: beforeData || null,
      after_data: afterData || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date()
    });
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

// 生成自增ID（模拟MySQL的AUTO_INCREMENT）
async function generateId(collectionName) {
  const counterCollection = db.collection('counters');

  try {
    // 尝试更新计数器
    const { updated } = await counterCollection
      .where({ _id: collectionName })
      .update({
        seq: _.inc(1)
      });

    if (updated === 0) {
      // 计数器不存在，创建它
      await counterCollection.add({
        _id: collectionName,
        seq: 1
      });
      return 1;
    }

    // 获取更新后的值
    const { data } = await counterCollection.doc(collectionName).get();
    return data.seq;
  } catch (error) {
    // 并发情况下可能创建失败，重试获取
    const { data } = await counterCollection.doc(collectionName).get();
    return data.seq;
  }
}

module.exports = {
  db,
  _,
  COLLECTIONS,
  initDatabase,
  logOperation,
  generateId
};
