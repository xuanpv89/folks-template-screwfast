export const config = {
  matcher: '/admin/:path*',
};

function unauthorized(message = 'Authentication required.') {
  return new Response(message, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Folks Team CMS"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function decodeBasicAuth(value) {
  if (!value?.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = atob(value.slice(6));
    const separator = decoded.indexOf(':');
    if (separator < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export default function middleware(request) {
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET;
  const adminUser = process.env.ADMIN_USER || 'admin';

  if (!adminPassword) {
    return new Response('Admin authentication is not configured.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const credentials = decodeBasicAuth(request.headers.get('authorization'));
  if (!credentials) {
    return unauthorized();
  }

  if (credentials.username !== adminUser || credentials.password !== adminPassword) {
    return unauthorized('Invalid admin credentials.');
  }

  return undefined;
}
