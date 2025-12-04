const express = require('express');
const router = express.Router();
const { db, _, COLLECTIONS } = require('../database');
const { requirePermission } = require('../auth');

const salesCollection = db.collection(COLLECTIONS.SALES);
const productsCollection = db.collection(COLLECTIONS.PRODUCTS);

// 获取概览统计
router.get('/overview', requirePermission('stats:view'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    // 今日统计
    const { data: todaySales } = await salesCollection
      .where({ sale_date: today })
      .get();

    const todayStats = todaySales.reduce((acc, s) => ({
      revenue: acc.revenue + (s.price * s.quantity),
      cost: acc.cost + (s.cost * s.quantity),
      profit: acc.profit + ((s.price - s.cost) * s.quantity),
      order_count: acc.order_count + 1
    }), { revenue: 0, cost: 0, profit: 0, order_count: 0 });

    // 本周统计
    const { data: weekSales } = await salesCollection
      .where({ sale_date: _.gte(weekAgo) })
      .get();

    const weekStats = weekSales.reduce((acc, s) => ({
      revenue: acc.revenue + (s.price * s.quantity),
      cost: acc.cost + (s.cost * s.quantity),
      profit: acc.profit + ((s.price - s.cost) * s.quantity),
      order_count: acc.order_count + 1
    }), { revenue: 0, cost: 0, profit: 0, order_count: 0 });

    // 本月统计
    const { data: monthSales } = await salesCollection
      .where({ sale_date: _.gte(monthStart) })
      .get();

    const monthStats = monthSales.reduce((acc, s) => ({
      revenue: acc.revenue + (s.price * s.quantity),
      cost: acc.cost + (s.cost * s.quantity),
      profit: acc.profit + ((s.price - s.cost) * s.quantity),
      order_count: acc.order_count + 1
    }), { revenue: 0, cost: 0, profit: 0, order_count: 0 });

    // 商品总数和库存预警（库存<5）
    const { data: products } = await productsCollection.get();
    const productStats = products.reduce((acc, p) => ({
      total: acc.total + 1,
      low_stock: acc.low_stock + (p.stock < 5 && !p.is_custom ? 1 : 0)
    }), { total: 0, low_stock: 0 });

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
router.get('/daily', requirePermission('stats:view'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data: sales } = await salesCollection
      .where({ sale_date: _.gte(startDate) })
      .get();

    // 按日期分组统计
    const dailyMap = new Map();
    sales.forEach(s => {
      const date = s.sale_date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, revenue: 0, cost: 0, profit: 0, order_count: 0 });
      }
      const stat = dailyMap.get(date);
      stat.revenue += s.price * s.quantity;
      stat.cost += s.cost * s.quantity;
      stat.profit += (s.price - s.cost) * s.quantity;
      stat.order_count += 1;
    });

    const stats = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
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
    const startMonth = startDate.toISOString().substring(0, 7);

    const { data: sales } = await salesCollection
      .where({ sale_date: _.gte(startMonth + '-01') })
      .get();

    // 按月份分组统计
    const monthlyMap = new Map();
    sales.forEach(s => {
      const month = s.sale_date.substring(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { month, revenue: 0, cost: 0, profit: 0, order_count: 0 });
      }
      const stat = monthlyMap.get(month);
      stat.revenue += s.price * s.quantity;
      stat.cost += s.cost * s.quantity;
      stat.profit += (s.price - s.cost) * s.quantity;
      stat.order_count += 1;
    });

    const stats = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 商品销售排行
router.get('/ranking', requirePermission('stats:view'), async (req, res) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;

    let query = salesCollection;
    if (start_date && end_date) {
      query = query.where({ sale_date: _.gte(start_date).and(_.lte(end_date)) });
    } else if (start_date) {
      query = query.where({ sale_date: _.gte(start_date) });
    } else if (end_date) {
      query = query.where({ sale_date: _.lte(end_date) });
    }

    const { data: sales } = await query.get();

    // 按商品名称分组统计
    const rankingMap = new Map();
    sales.forEach(s => {
      const name = s.product_name;
      if (!rankingMap.has(name)) {
        rankingMap.set(name, { product_name: name, total_quantity: 0, total_revenue: 0, total_profit: 0 });
      }
      const stat = rankingMap.get(name);
      stat.total_quantity += s.quantity;
      stat.total_revenue += s.price * s.quantity;
      stat.total_profit += (s.price - s.cost) * s.quantity;
    });

    const ranking = Array.from(rankingMap.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, parseInt(limit));

    res.json(ranking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
