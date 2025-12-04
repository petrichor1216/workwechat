const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取概览统计
router.get('/overview', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    // 今日统计
    const todayStats = db.prepare(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE sale_date = ?
    `).get(today);

    // 本周统计
    const weekStats = db.prepare(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE sale_date >= ?
    `).get(weekAgo);

    // 本月统计
    const monthStats = db.prepare(`
      SELECT
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE sale_date >= ?
    `).get(monthStart);

    // 商品总数和库存预警（库存<5）
    const productStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN stock < 5 AND is_custom = 0 THEN 1 ELSE 0 END) as low_stock
      FROM products
    `).get();

    res.json({
      today: todayStats,
      week: weekStats,
      month: monthStats,
      products: productStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按日期统计销售数据
router.get('/daily', (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const stats = db.prepare(`
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
    `).all(startDate);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 按月统计
router.get('/monthly', (req, res) => {
  try {
    const { months = 12 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));
    const startMonth = startDate.toISOString().substring(0, 7);

    const stats = db.prepare(`
      SELECT
        substr(sale_date, 1, 7) as month,
        COALESCE(SUM(price * quantity), 0) as revenue,
        COALESCE(SUM(cost * quantity), 0) as cost,
        COALESCE(SUM((price - cost) * quantity), 0) as profit,
        COUNT(*) as order_count
      FROM sales
      WHERE substr(sale_date, 1, 7) >= ?
      GROUP BY substr(sale_date, 1, 7)
      ORDER BY month ASC
    `).all(startMonth);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 商品销售排行
router.get('/ranking', (req, res) => {
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

    const ranking = db.prepare(sql).all(...params);
    res.json(ranking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
