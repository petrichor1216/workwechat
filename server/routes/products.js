const express = require('express');
const router = express.Router();
const { db, _, COLLECTIONS, logOperation, generateId } = require('../database');
const { requirePermission } = require('../auth');

const productsCollection = db.collection(COLLECTIONS.PRODUCTS);

// 获取所有商品
router.get('/', requirePermission('product:view'), async (req, res) => {
  try {
    const { data: products } = await productsCollection
      .orderBy('updated_at', 'desc')
      .limit(1000)
      .get();

    // 转换数据格式，保持与前端兼容
    const result = products.map(p => ({
      id: p.id,
      _id: p._id,
      name: p.name,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      is_custom: p.is_custom ? 1 : 0,
      created_at: p.created_at,
      updated_at: p.updated_at
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个商品
router.get('/:id', requirePermission('product:view'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data: products } = await productsCollection
      .where({ id: id })
      .get();

    if (products.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const p = products[0];
    res.json({
      id: p.id,
      _id: p._id,
      name: p.name,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      is_custom: p.is_custom ? 1 : 0,
      created_at: p.created_at,
      updated_at: p.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增商品
router.post('/', requirePermission('product:create'), async (req, res) => {
  try {
    const { name, price, cost, stock, is_custom } = req.body;
    if (!name) {
      return res.status(400).json({ error: '商品名称不能为空' });
    }

    const id = await generateId(COLLECTIONS.PRODUCTS);
    const now = new Date();

    const productData = {
      id,
      name,
      price: price || 0,
      cost: cost || 0,
      stock: stock || 0,
      is_custom: !!is_custom,
      created_at: now,
      updated_at: now
    };

    await productsCollection.add(productData);

    const product = {
      ...productData,
      is_custom: productData.is_custom ? 1 : 0
    };

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
router.put('/:id', requirePermission('product:update'), async (req, res) => {
  try {
    const { name, price, cost, stock, is_custom } = req.body;
    const id = parseInt(req.params.id);

    const { data: existingProducts } = await productsCollection
      .where({ id: id })
      .get();

    if (existingProducts.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const existing = existingProducts[0];
    const now = new Date();

    const updateData = {
      name: name || existing.name,
      price: price !== undefined ? price : existing.price,
      cost: cost !== undefined ? cost : existing.cost,
      stock: stock !== undefined ? stock : existing.stock,
      is_custom: is_custom !== undefined ? !!is_custom : existing.is_custom,
      updated_at: now
    };

    await productsCollection
      .where({ id: id })
      .update(updateData);

    const product = {
      id: existing.id,
      _id: existing._id,
      ...updateData,
      is_custom: updateData.is_custom ? 1 : 0,
      created_at: existing.created_at
    };

    // 生成变更内容描述
    const changes = [];
    if (name && name !== existing.name) changes.push(`名称: ${existing.name} → ${name}`);
    if (price !== undefined && price !== existing.price) changes.push(`售价: ¥${existing.price} → ¥${price}`);
    if (cost !== undefined && cost !== existing.cost) changes.push(`成本: ¥${existing.cost} → ¥${cost}`);
    if (stock !== undefined && stock !== existing.stock) changes.push(`库存: ${existing.stock} → ${stock}`);
    if (is_custom !== undefined && !!is_custom !== existing.is_custom) {
      changes.push(`定制品: ${existing.is_custom ? '是' : '否'} → ${is_custom ? '是' : '否'}`);
    }

    // 记录操作日志
    await logOperation(req, {
      action: 'update',
      targetType: 'product',
      targetId: product.id,
      targetName: product.name,
      content: `修改商品: ${product.name}${changes.length > 0 ? ' - ' + changes.join(', ') : ''}`,
      beforeData: { ...existing, is_custom: existing.is_custom ? 1 : 0 },
      afterData: product
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除商品
router.delete('/:id', requirePermission('product:delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const { data: existingProducts } = await productsCollection
      .where({ id: id })
      .get();

    if (existingProducts.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const existing = existingProducts[0];

    await productsCollection.where({ id: id }).remove();

    // 记录操作日志
    await logOperation(req, {
      action: 'delete',
      targetType: 'product',
      targetId: existing.id,
      targetName: existing.name,
      content: `删除商品: ${existing.name}, 售价: ¥${existing.price}, 成本: ¥${existing.cost}, 库存: ${existing.stock}`,
      beforeData: { ...existing, is_custom: existing.is_custom ? 1 : 0 }
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
