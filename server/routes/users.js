const express = require('express');
const router = express.Router();
const { db, _, COLLECTIONS, logOperation } = require('../database');
const { requirePermission } = require('../auth');

const usersCollection = db.collection(COLLECTIONS.USERS);

// 获取用户列表（仅管理员）
router.get('/', requirePermission('user:manage'), async (req, res) => {
  try {
    const { role, is_active, limit = 100, offset = 0 } = req.query;

    let query = usersCollection.orderBy('created_at', 'desc');

    const conditions = {};
    if (role) conditions.role = role;
    if (is_active !== undefined) {
      conditions.is_active = is_active === 'true';
    }

    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions);
    }

    const { data: users } = await query
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .get();

    // 过滤敏感字段
    const result = users.map(u => ({
      id: u.id,
      _id: u._id,
      userid: u.userid,
      name: u.name,
      avatar: u.avatar,
      role: u.role,
      is_active: u.is_active,
      last_login_at: u.last_login_at,
      created_at: u.created_at
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个用户信息
router.get('/:userid', requirePermission('user:manage'), async (req, res) => {
  try {
    const { data: users } = await usersCollection
      .where({ userid: req.params.userid })
      .get();

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const u = users[0];
    res.json({
      id: u.id,
      _id: u._id,
      userid: u.userid,
      name: u.name,
      avatar: u.avatar,
      role: u.role,
      is_active: u.is_active,
      last_login_at: u.last_login_at,
      created_at: u.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加用户（仅管理员）
router.post('/', requirePermission('user:manage'), async (req, res) => {
  try {
    const { userid, name, role } = req.body;

    if (!userid) {
      return res.status(400).json({ error: '用户ID不能为空' });
    }

    const validRoles = ['admin', 'staff', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }

    // 检查用户是否已存在
    const { data: existing } = await usersCollection
      .where({ userid: userid })
      .get();

    if (existing.length > 0) {
      return res.status(400).json({ error: '用户已存在' });
    }

    const now = new Date();
    const userData = {
      userid,
      name: name || userid,
      role: role || 'viewer',
      is_active: true,
      created_at: now,
      updated_at: now
    };

    await usersCollection.add(userData);

    const user = {
      ...userData,
      avatar: null,
      last_login_at: null
    };

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'user',
      targetId: userid,
      targetName: user.name,
      content: `添加用户: ${user.name} (${user.userid}), 角色: ${user.role}`,
      afterData: user
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新用户角色（仅管理员）
router.put('/:userid', requirePermission('user:manage'), async (req, res) => {
  try {
    const { name, role, is_active } = req.body;
    const targetUserid = req.params.userid;

    // 获取原用户信息
    const { data: existing } = await usersCollection
      .where({ userid: targetUserid })
      .get();

    if (existing.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const oldUser = existing[0];

    // 不能修改自己的角色（防止管理员把自己降级）
    if (targetUserid === req.user.userid && role && role !== oldUser.role) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }

    const validRoles = ['admin', 'staff', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }

    // 不能禁用自己
    if (targetUserid === req.user.userid && is_active === false) {
      return res.status(400).json({ error: '不能禁用自己的账号' });
    }

    const updateData = { updated_at: new Date() };
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    await usersCollection
      .where({ userid: targetUserid })
      .update(updateData);

    const newUser = {
      ...oldUser,
      ...updateData
    };

    // 生成变更描述
    const changes = [];
    if (name !== undefined && name !== oldUser.name) changes.push(`名称: ${oldUser.name} → ${name}`);
    if (role !== undefined && role !== oldUser.role) changes.push(`角色: ${oldUser.role} → ${role}`);
    if (is_active !== undefined && is_active !== oldUser.is_active) {
      changes.push(`状态: ${oldUser.is_active ? '启用' : '禁用'} → ${is_active ? '启用' : '禁用'}`);
    }

    // 记录操作日志
    await logOperation(req, {
      action: 'update',
      targetType: 'user',
      targetId: targetUserid,
      targetName: newUser.name,
      content: `修改用户: ${newUser.name} (${newUser.userid}) - ${changes.join(', ')}`,
      beforeData: oldUser,
      afterData: newUser
    });

    res.json({
      userid: newUser.userid,
      name: newUser.name,
      avatar: newUser.avatar,
      role: newUser.role,
      is_active: newUser.is_active,
      created_at: newUser.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除用户（仅管理员）
router.delete('/:userid', requirePermission('user:manage'), async (req, res) => {
  try {
    const targetUserid = req.params.userid;

    // 不能删除自己
    if (targetUserid === req.user.userid) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    const { data: existing } = await usersCollection
      .where({ userid: targetUserid })
      .get();

    if (existing.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const oldUser = existing[0];

    await usersCollection.where({ userid: targetUserid }).remove();

    // 记录操作日志
    await logOperation(req, {
      action: 'delete',
      targetType: 'user',
      targetId: targetUserid,
      targetName: oldUser.name,
      content: `删除用户: ${oldUser.name} (${oldUser.userid}), 角色: ${oldUser.role}`,
      beforeData: oldUser
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 角色说明
router.get('/roles/info', async (req, res) => {
  res.json({
    roles: [
      { value: 'admin', label: '管理员', description: '所有权限：商品增删改、销售增删、库存入出、查看日志、管理用户' },
      { value: 'staff', label: '店员', description: '可添加销售记录、查看商品和库存，不能删除或修改' },
      { value: 'viewer', label: '查看者', description: '只能查看数据，不能进行任何操作' }
    ]
  });
});

module.exports = router;
