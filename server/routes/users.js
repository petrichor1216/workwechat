const express = require('express');
const router = express.Router();
const { requirePermission } = require('../auth');

// 角色说明
router.get('/roles/info', async (req, res) => {
  res.json({
    roles: [
      { value: 'admin', label: '管理员', description: '所有权限：商品增删改、销售增删、库存入出、查看日志' },
      { value: 'staff', label: '店员', description: '可添加销售记录、查看商品和库存，不能删除或修改' }
    ]
  });
});

// 获取当前登录用户列表（简化版本）
router.get('/', requirePermission('user:manage'), async (req, res) => {
  // 简化登录模式下，没有用户表，直接返回空列表
  res.json([]);
});

module.exports = router;
