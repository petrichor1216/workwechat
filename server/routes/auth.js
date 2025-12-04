const express = require('express');
const router = express.Router();
const { db, COLLECTIONS } = require('../database');
const {
  getUserByCode,
  getUserDetail,
  generateToken,
  PERMISSIONS,
  DEFAULT_ADMINS,
  CORP_ID,
  AGENT_ID
} = require('../auth');

const usersCollection = db.collection(COLLECTIONS.USERS);

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
      const { data: users } = await usersCollection
        .where({ userid: userid, is_active: true })
        .get();

      let user;
      if (users.length === 0) {
        // 首次登录，创建用户
        // 默认管理员列表中的用户自动设为管理员，其他用户默认为店员
        const defaultRole = DEFAULT_ADMINS.includes(userid) ? 'admin' : 'staff';
        const now = new Date();
        const userData = {
          userid,
          name: `用户_${userid}`,
          role: defaultRole,
          is_active: true,
          created_at: now,
          updated_at: now
        };
        await usersCollection.add(userData);
        user = userData;
      } else {
        user = users[0];
      }

      // 更新最后登录时间
      await usersCollection
        .where({ userid: userid })
        .update({ last_login_at: new Date() });

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
    const { data: users } = await usersCollection
      .where({ userid: userid, is_active: true })
      .get();

    let user;
    if (users.length === 0) {
      // 首次登录，获取用户详情并创建
      let userDetail = { userid, name: userid };
      try {
        userDetail = await getUserDetail(userid);
      } catch (e) {
        console.error('获取用户详情失败:', e);
      }

      // 默认管理员列表中的用户自动设为管理员，其他用户默认为店员
      const defaultRole = DEFAULT_ADMINS.includes(userid) ? 'admin' : 'staff';
      const now = new Date();
      const userData = {
        userid,
        name: userDetail.name,
        avatar: userDetail.avatar || null,
        role: defaultRole,
        is_active: true,
        created_at: now,
        updated_at: now
      };
      await usersCollection.add(userData);
      user = userData;
    } else {
      user = users[0];
    }

    // 更新最后登录时间
    await usersCollection
      .where({ userid: userid })
      .update({ last_login_at: new Date() });

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

    const { data: users } = await usersCollection
      .where({ userid: req.user.userid, is_active: true })
      .get();

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

    const { data: users } = await usersCollection
      .where({ userid: req.user.userid, is_active: true })
      .get();

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
