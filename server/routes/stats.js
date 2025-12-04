const express = require('express');
const router = express.Router();
const { pool } = require('../database');

// 获取概览统计
router.get('/overview', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    // 今日统计
    const [todayRows] = await pool.execute(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE sale_date = ?
    `, [today]);

    // 本周统计
    const [weekRows] = await pool.execute(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE sale_date >= ?
    `, [weekAgo]);

    // 本月统计
    const [monthRows] = await pool.execute(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE sale_date >= ?
    `, [monthStart]);

    // 商品总数和库存预警（库存<5）
    const [productRows] = await pool.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN stock < 5 AND is_custom = 0 THEN 1 ELSE 0 END) as low_stock
      FROM products
    `);

    res.json({
      today: todayRows[0],
      week: weekRows[0],
      month: monthRows[0],
      products: productRows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按日期统计销售数据
router.get('/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const [stats] = await pool.execute(`
      SELECT
        sale_date as date,
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
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
router.get('/monthly', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));
    const startMonth = startDate.toISOString().substring(0, 7);

    const [stats] = await pool.execute(`
      SELECT
        LEFT(sale_date, 7) as month,
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE LEFT(sale_date, 7) >= ?
      GROUP BY LEFT(sale_date, 7)
      ORDER BY month ASC
    `, [startMonth]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 商品销售排行
router.get('/ranking', async (req, res) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;

    let sql = `
      SELECT
        product_name,
        SUM(quantity) as total_quantity,
        COALESCE(SUM(price * quantity), 0) as total_revenue,
        COALESCE(SUM((price - cost) * quantity), 0) as total_profit
      FROM sales
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      sql += ' AND sale_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND sale_date <= ?';
      params.push(end_date);
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
