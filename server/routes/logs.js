const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { requirePermission } = require('../auth');

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

    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }

    if (target_type) {
      sql += ' AND target_type = ?';
      params.push(target_type);
    }

    if (start_date) {
      sql += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.execute(sql, params);

    // 解析 JSON 字段
    const parsedLogs = logs.map(log => ({
      ...log,
      before_data: log.before_data ? JSON.parse(log.before_data) : null,
      after_data: log.after_data ? JSON.parse(log.after_data) : null
    }));

    res.json(parsedLogs);
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取日志统计
router.get('/stats', requirePermission('logs:view'), async (req, res) => {
  try {
    // 今日操作数
    const [todayCount] = await pool.execute(`
      SELECT COUNT(*) as count FROM operation_logs
      WHERE DATE(created_at) = CURDATE()
    `);

    // 按操作类型统计
    const [byAction] = await pool.execute(`
      SELECT action, COUNT(*) as count
      FROM operation_logs
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY action
    `);

    // 按目标类型统计
    const [byTarget] = await pool.execute(`
      SELECT target_type, COUNT(*) as count
      FROM operation_logs
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY target_type
    `);

    res.json({
      today: todayCount[0].count,
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
    const [logs] = await pool.execute(
      'SELECT * FROM operation_logs WHERE id = ?',
      [req.params.id]
    );

    if (logs.length === 0) {
      return res.status(404).json({ error: '日志不存在' });
    }

    const log = logs[0];
    res.json({
      ...log,
      before_data: log.before_data ? JSON.parse(log.before_data) : null,
      after_data: log.after_data ? JSON.parse(log.after_data) : null
    });
  } catch (error) {
    console.error('获取日志详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
