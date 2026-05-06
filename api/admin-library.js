import {
  appendAuditEvent,
  deleteFile,
  listTree,
  readJson,
  requireAdmin,
  sendJson,
} from './_admin-data.js';

const MEDIA_PREFIXES = ['src/images/', 'public/'];
const MEDIA_EXTENSIONS = /\.(avif|gif|ico|jpe?g|png|svg|webp)$/i;

function isSafeMediaTarget(target) {
  return (
    MEDIA_PREFIXES.some(prefix => target.startsWith(prefix)) &&
    MEDIA_EXTENSIONS.test(target) &&
    !target.includes('..') &&
    !target.includes('\\')
  );
}

function publicPath(path) {
  if (path.startsWith('public/')) return `/${path.slice('public/'.length)}`;
  if (path.startsWith('src/images/')) return `@/images/${path.slice('src/images/'.length)}`;
  return path;
}

export default async function handler(request, response) {
  const admin = requireAdmin(request, response);
  if (!admin) return;

  if (request.method === 'GET') {
    try {
      const tree = await listTree(admin.token);
      const items = tree
        .filter(item => item.type === 'blob' && isSafeMediaTarget(item.path))
        .map(item => ({
          path: item.path,
          displayPath: publicPath(item.path),
          name: item.path.split('/').pop(),
          folder: item.path.split('/').slice(0, -1).join('/'),
          size: item.size || 0,
          sha: item.sha,
          rawUrl: `https://raw.githubusercontent.com/${admin.repo}/${admin.branch}/${item.path}`,
        }))
        .sort((left, right) => right.path.localeCompare(left.path));

      return sendJson(response, 200, { ok: true, items });
    } catch (error) {
      return sendJson(response, error.status || 502, { ok: false, message: error.message });
    }
  }

  if (request.method !== 'POST') {
    return sendJson(response, 405, { ok: false, message: 'Method not allowed.' });
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return sendJson(response, 400, { ok: false, message: 'Invalid JSON body.' });
  }

  const target = String(body.target || '').trim();
  if (body.action !== 'delete' || !isSafeMediaTarget(target) || !body.sha) {
    return sendJson(response, 400, { ok: false, message: 'Invalid media delete request.' });
  }

  try {
    await deleteFile(admin.token, target, String(body.sha), `Delete media: ${target}`);
    await appendAuditEvent(admin.token, {
      type: 'media-delete',
      actor: admin.session.username,
      target,
    });
    return sendJson(response, 200, { ok: true, target });
  } catch (error) {
    return sendJson(response, error.status || 502, { ok: false, message: error.message });
  }
}
