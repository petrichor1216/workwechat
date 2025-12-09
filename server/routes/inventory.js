const express = require('express');
const router = express.Router();
const { pool, logOperation } = require('../database');
const { requirePermission } = require('../auth');

// 获取库存列表（商品及其库存）
router.get('/', requirePermission('inventory:view'), async (req, res) => {
  try {
    const [products] = await pool.execute(
      'SELECT * FROM products WHERE is_custom = 0 ORDER BY name ASC LIMIT 1000'
    );
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取库存日志
router.get('/logs', requirePermission('inventory:view'), async (req, res) => {
  try {
    const { product_id, type, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM inventory_logs';
    const params = [];
    const conditions = [];

    if (product_id) {
      conditions.push('product_id = ?');
      params.push(product_id);
    }
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
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
    await connection.beginTransaction();

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
      await connection.rollback();
      return res.status(404).json({ error: '商品不存在' });
    }

    const product = products[0];
    const oldStock = product.stock;
    const newStock = oldStock + quantity;

    // 更新库存
    await connection.execute(
      'UPDATE products SET stock = ? WHERE id = ?',
      [newStock, product_id]
    );

    // 记录库存日志
    const [result] = await connection.execute(
      'INSERT INTO inventory_logs (product_id, product_name, type, quantity, before_stock, after_stock, remark, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [product_id, product.name, 'in', quantity, oldStock, newStock, remark || '手动入库', req.user?.userid, req.user?.name]
    );

    await connection.commit();

    const [logs] = await pool.execute(
      'SELECT * FROM inventory_logs WHERE id = ?',
      [result.insertId]
    );

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'inventory',
      targetId: result.insertId,
      targetName: product.name,
      content: `商品入库: ${product.name}, 数量: +${quantity}, 库存: ${oldStock} → ${newStock}`,
      beforeData: { stock: oldStock },
      afterData: { stock: newStock, quantity }
    });

    res.status(201).json({
      log: logs[0],
      product: { ...product, stock: newStock }
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
    await connection.beginTransaction();

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
      await connection.rollback();
      return res.status(404).json({ error: '商品不存在' });
    }

    const product = products[0];

    if (product.stock < quantity) {
      await connection.rollback();
      return res.status(400).json({ error: `库存不足，当前库存：${product.stock}` });
    }

    const oldStock = product.stock;
    const newStock = oldStock - quantity;

    // 更新库存
    await connection.execute(
      'UPDATE products SET stock = ? WHERE id = ?',
      [newStock, product_id]
    );

    // 记录库存日志
    const [result] = await connection.execute(
      'INSERT INTO inventory_logs (product_id, product_name, type, quantity, before_stock, after_stock, remark, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [product_id, product.name, 'out', quantity, oldStock, newStock, remark || '手动出库', req.user?.userid, req.user?.name]
    );

    await connection.commit();

    const [logs] = await pool.execute(
      'SELECT * FROM inventory_logs WHERE id = ?',
      [result.insertId]
    );

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'inventory',
      targetId: result.insertId,
      targetName: product.name,
      content: `商品出库: ${product.name}, 数量: -${quantity}, 库存: ${oldStock} → ${newStock}`,
      beforeData: { stock: oldStock },
      afterData: { stock: newStock, quantity }
    });

    res.status(201).json({
      log: logs[0],
      product: { ...product, stock: newStock }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
