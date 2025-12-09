const express = require('express');
const router = express.Router();
const { pool, logOperation } = require('../database');
const { requirePermission } = require('../auth');

// 获取销售记录列表
router.get('/', requirePermission('sale:view'), async (req, res) => {
  try {
    const { start_date, end_date, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM sales';
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

    sql += ' ORDER BY sale_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [sales] = await pool.execute(sql, params);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个销售记录
router.get('/:id', requirePermission('sale:view'), async (req, res) => {
  try {
    const [sales] = await pool.execute(
      'SELECT * FROM sales WHERE id = ?',
      [req.params.id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: '销售记录不存在' });
    }

    res.json(sales[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增销售记录
router.post('/', requirePermission('sale:create'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { product_id, product_name, quantity = 1, price = 0, cost = 0, sale_date, note } = req.body;

    if (!product_name) {
      return res.status(400).json({ error: '商品名称不能为空' });
    }
    if (quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const saleDate = sale_date || new Date().toISOString().split('T')[0];
    const profit = (price - cost) * quantity;

    // 如果有关联商品，扣减库存
    if (product_id) {
      const [products] = await connection.execute(
        'SELECT * FROM products WHERE id = ?',
        [product_id]
      );

      if (products.length > 0) {
        const product = products[0];
        const newStock = product.stock - quantity;

        if (newStock < 0) {
          await connection.rollback();
          return res.status(400).json({ error: '库存不足' });
        }

        await connection.execute(
          'UPDATE products SET stock = ? WHERE id = ?',
          [newStock, product_id]
        );

        // 记录库存变动
        await connection.execute(
          'INSERT INTO inventory_logs (product_id, product_name, type, quantity, note) VALUES (?, ?, ?, ?, ?)',
          [product_id, product.name, 'out', quantity, '销售出库']
        );
      }
    }

    const [result] = await connection.execute(
      'INSERT INTO sales (product_name, quantity, price, cost, profit, sale_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_name, quantity, price, cost, profit, saleDate, note || null]
    );

    await connection.commit();

    const [sales] = await pool.execute(
      'SELECT * FROM sales WHERE id = ?',
      [result.insertId]
    );

    const sale = sales[0];

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'sale',
      targetId: sale.id,
      targetName: sale.product_name,
      content: `添加销售记录: ${sale.product_name} x${sale.quantity}, 金额: ¥${(sale.price * sale.quantity).toFixed(2)}`
    });

    res.status(201).json(sale);
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// 删除销售记录
router.delete('/:id', requirePermission('sale:delete'), async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT * FROM sales WHERE id = ?',
      [req.params.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '销售记录不存在' });
    }

    const sale = existing[0];

    await pool.execute('DELETE FROM sales WHERE id = ?', [req.params.id]);

    // 记录操作日志
    await logOperation(req, {
      action: 'delete',
      targetType: 'sale',
      targetId: sale.id,
      targetName: sale.product_name,
      content: `删除销售记录: ${sale.product_name} x${sale.quantity}`
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
