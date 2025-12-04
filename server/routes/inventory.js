const express = require('express');
const router = express.Router();
const { db, _, COLLECTIONS, logOperation, generateId } = require('../database');
const { requirePermission } = require('../auth');

const productsCollection = db.collection(COLLECTIONS.PRODUCTS);
const inventoryLogsCollection = db.collection(COLLECTIONS.INVENTORY_LOGS);

// 获取库存列表（商品及其库存）
router.get('/', requirePermission('inventory:view'), async (req, res) => {
  try {
    const { data: products } = await productsCollection
      .where({ is_custom: false })
      .orderBy('name', 'asc')
      .limit(1000)
      .get();

    const result = products.map(p => ({
      id: p.id,
      _id: p._id,
      name: p.name,
      stock: p.stock,
      price: p.price,
      cost: p.cost,
      is_custom: p.is_custom ? 1 : 0
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取库存日志
router.get('/logs', requirePermission('inventory:view'), async (req, res) => {
  try {
    const { product_id, type, limit = 50, offset = 0 } = req.query;

    let query = inventoryLogsCollection.orderBy('created_at', 'desc');

    if (product_id) {
      query = query.where({ product_id: parseInt(product_id) });
    }
    if (type) {
      query = query.where({ type: type });
    }

    const { data: logs } = await query
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .get();

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 入库操作
router.post('/in', requirePermission('inventory:in'), async (req, res) => {
  try {
    const { product_id, quantity, remark } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: '请选择商品' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const { data: products } = await productsCollection
      .where({ id: parseInt(product_id) })
      .get();

    if (products.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const product = products[0];
    const oldStock = product.stock;
    const newStock = oldStock + quantity;
    const now = new Date();

    // 更新库存
    await productsCollection
      .where({ id: parseInt(product_id) })
      .update({
        stock: newStock,
        updated_at: now
      });

    // 记录库存日志
    const logId = await generateId(COLLECTIONS.INVENTORY_LOGS);
    const logData = {
      id: logId,
      product_id: parseInt(product_id),
      product_name: product.name,
      type: 'in',
      quantity,
      remark: remark || '手动入库',
      created_at: now
    };

    await inventoryLogsCollection.add(logData);

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'inventory',
      targetId: logId,
      targetName: product.name,
      content: `商品入库: ${product.name}, 数量: +${quantity}, 库存: ${oldStock} → ${newStock}, 备注: ${remark || '手动入库'}`,
      beforeData: { stock: oldStock },
      afterData: { stock: newStock, quantity }
    });

    res.status(201).json({
      log: logData,
      product: {
        ...product,
        stock: newStock,
        is_custom: product.is_custom ? 1 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 手动出库操作（非销售出库）
router.post('/out', requirePermission('inventory:out'), async (req, res) => {
  try {
    const { product_id, quantity, remark } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: '请选择商品' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const { data: products } = await productsCollection
      .where({ id: parseInt(product_id) })
      .get();

    if (products.length === 0) {
      return res.status(404).json({ error: '商品不存在' });
    }

    const product = products[0];

    if (product.stock < quantity) {
      return res.status(400).json({ error: `库存不足，当前库存：${product.stock}` });
    }

    const oldStock = product.stock;
    const newStock = oldStock - quantity;
    const now = new Date();

    // 更新库存
    await productsCollection
      .where({ id: parseInt(product_id) })
      .update({
        stock: newStock,
        updated_at: now
      });

    // 记录库存日志
    const logId = await generateId(COLLECTIONS.INVENTORY_LOGS);
    const logData = {
      id: logId,
      product_id: parseInt(product_id),
      product_name: product.name,
      type: 'out',
      quantity,
      remark: remark || '手动出库',
      created_at: now
    };

    await inventoryLogsCollection.add(logData);

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'inventory',
      targetId: logId,
      targetName: product.name,
      content: `商品出库: ${product.name}, 数量: -${quantity}, 库存: ${oldStock} → ${newStock}, 备注: ${remark || '手动出库'}`,
      beforeData: { stock: oldStock },
      afterData: { stock: newStock, quantity }
    });

    res.status(201).json({
      log: logData,
      product: {
        ...product,
        stock: newStock,
        is_custom: product.is_custom ? 1 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
