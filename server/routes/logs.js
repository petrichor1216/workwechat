const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { requirePermission } = require('../auth');

// 获取操作日志列表
router.get('/', requirePermission('logs:view'), async (req, res) => {
  try {
    const {
      action,
      start_date,
      end_date,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = 'SELECT * FROM operation_logs';
    const params = [];
    const conditions = [];

    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (start_date) {
      conditions.push('DATE(created_at) >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('DATE(created_at) <= ?');
      params.push(end_date);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.execute(sql, params);
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

    // 今日操作数
    const [todayResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM operation_logs WHERE DATE(created_at) = ?',
      [today]
    );

    // 按操作类型统计（本周）
    const [byAction] = await pool.execute(`
      SELECT action, COUNT(*) as count
      FROM operation_logs
      WHERE DATE(created_at) >= ?
      GROUP BY action
    `, [weekAgo]);

    res.json({
      today: todayResult[0].count,
      by_action: byAction
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

    res.json(logs[0]);
  } catch (error) {
    console.error('获取日志详情失败:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
