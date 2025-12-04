const express = require('express');
const router = express.Router();
const { generateToken, PERMISSIONS } = require('../auth');

// 管理员密码
const ADMIN_PASSWORD = 'march8';

// 简化登录 - 管理员（需要密码）
router.post('/login/admin', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: '请输入密码' });
    }

    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 创建管理员用户对象
    const user = {
      userid: 'admin',
      name: '管理员',
      role: 'admin',
      is_active: true
    };

    const token = generateToken(user);
    res.json({
      token,
      user: {
        userid: user.userid,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('管理员登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 简化登录 - 店员（无需密码）
router.post('/login/staff', async (req, res) => {
  try {
    // 创建店员用户对象
    const user = {
      userid: 'staff',
      name: '店员',
      role: 'staff',
      is_active: true
    };

    const token = generateToken(user);
    res.json({
      token,
      user: {
        userid: user.userid,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('店员登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '未登录' });
    }

    // 计算用户权限列表
    const permissions = {};
    for (const [perm, roles] of Object.entries(PERMISSIONS)) {
      permissions[perm] = roles.includes(req.user.role);
    }

    res.json({
      userid: req.user.userid,
      name: req.user.name,
      role: req.user.role,
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

    const token = generateToken(req.user);
    res.json({
      token,
      user: {
        userid: req.user.userid,
        name: req.user.name,
        role: req.user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
