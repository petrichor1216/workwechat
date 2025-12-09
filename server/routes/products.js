const express = require('express');
const router = express.Router();
const { pool, logOperation } = require('../database');
const { requirePermission } = require('../auth');

// 获取所有商品
router.get('/', requirePermission('product:view'), async (req, res) => {
  try {
    const [products] = await pool.execute(
      'SELECT * FROM products ORDER BY updated_at DESC LIMIT 1000'
    );
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个商品
router.get('/:id', requirePermission('product:view'), async (req, res) => {
  try {
    const [products] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    res.json(products[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增商品
router.post('/', requirePermission('product:create'), async (req, res) => {
  try {
    const { name, price, cost, stock, is_custom, alert_threshold } = req.body;
    if (!name) {
      return res.status(400).json({ error: '商品名称不能为空' });
    }

    const [result] = await pool.execute(
      'INSERT INTO products (name, price, cost, stock, is_custom, alert_threshold) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price || 0, cost || 0, stock || 0, is_custom ? 1 : 0, alert_threshold || 10]
    );

    const [products] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [result.insertId]
    );

    const product = products[0];

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'product',
      targetId: product.id,
      targetName: product.name,
      content: `添加商品: ${product.name}, 售价: ¥${product.price}, 成本: ¥${product.cost}, 库存: ${product.stock}`
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新商品
router.put('/:id', requirePermission('product:update'), async (req, res) => {
  try {
    const { name, price, cost, stock, is_custom, alert_threshold } = req.body;
    const id = req.params.id;

    const [existing] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const oldProduct = existing[0];

    await pool.execute(
      'UPDATE products SET name = ?, price = ?, cost = ?, stock = ?, is_custom = ?, alert_threshold = ? WHERE id = ?',
      [
        name || oldProduct.name,
        price !== undefined ? price : oldProduct.price,
        cost !== undefined ? cost : oldProduct.cost,
        stock !== undefined ? stock : oldProduct.stock,
        is_custom !== undefined ? (is_custom ? 1 : 0) : oldProduct.is_custom,
        alert_threshold !== undefined ? alert_threshold : oldProduct.alert_threshold,
        id
      ]
    );

    const [products] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );

    const product = products[0];

    // 记录操作日志
    await logOperation(req, {
      action: 'update',
      targetType: 'product',
      targetId: product.id,
      targetName: product.name,
      content: `修改商品: ${product.name}`
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除商品
router.delete('/:id', requirePermission('product:delete'), async (req, res) => {
  try {
    const id = req.params.id;

    const [existing] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const product = existing[0];

    await pool.execute('DELETE FROM products WHERE id = ?', [id]);

    // 记录操作日志
    await logOperation(req, {
      action: 'delete',
      targetType: 'product',
      targetId: product.id,
      targetName: product.name,
      content: `删除商品: ${product.name}`
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
