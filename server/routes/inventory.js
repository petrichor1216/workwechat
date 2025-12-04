const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取库存列表（商品及其库存）
router.get('/', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT id, name, stock, price, cost, is_custom
      FROM products
      WHERE is_custom = 0
      ORDER BY name
    `).all();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取库存日志
router.get('/logs', (req, res) => {
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

    const logs = db.prepare(sql).all(...params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 入库操作
router.post('/in', (req, res) => {
  try {
    const { product_id, quantity, remark } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: '请选择商品' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }

    // 使用事务
    const doInStock = db.transaction(() => {
      // 更新库存
      db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(quantity, product_id);

      // 记录日志
      const result = db.prepare(`
        INSERT INTO inventory_logs (product_id, type, quantity, remark)
        VALUES (?, 'in', ?, ?)
      `).run(product_id, quantity, remark || '手动入库');

      return result.lastInsertRowid;
    });

    const logId = doInStock();
    const log = db.prepare(`
      SELECT l.*, p.name as product_name
      FROM inventory_logs l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.id = ?
    `).get(logId);

    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);

    res.status(201).json({
      log,
      product: updatedProduct
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 手动出库操作（非销售出库）
router.post('/out', (req, res) => {
  try {
    const { product_id, quantity, remark } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: '请选择商品' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: `库存不足，当前库存：${product.stock}` });
    }

    // 使用事务
    const doOutStock = db.transaction(() => {
      // 更新库存
      db.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(quantity, product_id);

      // 记录日志
      const result = db.prepare(`
        INSERT INTO inventory_logs (product_id, type, quantity, remark)
        VALUES (?, 'out', ?, ?)
      `).run(product_id, quantity, remark || '手动出库');

      return result.lastInsertRowid;
    });

    const logId = doOutStock();
    const log = db.prepare(`
      SELECT l.*, p.name as product_name
      FROM inventory_logs l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.id = ?
    `).get(logId);

    const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);

    res.status(201).json({
      log,
      product: updatedProduct
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
