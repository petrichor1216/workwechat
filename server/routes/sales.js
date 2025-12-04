const express = require('express');
const router = express.Router();
const { db, _, COLLECTIONS, logOperation, generateId } = require('../database');
const { requirePermission } = require('../auth');

const salesCollection = db.collection(COLLECTIONS.SALES);
const productsCollection = db.collection(COLLECTIONS.PRODUCTS);
const inventoryLogsCollection = db.collection(COLLECTIONS.INVENTORY_LOGS);

// 获取销售记录列表
router.get('/', requirePermission('sale:view'), async (req, res) => {
  try {
    const { start_date, end_date, limit = 50, offset = 0 } = req.query;

    let query = salesCollection.orderBy('sale_date', 'desc').orderBy('created_at', 'desc');

    // 日期筛选
    if (start_date && end_date) {
      query = query.where({
        sale_date: _.gte(start_date).and(_.lte(end_date))
      });
    } else if (start_date) {
      query = query.where({ sale_date: _.gte(start_date) });
    } else if (end_date) {
      query = query.where({ sale_date: _.lte(end_date) });
    }

    const { data: sales } = await query
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .get();

    // 转换格式
    const result = sales.map(s => ({
      id: s.id,
      _id: s._id,
      product_id: s.product_id,
      product_name: s.product_name,
      quantity: s.quantity,
      price: s.price,
      cost: s.cost,
      is_custom: s.is_custom ? 1 : 0,
      customer: s.customer,
      remark: s.remark,
      sale_date: s.sale_date,
      created_at: s.created_at
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单条销售记录
router.get('/:id', requirePermission('sale:view'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data: sales } = await salesCollection
      .where({ id: id })
      .get();

    if (sales.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const s = sales[0];
    res.json({
      id: s.id,
      _id: s._id,
      product_id: s.product_id,
      product_name: s.product_name,
      quantity: s.quantity,
      price: s.price,
      cost: s.cost,
      is_custom: s.is_custom ? 1 : 0,
      customer: s.customer,
      remark: s.remark,
      sale_date: s.sale_date,
      created_at: s.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 新增销售记录
router.post('/', requirePermission('sale:create'), async (req, res) => {
  try {
    const { product_id, product_name, quantity, price, cost, is_custom, customer, remark, sale_date } = req.body;

    if (!product_name) {
      return res.status(400).json({ error: '商品名称不能为空' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: '数量必须大于0' });
    }

    const saleDate = sale_date || new Date().toISOString().split('T')[0];
    const saleId = await generateId(COLLECTIONS.SALES);
    const now = new Date();

    const saleData = {
      id: saleId,
      product_id: product_id ? parseInt(product_id) : null,
      product_name,
      quantity,
      price: price || 0,
      cost: cost || 0,
      is_custom: !!is_custom,
      customer: customer || null,
      remark: remark || null,
      sale_date: saleDate,
      created_at: now
    };

    await salesCollection.add(saleData);

    // 如果是非定制品且关联了商品，扣减库存
    if (!is_custom && product_id) {
      const { data: products } = await productsCollection
        .where({ id: parseInt(product_id) })
        .get();

      if (products.length > 0) {
        const product = products[0];
        const newStock = Math.max(0, product.stock - quantity);

        await productsCollection
          .where({ id: parseInt(product_id) })
          .update({
            stock: newStock,
            updated_at: now
          });

        // 记录出库日志
        const logId = await generateId(COLLECTIONS.INVENTORY_LOGS);
        await inventoryLogsCollection.add({
          id: logId,
          product_id: parseInt(product_id),
          product_name: product.name,
          type: 'out',
          quantity,
          remark: `销售出库 - 订单#${saleId}`,
          created_at: now
        });
      }
    }

    const sale = {
      ...saleData,
      is_custom: saleData.is_custom ? 1 : 0
    };

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
    res.status(500).json({ error: error.message });
  }
});

// 删除销售记录
router.delete('/:id', requirePermission('sale:delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data: sales } = await salesCollection
      .where({ id: id })
      .get();

    if (sales.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const sale = sales[0];
    const now = new Date();

    // 如果非定制品，恢复库存
    if (!sale.is_custom && sale.product_id) {
      const { data: products } = await productsCollection
        .where({ id: sale.product_id })
        .get();

      if (products.length > 0) {
        const product = products[0];

        await productsCollection
          .where({ id: sale.product_id })
          .update({
            stock: _.inc(sale.quantity),
            updated_at: now
          });

        // 记录入库日志（撤销出库）
        const logId = await generateId(COLLECTIONS.INVENTORY_LOGS);
        await inventoryLogsCollection.add({
          id: logId,
          product_id: sale.product_id,
          product_name: product.name,
          type: 'in',
          quantity: sale.quantity,
          remark: `撤销销售 - 订单#${sale.id}`,
          created_at: now
        });
      }
    }

    await salesCollection.where({ id: id }).remove();

    // 记录操作日志
    await logOperation(req, {
      action: 'delete',
      targetType: 'sale',
      targetId: sale.id,
      targetName: sale.product_name,
      content: `删除销售记录: ${sale.product_name} x${sale.quantity}, 金额: ¥${(sale.price * sale.quantity).toFixed(2)}, 日期: ${sale.sale_date}`,
      beforeData: { ...sale, is_custom: sale.is_custom ? 1 : 0 }
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
