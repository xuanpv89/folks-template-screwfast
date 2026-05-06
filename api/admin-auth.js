import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getAdminSession } from './_admin-session.js';

const DEFAULT_SESSION_DAYS = 7;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

function sendJson(response, status, body, headers = {}) {
  response.status(status);
  Object.entries(headers).forEach(([key, value]) => response.setHeader(key, value));
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function createSession(secret, user) {
  const maxAge = getSessionMaxAge();
  const csrf = randomBytes(32).toString('base64url');
  const username = typeof user === 'string' ? user : user.username;
  const role = typeof user === 'string' ? (username === 'admin' ? 'admin' : 'editor') : user.role || 'editor';
  const payload = JSON.stringify({
    username,
    role,
    csrf,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  });
  const encoded = base64Url(payload);
  return {
    token: `${encoded}.${sign(encoded, secret)}`,
    csrf,
    maxAge,
  };
}

function getSessionMaxAge() {
  const days = Number(process.env.ADMIN_SESSION_DAYS || DEFAULT_SESSION_DAYS);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 30) : DEFAULT_SESSION_DAYS;
  return Math.round(safeDays * 24 * 60 * 60);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getAdminUsers(adminSecret) {
  const configuredUsers = process.env.ADMIN_USERS;
  if (configuredUsers) {
    try {
      const users = JSON.parse(configuredUsers);
      if (Array.isArray(users)) {
        return users
          .map(user => ({
            username: String(user.username || '').trim(),
            password: String(user.password || ''),
            role: String(user.role || (user.username === 'admin' ? 'admin' : 'editor')).trim(),
          }))
          .filter(user => user.username && user.password);
      }
    } catch {
      return [];
    }
  }

  return [
    {
      username: process.env.ADMIN_USER || 'admin',
      password: process.env.ADMIN_PASSWORD || adminSecret,
      role: 'admin',
    },
  ];
}

function clientIp(request) {
  return String(
    request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      request.socket?.remoteAddress ||
      'unknown'
  )
    .split(',')[0]
    .trim();
}

function loginKey(request, username) {
  return `${clientIp(request)}:${String(username || '').toLowerCase()}`;
}

function loginState(key) {
  const now = Date.now();
  const state = loginAttempts.get(key);
  if (!state || now - state.firstAt > LOGIN_WINDOW_MS) {
    return { count: 0, firstAt: now, lockedUntil: 0 };
  }
  return state;
}

function isLocked(key) {
  return loginState(key).lockedUntil > Date.now();
}

function recordFailedLogin(key) {
  const now = Date.now();
  const state = loginState(key);
  const count = state.count + 1;
  loginAttempts.set(key, {
    count,
    firstAt: state.firstAt,
    lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? now + LOCKOUT_MS : state.lockedUntil,
  });
}

function clearFailedLogin(key) {
  loginAttempts.delete(key);
}

export default async function handler(request, response) {
  if (request.method === 'GET') {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      return sendJson(response, 500, {
        ok: false,
        message: 'Admin is not configured.',
      });
    }

    const session = getAdminSession(request, adminSecret);
    if (!session) {
      return sendJson(response, 401, {
        ok: false,
        message: 'Admin session is missing or expired. Please sign in again.',
      });
    }

    return sendJson(response, 200, {
      ok: true,
      username: session.username || '',
      role: session.role || 'editor',
      exp: session.exp || 0,
    });
  }

  if (request.method !== 'POST') {
    return sendJson(response, 405, {
      ok: false,
      message: 'Phương thức không được hỗ trợ.',
    });
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return sendJson(response, 400, {
      ok: false,
      message: 'Dữ liệu gửi lên không hợp lệ.',
    });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  const adminUsers = getAdminUsers(adminSecret);

  if (!adminSecret || !adminUsers.length) {
    return sendJson(response, 500, {
      ok: false,
      message: 'Admin chưa được cấu hình.',
    });
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const user = adminUsers.find(candidate => candidate.username === username);
  const key = loginKey(request, username);

  if (isLocked(key)) {
    return sendJson(response, 429, {
      ok: false,
      message: 'Tài khoản đang bị tạm khóa vì đăng nhập sai quá nhiều lần. Hãy thử lại sau ít phút.',
    });
  }

  if (!user || !safeEqual(password, user.password)) {
    recordFailedLogin(key);
    return sendJson(response, 401, {
      ok: false,
      message: 'Sai tên đăng nhập hoặc mật khẩu.',
    });
  }

  clearFailedLogin(key);
  const session = createSession(adminSecret, user);
  const sessionCookie = [
    `folks_admin_session=${session.token}`,
    'Path=/',
    `Max-Age=${session.maxAge}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
  const csrfCookie = [
    `folks_admin_csrf=${encodeURIComponent(session.csrf)}`,
    'Path=/',
    `Max-Age=${session.maxAge}`,
    'Secure',
    'SameSite=Lax',
  ].join('; ');

  return sendJson(
    response,
    200,
    {
      ok: true,
      message: 'Đã đăng nhập.',
    },
    {
      'Set-Cookie': [sessionCookie, csrfCookie],
    }
  );
}
