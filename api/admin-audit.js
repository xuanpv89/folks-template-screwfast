import {
  AUDIT_TARGET_PATH,
  appendAuditEvent,
  loadJsonFile,
  readJson,
  requireAdmin,
  saveTextFile,
  sendJson,
} from './_admin-data.js';

export default async function handler(request, response) {
  const admin = requireAdmin(request, response);
  if (!admin) return;

  if (request.method === 'GET') {
    try {
      const store = await loadJsonFile(admin.token, AUDIT_TARGET_PATH, { events: [] });
      return sendJson(response, 200, {
        ok: true,
        events: Array.isArray(store.content.events) ? store.content.events : [],
        updatedAt: store.content.updatedAt || null,
        sha: store.sha,
      });
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

  try {
    if (body.action === 'restore-file') {
      const target = String(body.target || '').trim();
      const content = String(body.content || '');
      const sha = String(body.sha || '').trim();
      if (!target || !content) {
        return sendJson(response, 400, { ok: false, message: 'Restore target and content are required.' });
      }
      const result = await saveTextFile(admin.token, target, content, sha, `Restore file from admin audit: ${target}`);
      await appendAuditEvent(admin.token, {
        type: 'rollback',
        actor: admin.session.username,
        target,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
      });
      return sendJson(response, 200, { ok: true, result });
    }

    const event = await appendAuditEvent(admin.token, {
      type: String(body.type || 'manual-note').trim(),
      actor: admin.session.username,
      target: String(body.target || '').trim(),
      note: String(body.note || '').trim(),
    });
    return sendJson(response, 200, { ok: true, event: event.event });
  } catch (error) {
    return sendJson(response, error.status || 502, { ok: false, message: error.message });
  }
}
