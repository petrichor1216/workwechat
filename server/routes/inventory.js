const express = require('express');
const router = express.Router();
const { pool, logOperation } = require('../database');
const { requirePermission } = require('../auth');

// 获取库存列表（商品及其库存）
router.get('/', requirePermission('inventory:view'), async (req, res) => {
  try {
    const [products] = await pool.execute(`
      SELECT id, name, stock, price, cost, is_custom
      FROM products
      WHERE is_custom = 0
      ORDER BY name
    `);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取库存日志
router.get('/logs', requirePermission('inventory:view'), async (req, res) => {
  try {
    const { product_id, type, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT l.*, p.name as product_name
      FROM inventory_logs l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      sql += ' AND l.product_id = ?';
      params.push(product_id);
    }
    if (type) {
      sql += ' AND l.type = ?';
      params.push(type);
    }

    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.execute(sql, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 入库操作
router.post('/in', requirePermission('inventory:in'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { product_id, quantity, remark } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: '请选择商品' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const [products] = await connection.execute(
      'SELECT * FROM products WHERE id = ?',
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const product = products[0];
    const oldStock = product.stock;

    await connection.beginTransaction();

    // 更新库存
    await connection.execute(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [quantity, product_id]
    );

    // 记录库存日志
    const [result] = await connection.execute(
      `INSERT INTO inventory_logs (product_id, type, quantity, remark)
       VALUES (?, 'in', ?, ?)`,
      [product_id, quantity, remark || '手动入库']
    );

    await connection.commit();

    const [logs] = await pool.execute(`
      SELECT l.*, p.name as product_name
      FROM inventory_logs l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.id = ?
    `, [result.insertId]);

    const [updatedProducts] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [product_id]
    );

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'inventory',
      targetId: result.insertId,
      targetName: product.name,
      content: `商品入库: ${product.name}, 数量: +${quantity}, 库存: ${oldStock} → ${updatedProducts[0].stock}, 备注: ${remark || '手动入库'}`,
      beforeData: { stock: oldStock },
      afterData: { stock: updatedProducts[0].stock, quantity }
    });

    res.status(201).json({
      log: logs[0],
      product: updatedProducts[0]
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// 手动出库操作（非销售出库）
router.post('/out', requirePermission('inventory:out'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { product_id, quantity, remark } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: '请选择商品' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const [products] = await connection.execute(
      'SELECT * FROM products WHERE id = ?',
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const product = products[0];

    if (product.stock < quantity) {
      return res.status(400).json({ error: `库存不足，当前库存：${product.stock}` });
    }

    const oldStock = product.stock;

    await connection.beginTransaction();

    // 更新库存
    await connection.execute(
      'UPDATE products SET stock = stock - ? WHERE id = ?',
      [quantity, product_id]
    );

    // 记录库存日志
    const [result] = await connection.execute(
      `INSERT INTO inventory_logs (product_id, type, quantity, remark)
       VALUES (?, 'out', ?, ?)`,
      [product_id, quantity, remark || '手动出库']
    );

    await connection.commit();

    const [logs] = await pool.execute(`
      SELECT l.*, p.name as product_name
      FROM inventory_logs l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.id = ?
    `, [result.insertId]);

    const [updatedProducts] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [product_id]
    );

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'inventory',
      targetId: result.insertId,
      targetName: product.name,
      content: `商品出库: ${product.name}, 数量: -${quantity}, 库存: ${oldStock} → ${updatedProducts[0].stock}, 备注: ${remark || '手动出库'}`,
      beforeData: { stock: oldStock },
      afterData: { stock: updatedProducts[0].stock, quantity }
    });

    res.status(201).json({
      log: logs[0],
      product: updatedProducts[0]
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
