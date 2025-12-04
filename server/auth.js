const jwt = require('jsonwebtoken');
const axios = require('axios');

// JWT 密钥（生产环境应使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// 企业微信配置
const CORP_ID = process.env.WECOM_CORP_ID || '';
const AGENT_ID = process.env.WECOM_AGENT_ID || '';
const AGENT_SECRET = process.env.WECOM_AGENT_SECRET || '';

// 缓存 access_token
let accessTokenCache = {
  token: null,
  expiresAt: 0
};

// 获取企业微信 access_token
async function getAccessToken() {
  const now = Date.now();
  if (accessTokenCache.token && accessTokenCache.expiresAt > now) {
    return accessTokenCache.token;
  }

  if (!CORP_ID || !AGENT_SECRET) {
    throw new Error('企业微信配置缺失');
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORP_ID}&corpsecret=${AGENT_SECRET}`;
  const response = await axios.get(url);

  if (response.data.errcode !== 0) {
    throw new Error(`获取 access_token 失败: ${response.data.errmsg}`);
  }

  accessTokenCache = {
    token: response.data.access_token,
    expiresAt: now + (response.data.expires_in - 300) * 1000 // 提前5分钟过期
  };

  return accessTokenCache.token;
}

// 通过 code 获取用户身份
async function getUserByCode(code) {
  const accessToken = await getAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${accessToken}&code=${code}`;
  const response = await axios.get(url);

  if (response.data.errcode !== 0) {
    throw new Error(`获取用户信息失败: ${response.data.errmsg}`);
  }

  return response.data;
}

// 获取用户详细信息
async function getUserDetail(userid) {
  const accessToken = await getAccessToken();
  const url = `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${accessToken}&userid=${userid}`;
  const response = await axios.get(url);

  if (response.data.errcode !== 0) {
    // 用户可能不在通讯录中，返回基本信息
    return { userid, name: userid };
  }

  return {
    userid: response.data.userid,
    name: response.data.name,
    avatar: response.data.avatar
  };
}

// 生成 JWT token
function generateToken(user) {
  return jwt.sign(
    {
      userid: user.userid,
      name: user.name,
      role: user.role,
      avatar: user.avatar
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 验证 JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// 认证中间件
function authMiddleware(req, res, next) {
  // 跳过登录相关接口（注意：中间件挂载在 /api，所以 req.path 不包含 /api 前缀）
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  // 跳过健康检查
  if (req.path === '/health') {
    return next();
  }

  // 开发模式下可以跳过认证
  if (process.env.NODE_ENV !== 'production' && process.env.SKIP_AUTH === 'true') {
    req.user = {
      userid: 'dev_user',
      name: '开发用户',
      role: 'admin'
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: '登录已过期', code: 'TOKEN_EXPIRED' });
  }

  req.user = decoded;
  next();
}

// 权限定义
const PERMISSIONS = {
  // 商品管理
  'product:create': ['admin'],           // 店员只能查看
  'product:update': ['admin'],           // 店员只能查看
  'product:delete': ['admin'],
  'product:view': ['admin', 'staff', 'viewer'],

  // 销售记录
  'sale:create': ['admin', 'staff'],     // 店员可以添加
  'sale:delete': ['admin'],              // 店员不能删除
  'sale:view': ['admin', 'staff', 'viewer'],

  // 库存管理
  'inventory:in': ['admin'],             // 店员只能查看
  'inventory:out': ['admin'],            // 店员只能查看
  'inventory:view': ['admin', 'staff', 'viewer'],

  // 统计数据
  'stats:view': ['admin', 'staff', 'viewer'],

  // 操作日志
  'logs:view': ['admin'],

  // 用户管理
  'user:manage': ['admin']
};

// 默认管理员 userid 列表
const DEFAULT_ADMINS = ['ZengLingFeng', 'Kuan-k', 'HanSenBoYi'];

// 权限检查中间件生成器
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
    }

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      console.warn(`未定义的权限: ${permission}`);
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: '没有操作权限',
        code: 'FORBIDDEN',
        required: permission
      });
    }

    next();
  };
}

// 检查用户是否有某项权限
function hasPermission(role, permission) {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles && allowedRoles.includes(role);
}

module.exports = {
  getAccessToken,
  getUserByCode,
  getUserDetail,
  generateToken,
  verifyToken,
  authMiddleware,
  requirePermission,
  hasPermission,
  PERMISSIONS,
  DEFAULT_ADMINS,
  CORP_ID,
  AGENT_ID
};
