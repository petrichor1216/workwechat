const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const {
  getUserByCode,
  getUserDetail,
  generateToken,
  hasPermission,
  PERMISSIONS,
  CORP_ID,
  AGENT_ID
} = require('../auth');

// 获取企业微信配置（前端需要用于 JS-SDK）
router.get('/config', (req, res) => {
  res.json({
    corpId: CORP_ID,
    agentId: AGENT_ID
  });
});

// 企业微信 OAuth 登录
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: '缺少 code 参数' });
    }

    // 开发模式：模拟登录
    if (process.env.NODE_ENV !== 'production' && code.startsWith('dev_')) {
      const userid = code.replace('dev_', '') || 'dev_user';
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE userid = ? AND is_active = 1',
        [userid]
      );

      let user;
      if (users.length === 0) {
        // 首次登录，创建用户
        await pool.execute(
          'INSERT INTO users (userid, name, role) VALUES (?, ?, ?)',
          [userid, `用户_${userid}`, 'viewer']
        );
        const [newUsers] = await pool.execute(
          'SELECT * FROM users WHERE userid = ?',
          [userid]
        );
        user = newUsers[0];
      } else {
        user = users[0];
      }

      // 更新最后登录时间
      await pool.execute(
        'UPDATE users SET last_login_at = NOW() WHERE userid = ?',
        [userid]
      );

      const token = generateToken(user);
      return res.json({
        token,
        user: {
          userid: user.userid,
          name: user.name,
          avatar: user.avatar,
          role: user.role
        }
      });
    }

    // 生产模式：通过企业微信验证
    let wecomUser;
    try {
      wecomUser = await getUserByCode(code);
    } catch (error) {
      return res.status(401).json({ error: '登录失败: ' + error.message });
    }

    const userid = wecomUser.userid || wecomUser.UserId;
    if (!userid) {
      return res.status(401).json({ error: '无法获取用户身份' });
    }

    // 查询用户
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE userid = ? AND is_active = 1',
      [userid]
    );

    let user;
    if (users.length === 0) {
      // 首次登录，获取用户详情并创建
      let userDetail = { userid, name: userid };
      try {
        userDetail = await getUserDetail(userid);
      } catch (e) {
        console.error('获取用户详情失败:', e);
      }

      await pool.execute(
        'INSERT INTO users (userid, name, avatar, role) VALUES (?, ?, ?, ?)',
        [userid, userDetail.name, userDetail.avatar || null, 'viewer']
      );

      const [newUsers] = await pool.execute(
        'SELECT * FROM users WHERE userid = ?',
        [userid]
      );
      user = newUsers[0];
    } else {
      user = users[0];
    }

    // 更新最后登录时间
    await pool.execute(
      'UPDATE users SET last_login_at = NOW() WHERE userid = ?',
      [userid]
    );

    const token = generateToken(user);
    res.json({
      token,
      user: {
        userid: user.userid,
        name: user.name,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败: ' + error.message });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未登录' });
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE userid = ? AND is_active = 1',
      [req.user.userid]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '用户不存在或已禁用' });
    }

    const user = users[0];

    // 计算用户权限列表
    const permissions = {};
    for (const [perm, roles] of Object.entries(PERMISSIONS)) {
      permissions[perm] = roles.includes(user.role);
    }

    res.json({
      userid: user.userid,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      permissions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 刷新 token
router.post('/refresh', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未登录' });
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE userid = ? AND is_active = 1',
      [req.user.userid]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '用户不存在或已禁用' });
    }

    const user = users[0];
    const token = generateToken(user);

    res.json({
      token,
      user: {
        userid: user.userid,
        name: user.name,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
