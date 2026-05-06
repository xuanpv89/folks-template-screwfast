export const config = {
  matcher: '/admin/:path*',
};

const SESSION_COOKIE = 'folks_admin_session';

function redirectToLogin(request) {
  const url = new URL('/admin/login.html', request.url);
  url.searchParams.set('next', request.nextUrl?.pathname || new URL(request.url).pathname);
  return Response.redirect(url);
}

function getCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function isValidSession(token, secret) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) {
    return false;
  }

  const expected = await sign(payload, secret);
  if (expected !== signature) {
    return false;
  }

  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    return Number(data.exp || 0) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export default async function middleware(request) {
  const pathname = request.nextUrl?.pathname || new URL(request.url).pathname;

  if (
    pathname === '/admin/login.html' ||
    pathname === '/admin/admin-ui.css' ||
    pathname === '/admin/admin-session.js'
  ) {
    return undefined;
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return new Response('Admin authentication is not configured.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const session = getCookie(request, SESSION_COOKIE);
  if (!(await isValidSession(session, adminSecret))) {
    return redirectToLogin(request);
  }

  return undefined;
}
