const express = require('express');
const router = express.Router();
const { db, _, COLLECTIONS } = require('../database');
const { requirePermission } = require('../auth');

const logsCollection = db.collection(COLLECTIONS.OPERATION_LOGS);

// 获取操作日志列表
router.get('/', requirePermission('logs:view'), async (req, res) => {
  try {
    const {
      action,        // 操作类型筛选
      target_type,   // 目标类型筛选
      start_date,    // 开始日期
      end_date,      // 结束日期
      limit = 50,
      offset = 0
    } = req.query;

    let query = logsCollection.orderBy('created_at', 'desc');

    // 构建查询条件
    const conditions = {};
    if (action) conditions.action = action;
    if (target_type) conditions.target_type = target_type;

    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions);
    }

    // 日期筛选（CloudBase 不支持在文档中直接用日期函数，需要客户端过滤）
    let { data: logs } = await query
      .skip(parseInt(offset))
      .limit(parseInt(limit) + 100) // 多取一些以便过滤日期
      .get();

    // 日期过滤
    if (start_date || end_date) {
      logs = logs.filter(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (start_date && logDate < start_date) return false;
        if (end_date && logDate > end_date) return false;
        return true;
      });
    }

    // 截取需要的数量
    logs = logs.slice(0, parseInt(limit));

    res.json(logs);
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取日志统计
router.get('/stats', requirePermission('logs:view'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: allLogs } = await logsCollection.limit(1000).get();

    // 今日操作数
    const todayCount = allLogs.filter(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      return logDate === today;
    }).length;

    // 本周数据
    const weekLogs = allLogs.filter(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      return logDate >= weekAgo;
    });

    // 按操作类型统计
    const actionMap = new Map();
    weekLogs.forEach(log => {
      const action = log.action;
      actionMap.set(action, (actionMap.get(action) || 0) + 1);
    });
    const byAction = Array.from(actionMap.entries()).map(([action, count]) => ({ action, count }));

    // 按目标类型统计
    const targetMap = new Map();
    weekLogs.forEach(log => {
      const targetType = log.target_type;
      targetMap.set(targetType, (targetMap.get(targetType) || 0) + 1);
    });
    const byTarget = Array.from(targetMap.entries()).map(([target_type, count]) => ({ target_type, count }));

    res.json({
      today: todayCount,
      by_action: byAction,
      by_target: byTarget
    });
  } catch (error) {
    console.error('获取日志统计失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单条日志详情
router.get('/:id', requirePermission('logs:view'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data: logs } = await logsCollection
      .where({ id: id })
      .get();

    if (logs.length === 0) {
      return res.status(404).json({ error: '日志不存在' });
    }

    res.json(logs[0]);
  } catch (error) {
    console.error('获取日志详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
