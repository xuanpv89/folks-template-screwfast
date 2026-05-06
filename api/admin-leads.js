import { requireAdminSession } from './_admin-session.js';
import { appendAuditEvent } from './_admin-data.js';
import { loadLeadStore, readJson, saveLeadStore, sendJson } from './_lead-store.js';

const STATUSES = new Set(['new', 'contacted', 'working', 'done', 'ignored']);

function leadLabel(lead) {
  return lead.name || lead.email || lead.id || 'lead';
}

export default async function handler(request, response) {
  const adminSecret = process.env.ADMIN_SECRET;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!adminSecret || !githubToken) {
    return sendJson(response, 500, {
      ok: false,
      message: 'Server is missing ADMIN_SECRET or GITHUB_TOKEN.',
    });
  }

  if (!requireAdminSession(request, adminSecret, { csrf: request.method !== 'GET' })) {
    return sendJson(response, 401, {
      ok: false,
      message: 'Phiên đăng nhập admin đã hết hạn. Hãy đăng nhập lại.',
    });
  }

  if (request.method === 'GET') {
    try {
      const store = await loadLeadStore(githubToken);
      const leads = store.content.leads
        .slice()
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));

      return sendJson(response, 200, {
        ok: true,
        leads,
        updatedAt: store.content.updatedAt,
        sha: store.sha,
      });
    } catch (error) {
      return sendJson(response, error.status || 502, {
        ok: false,
        message: error.message,
      });
    }
  }

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
      message: 'Dữ liệu gửi lên không hợp lệ.',
    });
  }

  const id = String(body.id || '').trim();
  const status = String(body.status || '').trim();
  const note = String(body.note || '').trim();
  const owner = String(body.owner || '').trim();

  if (!id) {
    return sendJson(response, 400, {
      ok: false,
      message: 'Thiếu lead cần cập nhật.',
    });
  }

  if (status && !STATUSES.has(status)) {
    return sendJson(response, 400, {
      ok: false,
      message: 'Trạng thái lead không hợp lệ.',
    });
  }

  try {
    const store = await loadLeadStore(githubToken);
    const leads = store.content.leads.slice();
    const index = leads.findIndex(lead => lead.id === id);

    if (index < 0) {
      return sendJson(response, 404, {
        ok: false,
        message: 'Không tìm thấy lead này.',
      });
    }

    const now = new Date().toISOString();
    const current = leads[index];
    const next = {
      ...current,
      status: status || current.status || 'new',
      owner: owner || current.owner || '',
      updatedAt: now,
      notes: Array.isArray(current.notes) ? current.notes.slice() : [],
      events: Array.isArray(current.events) ? current.events.slice() : [],
    };

    if (note) {
      next.notes.unshift({
        id: `note-${Date.now()}`,
        body: note,
        createdAt: now,
      });
    }

    next.events.unshift({
      type: 'admin-update',
      status: next.status,
      note: note ? 'added' : '',
      createdAt: now,
    });

    leads[index] = next;

    const saved = await saveLeadStore(
      githubToken,
      { ...store.content, leads },
      store.sha,
      `Update lead: ${leadLabel(next)}`
    );

    try {
      await appendAuditEvent(githubToken, {
        type: 'lead-update',
        actor: requireAdminSession(request, adminSecret)?.username || 'admin',
        target: id,
        status: next.status,
        commitSha: saved.commitSha,
        commitUrl: saved.commitUrl,
      });
    } catch (error) {
      console.error('Could not record lead audit event', error);
    }

    return sendJson(response, 200, {
      ok: true,
      lead: next,
      updatedAt: saved.content.updatedAt,
      commitSha: saved.commitSha,
      commitUrl: saved.commitUrl,
    });
  } catch (error) {
    return sendJson(response, error.status || 502, {
      ok: false,
      message: error.message,
    });
  }
}
