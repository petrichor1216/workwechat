const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取销售记录列表
router.get('/', (req, res) => {
  try {
    const { start_date, end_date, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM sales WHERE 1=1';
    const params = [];

    if (start_date) {
      sql += ' AND sale_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND sale_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY sale_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const sales = db.prepare(sql).all(...params);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单条销售记录
router.get('/:id', (req, res) => {
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增销售记录
router.post('/', (req, res) => {
  try {
    const { product_id, product_name, quantity, price, cost, is_custom, customer, remark, sale_date } = req.body;

    if (!product_name) {
      return res.status(400).json({ error: '商品名称不能为空' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const saleDate = sale_date || new Date().toISOString().split('T')[0];

    // 使用事务
    const insertSale = db.transaction(() => {
      // 插入销售记录
      const result = db.prepare(`
        INSERT INTO sales (product_id, product_name, quantity, price, cost, is_custom, customer, remark, sale_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product_id || null,
        product_name,
        quantity,
        price || 0,
        cost || 0,
        is_custom ? 1 : 0,
        customer || null,
        remark || null,
        saleDate
      );

      // 如果是非定制品且关联了商品，扣减库存
      if (!is_custom && product_id) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
        if (product) {
          const newStock = Math.max(0, product.stock - quantity);
          db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newStock, product_id);

          // 记录出库日志
          db.prepare(`
            INSERT INTO inventory_logs (product_id, type, quantity, remark)
            VALUES (?, 'out', ?, ?)
          `).run(product_id, quantity, `销售出库 - 订单#${result.lastInsertRowid}`);
        }
      }

      return result.lastInsertRowid;
    });

    const saleId = insertSale();
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除销售记录
router.delete('/:id', (req, res) => {
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: '记录不存在' });
    }

    // 如果非定制品，恢复库存
    if (!sale.is_custom && sale.product_id) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(sale.product_id);
      if (product) {
        db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(sale.quantity, sale.product_id);

        // 记录入库日志（撤销出库）
        db.prepare(`
          INSERT INTO inventory_logs (product_id, type, quantity, remark)
          VALUES (?, 'in', ?, ?)
        `).run(sale.product_id, sale.quantity, `撤销销售 - 订单#${sale.id}`);
      }
    }

    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
