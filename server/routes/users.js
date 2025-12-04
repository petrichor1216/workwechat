const express = require('express');
const router = express.Router();
const { pool, logOperation } = require('../database');
const { requirePermission } = require('../auth');

// 获取用户列表（仅管理员）
router.get('/', requirePermission('user:manage'), async (req, res) => {
  try {
    const { role, is_active, limit = 100, offset = 0 } = req.query;

    let sql = 'SELECT id, userid, name, avatar, role, is_active, last_login_at, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.execute(sql, params);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个用户信息
router.get('/:userid', requirePermission('user:manage'), async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, userid, name, avatar, role, is_active, last_login_at, created_at FROM users WHERE userid = ?',
      [req.params.userid]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(users[0]);
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
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE userid = ?',
      [userid]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: '用户已存在' });
    }

    await pool.execute(
      'INSERT INTO users (userid, name, role) VALUES (?, ?, ?)',
      [userid, name || userid, role || 'viewer']
    );

    const [users] = await pool.execute(
      'SELECT id, userid, name, avatar, role, is_active, created_at FROM users WHERE userid = ?',
      [userid]
    );

    // 记录操作日志
    await logOperation(req, {
      action: 'create',
      targetType: 'user',
      targetId: users[0].id,
      targetName: users[0].name,
      content: `添加用户: ${users[0].name} (${users[0].userid}), 角色: ${users[0].role}`,
      afterData: users[0]
    });

    res.status(201).json(users[0]);
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
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE userid = ?',
      [targetUserid]
    );

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

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }
    if (is_active !== undefined) {
      // 不能禁用自己
      if (targetUserid === req.user.userid && !is_active) {
        return res.status(400).json({ error: '不能禁用自己的账号' });
      }
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    params.push(targetUserid);
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE userid = ?`,
      params
    );

    const [users] = await pool.execute(
      'SELECT id, userid, name, avatar, role, is_active, created_at FROM users WHERE userid = ?',
      [targetUserid]
    );

    // 生成变更描述
    const changes = [];
    if (name !== undefined && name !== oldUser.name) changes.push(`名称: ${oldUser.name} → ${name}`);
    if (role !== undefined && role !== oldUser.role) changes.push(`角色: ${oldUser.role} → ${role}`);
    if (is_active !== undefined && (is_active ? 1 : 0) !== oldUser.is_active) {
      changes.push(`状态: ${oldUser.is_active ? '启用' : '禁用'} → ${is_active ? '启用' : '禁用'}`);
    }

    // 记录操作日志
    await logOperation(req, {
      action: 'update',
      targetType: 'user',
      targetId: users[0].id,
      targetName: users[0].name,
      content: `修改用户: ${users[0].name} (${users[0].userid}) - ${changes.join(', ')}`,
      beforeData: oldUser,
      afterData: users[0]
    });

    res.json(users[0]);
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

    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE userid = ?',
      [targetUserid]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const oldUser = existing[0];

    await pool.execute('DELETE FROM users WHERE userid = ?', [targetUserid]);

    // 记录操作日志
    await logOperation(req, {
      action: 'delete',
      targetType: 'user',
      targetId: oldUser.id,
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
      { value: 'admin', label: '管理员', description: '所有权限，可管理用户' },
      { value: 'staff', label: '店员', description: '可添加销售记录、管理库存，不能删除' },
      { value: 'viewer', label: '查看者', description: '只能查看数据，不能操作' }
    ]
  });
});

module.exports = router;
