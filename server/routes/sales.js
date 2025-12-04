const express = require('express');
const router = express.Router();
const { pool, logOperation } = require('../database');
const { requirePermission } = require('../auth');

// 获取销售记录列表
router.get('/', requirePermission('sale:view'), async (req, res) => {
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

    const [sales] = await pool.execute(sql, params);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单条销售记录
router.get('/:id', requirePermission('sale:view'), async (req, res) => {
  try {
    const [sales] = await pool.execute(
      'SELECT * FROM sales WHERE id = ?',
      [req.params.id]
    );
    if (sales.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
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
    const { product_id, product_name, quantity, price, cost, is_custom, customer, remark, sale_date } = req.body;

    if (!product_name) {
      return res.status(400).json({ error: '商品名称不能为空' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const saleDate = sale_date || new Date().toISOString().split('T')[0];

    await connection.beginTransaction();

    // 插入销售记录
    const [result] = await connection.execute(
      `INSERT INTO sales (product_id, product_name, quantity, price, cost, is_custom, customer, remark, sale_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_id || null,
        product_name,
        quantity,
        price || 0,
        cost || 0,
        is_custom ? 1 : 0,
        customer || null,
        remark || null,
        saleDate
      ]
    );

    const saleId = result.insertId;

    // 如果是非定制品且关联了商品，扣减库存
    if (!is_custom && product_id) {
      const [products] = await connection.execute(
        'SELECT * FROM products WHERE id = ?',
        [product_id]
      );

      if (products.length > 0) {
        const product = products[0];
        const newStock = Math.max(0, product.stock - quantity);

        await connection.execute(
          'UPDATE products SET stock = ? WHERE id = ?',
          [newStock, product_id]
        );

        // 记录出库日志
        await connection.execute(
          `INSERT INTO inventory_logs (product_id, type, quantity, remark)
           VALUES (?, 'out', ?, ?)`,
          [product_id, quantity, `销售出库 - 订单#${saleId}`]
        );
      }
    }

    await connection.commit();

    const [sales] = await pool.execute(
      'SELECT * FROM sales WHERE id = ?',
      [saleId]
    );
    const sale = sales[0];

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'sale',
      targetId: sale.id,
      targetName: sale.product_name,
      content: `添加销售记录: ${sale.product_name} x${sale.quantity}, 金额: ¥${(sale.price * sale.quantity).toFixed(2)}, 客户: ${sale.customer || '未填写'}`,
      afterData: sale
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
  const connection = await pool.getConnection();
  try {
    const [sales] = await connection.execute(
      'SELECT * FROM sales WHERE id = ?',
      [req.params.id]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const sale = sales[0];

    await connection.beginTransaction();

    // 如果非定制品，恢复库存
    if (!sale.is_custom && sale.product_id) {
      const [products] = await connection.execute(
        'SELECT * FROM products WHERE id = ?',
        [sale.product_id]
      );

      if (products.length > 0) {
        await connection.execute(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [sale.quantity, sale.product_id]
        );

        // 记录入库日志（撤销出库）
        await connection.execute(
          `INSERT INTO inventory_logs (product_id, type, quantity, remark)
           VALUES (?, 'in', ?, ?)`,
          [sale.product_id, sale.quantity, `撤销销售 - 订单#${sale.id}`]
        );
      }
    }

    await connection.execute('DELETE FROM sales WHERE id = ?', [req.params.id]);
    await connection.commit();

    // 记录操作日志
    await logOperation(req, {
      action: 'delete',
      targetType: 'sale',
      targetId: sale.id,
      targetName: sale.product_name,
      content: `删除销售记录: ${sale.product_name} x${sale.quantity}, 金额: ¥${(sale.price * sale.quantity).toFixed(2)}, 日期: ${sale.sale_date}`,
      beforeData: sale
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
