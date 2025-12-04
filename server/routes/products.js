const express = require('express');
const router = express.Router();
const db = require('../database');

// 获取所有商品
router.get('/', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT * FROM products ORDER BY updated_at DESC
    `).all();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个商品
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: '商品不存在' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增商品
router.post('/', (req, res) => {
  try {
    const { name, price, cost, stock, is_custom } = req.body;
    if (!name) {
      return res.status(400).json({ error: '商品名称不能为空' });
    }
    const result = db.prepare(`
      INSERT INTO products (name, price, cost, stock, is_custom)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, price || 0, cost || 0, stock || 0, is_custom ? 1 : 0);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新商品
router.put('/:id', (req, res) => {
  try {
    const { name, price, cost, stock, is_custom } = req.body;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '商品不存在' });
    }

    db.prepare(`
      UPDATE products
      SET name = ?, price = ?, cost = ?, stock = ?, is_custom = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || existing.name,
      price !== undefined ? price : existing.price,
      cost !== undefined ? cost : existing.cost,
      stock !== undefined ? stock : existing.stock,
      is_custom !== undefined ? (is_custom ? 1 : 0) : existing.is_custom,
      req.params.id
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除商品
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: '商品不存在' });
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
