import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

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

function createSession(secret, username) {
  const payload = JSON.stringify({
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  });
  const encoded = base64Url(payload);
  return `${encoded}.${sign(encoded, secret)}`;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, {
      ok: false,
      message: 'Method not allowed.',
    });
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return sendJson(response, 400, {
      ok: false,
      message: 'Invalid JSON body.',
    });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || adminSecret;

  if (!adminSecret || !adminPassword) {
    return sendJson(response, 500, {
      ok: false,
      message: 'Admin authentication is not configured.',
    });
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (username !== adminUser || !safeEqual(password, adminPassword)) {
    return sendJson(response, 401, {
      ok: false,
      message: 'Username or password is incorrect.',
    });
  }

  const session = createSession(adminSecret, username);
  const cookie = [
    `folks_admin_session=${session}`,
    'Path=/admin',
    `Max-Age=${SESSION_MAX_AGE}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');

  return sendJson(
    response,
    200,
    {
      ok: true,
      message: 'Signed in.',
    },
    {
      'Set-Cookie': cookie,
    }
  );
}
