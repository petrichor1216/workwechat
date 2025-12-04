const express = require('express');
const router = express.Router();
const { pool, logOperation } = require('../database');

// 获取所有商品
router.get('/', async (req, res) => {
  try {
    const [products] = await pool.execute(
      'SELECT * FROM products ORDER BY updated_at DESC'
    );
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个商品
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    const { name, price, cost, stock, is_custom } = req.body;
    if (!name) {
      return res.status(400).json({ error: '商品名称不能为空' });
    }

    const [result] = await pool.execute(
      'INSERT INTO products (name, price, cost, stock, is_custom) VALUES (?, ?, ?, ?, ?)',
      [name, price || 0, cost || 0, stock || 0, is_custom ? 1 : 0]
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
      content: `添加商品: ${product.name}, 售价: ¥${product.price}, 成本: ¥${product.cost}, 库存: ${product.stock}`,
      afterData: product
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新商品
router.put('/:id', async (req, res) => {
  try {
    const { name, price, cost, stock, is_custom } = req.body;

    const [existingProducts] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    if (existingProducts.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const existing = existingProducts[0];

    await pool.execute(
      'UPDATE products SET name = ?, price = ?, cost = ?, stock = ?, is_custom = ? WHERE id = ?',
      [
        name || existing.name,
        price !== undefined ? price : existing.price,
        cost !== undefined ? cost : existing.cost,
        stock !== undefined ? stock : existing.stock,
        is_custom !== undefined ? (is_custom ? 1 : 0) : existing.is_custom,
        req.params.id
      ]
    );

    const [updatedProducts] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );
    const product = updatedProducts[0];

    // 生成变更内容描述
    const changes = [];
    if (name && name !== existing.name) changes.push(`名称: ${existing.name} → ${name}`);
    if (price !== undefined && price !== parseFloat(existing.price)) changes.push(`售价: ¥${existing.price} → ¥${price}`);
    if (cost !== undefined && cost !== parseFloat(existing.cost)) changes.push(`成本: ¥${existing.cost} → ¥${cost}`);
    if (stock !== undefined && stock !== existing.stock) changes.push(`库存: ${existing.stock} → ${stock}`);
    if (is_custom !== undefined && (is_custom ? 1 : 0) !== existing.is_custom) {
      changes.push(`定制品: ${existing.is_custom ? '是' : '否'} → ${is_custom ? '是' : '否'}`);
    }

    // 记录操作日志
    await logOperation(req, {
      action: 'update',
      targetType: 'product',
      targetId: product.id,
      targetName: product.name,
      content: `修改商品: ${product.name}${changes.length > 0 ? ' - ' + changes.join(', ') : ''}`,
      beforeData: existing,
      afterData: product
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除商品
router.delete('/:id', async (req, res) => {
  try {
    const [existingProducts] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    if (existingProducts.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const existing = existingProducts[0];

    await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id]);

    // 记录操作日志
    await logOperation(req, {
      action: 'delete',
      targetType: 'product',
      targetId: existing.id,
      targetName: existing.name,
      content: `删除商品: ${existing.name}, 售价: ¥${existing.price}, 成本: ¥${existing.cost}, 库存: ${existing.stock}`,
      beforeData: existing
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
