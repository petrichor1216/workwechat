const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const { requirePermission } = require('../auth');

// 获取概览统计
router.get('/overview', requirePermission('stats:view'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    // 今日统计
    const [todayResult] = await pool.execute(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM(profit), 0) as profit,
        COUNT(*) as order_count
      FROM sales WHERE sale_date = ?
    `, [today]);

    // 本周统计
    const [weekResult] = await pool.execute(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM(profit), 0) as profit,
        COUNT(*) as order_count
      FROM sales WHERE sale_date >= ?
    `, [weekAgo]);

    // 本月统计
    const [monthResult] = await pool.execute(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM(profit), 0) as profit,
        COUNT(*) as order_count
      FROM sales WHERE sale_date >= ?
    `, [monthStart]);

    // 商品统计
    const [productResult] = await pool.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN stock < alert_threshold AND is_custom = 0 THEN 1 ELSE 0 END) as low_stock
      FROM products
    `);

    res.json({
      today: todayResult[0],
      week: weekResult[0],
      month: monthResult[0],
      products: productResult[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按日期统计销售数据
router.get('/daily', requirePermission('stats:view'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const [stats] = await pool.execute(`
      SELECT
        sale_date as date,
        SUM(price * quantity) as revenue,
        SUM(cost * quantity) as cost,
        SUM(profit) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE sale_date >= ?
      GROUP BY sale_date
      ORDER BY sale_date ASC
    `, [startDate]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按月统计
router.get('/monthly', requirePermission('stats:view'), async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));
    const startMonth = startDate.toISOString().substring(0, 7) + '-01';

    const [stats] = await pool.execute(`
      SELECT
        DATE_FORMAT(sale_date, '%Y-%m') as month,
        SUM(price * quantity) as revenue,
        SUM(cost * quantity) as cost,
        SUM(profit) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE sale_date >= ?
      GROUP BY DATE_FORMAT(sale_date, '%Y-%m')
      ORDER BY month ASC
    `, [startMonth]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 商品销售排行
router.get('/ranking', requirePermission('stats:view'), async (req, res) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;

    let sql = `
      SELECT
        product_name,
        SUM(quantity) as total_quantity,
        SUM(price * quantity) as total_revenue,
        SUM(profit) as total_profit
      FROM sales
    `;
    const params = [];
    const conditions = [];

    if (start_date) {
      conditions.push('sale_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('sale_date <= ?');
      params.push(end_date);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY product_name ORDER BY total_revenue DESC LIMIT ?';
    params.push(parseInt(limit));

    const [ranking] = await pool.execute(sql, params);
    res.json(ranking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
