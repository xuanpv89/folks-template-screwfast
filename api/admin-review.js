import {
  REVIEW_QUEUE_TARGET_PATH,
  appendAuditEvent,
  loadJsonFile,
  readJson,
  requireAdmin,
  saveJsonFile,
  sendJson,
} from './_admin-data.js';

const STATUSES = new Set(['draft', 'review', 'approved', 'published', 'archived']);

function normalizeStore(content) {
  return {
    updatedAt: content?.updatedAt || null,
    items: Array.isArray(content?.items) ? content.items : [],
  };
}

export default async function handler(request, response) {
  const admin = requireAdmin(request, response);
  if (!admin) return;

  if (request.method === 'GET') {
    try {
      const store = await loadJsonFile(admin.token, REVIEW_QUEUE_TARGET_PATH, { items: [] });
      return sendJson(response, 200, {
        ok: true,
        ...normalizeStore(store.content),
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
    const store = await loadJsonFile(admin.token, REVIEW_QUEUE_TARGET_PATH, { items: [] });
    const content = normalizeStore(store.content);
    const id = String(body.id || '').trim();
    const now = new Date().toISOString();

    if (body.action === 'delete') {
      const items = content.items.filter(item => item.id !== id);
      const saved = await saveJsonFile(admin.token, REVIEW_QUEUE_TARGET_PATH, { ...content, items }, store.sha, `Delete review item: ${id}`);
      await appendAuditEvent(admin.token, {
        type: 'review-delete',
        actor: admin.session.username,
        target: id,
      });
      return sendJson(response, 200, { ok: true, ...saved });
    }

    const status = STATUSES.has(body.status) ? body.status : 'draft';
    const existingIndex = content.items.findIndex(item => item.id === id);
    const item = {
      id: existingIndex >= 0 ? content.items[existingIndex].id : `review-${Date.now()}`,
      title: String(body.title || content.items[existingIndex]?.title || 'Untitled').trim(),
      type: String(body.type || content.items[existingIndex]?.type || 'content').trim(),
      target: String(body.target || content.items[existingIndex]?.target || '').trim(),
      status,
      owner: String(body.owner || content.items[existingIndex]?.owner || '').trim(),
      note: String(body.note || '').trim(),
      createdAt: content.items[existingIndex]?.createdAt || now,
      updatedAt: now,
      history: [
        {
          status,
          actor: admin.session.username,
          note: String(body.note || '').trim(),
          createdAt: now,
        },
        ...(Array.isArray(content.items[existingIndex]?.history) ? content.items[existingIndex].history : []),
      ].slice(0, 50),
    };

    const items = content.items.slice();
    if (existingIndex >= 0) items[existingIndex] = item;
    else items.unshift(item);

    const saved = await saveJsonFile(
      admin.token,
      REVIEW_QUEUE_TARGET_PATH,
      { ...content, items },
      store.sha,
      `${existingIndex >= 0 ? 'Update' : 'Create'} review item: ${item.title}`
    );
    await appendAuditEvent(admin.token, {
      type: existingIndex >= 0 ? 'review-update' : 'review-create',
      actor: admin.session.username,
      target: item.target || item.title,
      status,
    });

    return sendJson(response, 200, { ok: true, item, ...saved });
  } catch (error) {
    return sendJson(response, error.status || 502, { ok: false, message: error.message });
  }
}
