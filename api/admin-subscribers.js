import {
  SUBSCRIBERS_TARGET_PATH,
  appendAuditEvent,
  loadJsonFile,
  readJson,
  requireAdmin,
  saveJsonFile,
  sendJson,
} from './_admin-data.js';

const STATUSES = new Set(['active', 'unsubscribed', 'bounced', 'spam']);

function normalizeStore(content) {
  return {
    updatedAt: content?.updatedAt || null,
    subscribers: Array.isArray(content?.subscribers) ? content.subscribers : [],
  };
}

export default async function handler(request, response) {
  const admin = requireAdmin(request, response);
  if (!admin) return;

  if (request.method === 'GET') {
    try {
      const store = await loadJsonFile(admin.token, SUBSCRIBERS_TARGET_PATH, { subscribers: [] });
      const content = normalizeStore(store.content);
      return sendJson(response, 200, {
        ok: true,
        ...content,
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
    const store = await loadJsonFile(admin.token, SUBSCRIBERS_TARGET_PATH, { subscribers: [] });
    const content = normalizeStore(store.content);
    const email = String(body.email || '').trim().toLowerCase();
    const id = String(body.id || '').trim();
    const now = new Date().toISOString();

    if (body.action === 'delete') {
      const subscribers = content.subscribers.filter(subscriber => subscriber.id !== id);
      const saved = await saveJsonFile(
        admin.token,
        SUBSCRIBERS_TARGET_PATH,
        { ...content, subscribers },
        store.sha,
        `Delete subscriber: ${id}`
      );
      await appendAuditEvent(admin.token, {
        type: 'subscriber-delete',
        actor: admin.session.username,
        target: id,
      });
      return sendJson(response, 200, { ok: true, ...saved });
    }

    if (!email || !email.includes('@')) {
      return sendJson(response, 400, { ok: false, message: 'Email is required.' });
    }

    const status = STATUSES.has(body.status) ? body.status : 'active';
    const existingIndex = content.subscribers.findIndex(subscriber => subscriber.email === email || subscriber.id === id);
    const next = {
      id: existingIndex >= 0 ? content.subscribers[existingIndex].id : `sub-${Date.now()}`,
      email,
      status,
      locale: String(body.locale || content.subscribers[existingIndex]?.locale || 'en').trim(),
      source: String(body.source || content.subscribers[existingIndex]?.source || 'admin').trim(),
      tags: Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
      note: String(body.note || '').trim(),
      createdAt: content.subscribers[existingIndex]?.createdAt || now,
      updatedAt: now,
    };

    const subscribers = content.subscribers.slice();
    if (existingIndex >= 0) subscribers[existingIndex] = next;
    else subscribers.unshift(next);

    const saved = await saveJsonFile(
      admin.token,
      SUBSCRIBERS_TARGET_PATH,
      { ...content, subscribers },
      store.sha,
      `${existingIndex >= 0 ? 'Update' : 'Create'} subscriber: ${email}`
    );
    await appendAuditEvent(admin.token, {
      type: existingIndex >= 0 ? 'subscriber-update' : 'subscriber-create',
      actor: admin.session.username,
      target: email,
    });

    return sendJson(response, 200, { ok: true, subscriber: next, ...saved });
  } catch (error) {
    return sendJson(response, error.status || 502, { ok: false, message: error.message });
  }
}
