import { getAdminSession } from './_admin-session.js';
import { githubRequest, loadLeadStore, targetBranch, targetRepo } from './_lead-store.js';
import {
  AUDIT_TARGET_PATH,
  REVIEW_QUEUE_TARGET_PATH,
  SUBSCRIBERS_TARGET_PATH,
  appendAuditEvent,
  deleteFile,
  listTree,
  loadJsonFile,
  readJson,
  readTextFile,
  requireAdmin,
  saveJsonFile,
  saveTextFile,
  sendJson,
} from './_admin-data.js';

const COLLECTIONS = {
  products: { label: 'Products', prefix: 'src/content/products/', extensions: /\.(md|mdx)$/i },
  insights: { label: 'Insights', prefix: 'src/content/insights/', extensions: /\.(md|mdx)$/i },
  docs: { label: 'Docs', prefix: 'src/content/docs/', extensions: /\.(md|mdx)$/i },
  projects: { label: 'Projects', prefix: 'src/pages/projects/', extensions: /\.(astro|md|mdx)$/i },
  caseStudies: { label: 'Case studies', prefix: 'src/pages/case-studies/', extensions: /\.(astro|md|mdx)$/i },
  pages: { label: 'Website pages', prefix: 'src/pages/', extensions: /\.(astro|md|mdx)$/i },
};

const MEDIA_PREFIXES = ['src/images/', 'public/'];
const MEDIA_EXTENSIONS = /\.(avif|gif|ico|jpe?g|png|svg|webp)$/i;
const SUBSCRIBER_STATUSES = new Set(['active', 'unsubscribed', 'bounced', 'spam']);
const REVIEW_STATUSES = new Set(['draft', 'review', 'approved', 'published', 'archived']);

function countByStatus(items, field = 'status') {
  return items.reduce((counts, item) => {
    const key = item?.[field] || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function selectedCollection(value) {
  const key = String(value || '').trim();
  return COLLECTIONS[key] ? { key, ...COLLECTIONS[key] } : null;
}

function isSafeTarget(target, collection) {
  return (
    target.startsWith(collection.prefix) &&
    collection.extensions.test(target) &&
    !target.includes('..') &&
    !target.includes('\\')
  );
}

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

function frontmatterSummary(content) {
  const match = String(content || '').match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const summary = {};
  match[1].split('\n').forEach(line => {
    const separator = line.indexOf(':');
    if (separator < 0) return;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (['title', 'description', 'pubDate', 'category', 'cardImageAlt'].includes(key)) summary[key] = value;
  });
  return summary;
}

function normalizeSubscribers(content) {
  return {
    updatedAt: content?.updatedAt || null,
    subscribers: Array.isArray(content?.subscribers) ? content.subscribers : [],
  };
}

function normalizeReviews(content) {
  return {
    updatedAt: content?.updatedAt || null,
    items: Array.isArray(content?.items) ? content.items : [],
  };
}

async function handleDashboard(admin, response) {
  const [leadStore, subscriberStore, auditStore, reviewStore, tree] = await Promise.all([
    loadLeadStore(admin.token),
    loadJsonFile(admin.token, SUBSCRIBERS_TARGET_PATH, { subscribers: [] }),
    loadJsonFile(admin.token, AUDIT_TARGET_PATH, { events: [] }),
    loadJsonFile(admin.token, REVIEW_QUEUE_TARGET_PATH, { items: [] }),
    listTree(admin.token),
  ]);

  const leads = Array.isArray(leadStore.content.leads) ? leadStore.content.leads : [];
  const subscribers = Array.isArray(subscriberStore.content.subscribers) ? subscriberStore.content.subscribers : [];
  const events = Array.isArray(auditStore.content.events) ? auditStore.content.events : [];
  const reviewItems = Array.isArray(reviewStore.content.items) ? reviewStore.content.items : [];
  const files = tree.filter(item => item.type === 'blob');

  const contentCounts = {
    blog: files.filter(item => item.path.startsWith('src/content/blog/') && /\.mdx?$/.test(item.path)).length,
    products: files.filter(item => item.path.startsWith('src/content/products/') && /\.mdx?$/.test(item.path)).length,
    insights: files.filter(item => item.path.startsWith('src/content/insights/') && /\.mdx?$/.test(item.path)).length,
    docs: files.filter(item => item.path.startsWith('src/content/docs/') && /\.mdx?$/.test(item.path)).length,
    media: files.filter(item => item.path.startsWith('src/images/') && MEDIA_EXTENSIONS.test(item.path)).length,
    adminPages: files.filter(item => item.path.startsWith('public/admin/')).length,
  };

  return sendJson(response, 200, {
    ok: true,
    repo: admin.repo,
    branch: admin.branch,
    metrics: {
      leads: leads.length,
      newLeads: leads.filter(lead => (lead.status || 'new') === 'new').length,
      workingLeads: leads.filter(lead => lead.status === 'working').length,
      subscribers: subscribers.length,
      auditEvents: events.length,
      reviewItems: reviewItems.length,
      pendingReviews: reviewItems.filter(item => ['draft', 'review'].includes(item.status || 'draft')).length,
      contentItems: contentCounts.blog + contentCounts.products + contentCounts.insights,
      mediaItems: contentCounts.media,
    },
    leadStatus: countByStatus(leads),
    subscriberStatus: countByStatus(subscribers, 'status'),
    contentCounts,
    recentLeads: leads
      .slice()
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
      .slice(0, 8),
    recentEvents: events.slice(0, 10),
    updatedAt: new Date().toISOString(),
  });
}

async function handleHealth(request, response) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return sendJson(response, 500, { ok: false, message: 'Server is missing ADMIN_SECRET.' });
  if (!getAdminSession(request, adminSecret)) {
    return sendJson(response, 401, { ok: false, message: 'Admin session is missing or expired.' });
  }

  async function checkGithub(token) {
    if (!token) return { ok: false, status: 'missing', message: 'Missing GITHUB_TOKEN.' };
    try {
      await githubRequest(`/repos/${targetRepo()}`, token);
      return { ok: true, status: 'ready', message: `GitHub token can access ${targetRepo()}.` };
    } catch (error) {
      return { ok: false, status: 'error', message: error.message };
    }
  }

  async function checkVercel(token) {
    if (!token) return { ok: false, status: 'optional', message: 'Missing VERCEL_TOKEN; deploy checks rely on GitHub status.' };
    try {
      const result = await fetch('https://api.vercel.com/v2/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!result.ok) return { ok: false, status: 'error', message: `Vercel API returned HTTP ${result.status}.` };
      return { ok: true, status: 'ready', message: 'Vercel token is valid.' };
    } catch (error) {
      return { ok: false, status: 'error', message: error.message };
    }
  }

  async function checkResend(apiKey) {
    if (!apiKey) return { ok: false, status: 'missing', message: 'Missing RESEND_API_KEY.' };
    try {
      const result = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!result.ok) return { ok: false, status: 'error', message: `Resend API returned HTTP ${result.status}.` };
      return { ok: true, status: 'ready', message: 'Resend API key responds.' };
    } catch (error) {
      return { ok: false, status: 'error', message: error.message };
    }
  }

  const env = {
    ADMIN_SECRET: Boolean(process.env.ADMIN_SECRET),
    ADMIN_USER: Boolean(process.env.ADMIN_USER || process.env.ADMIN_USERS),
    GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN),
    GITHUB_REPO: targetRepo(),
    GITHUB_BRANCH: targetBranch(),
    RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
    CONTACT_TO_EMAIL: Boolean(process.env.CONTACT_TO_EMAIL),
    CONTACT_FROM_EMAIL: Boolean(process.env.CONTACT_FROM_EMAIL),
    VERCEL_TOKEN: Boolean(process.env.VERCEL_TOKEN),
    VERCEL_PROJECT_ID: Boolean(process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME),
    VERCEL_DEPLOY_HOOK_URL: Boolean(process.env.VERCEL_DEPLOY_HOOK_URL),
  };

  const [github, vercel, resend] = await Promise.all([
    checkGithub(process.env.GITHUB_TOKEN),
    checkVercel(process.env.VERCEL_TOKEN),
    checkResend(process.env.RESEND_API_KEY),
  ]);

  return sendJson(response, 200, {
    ok: true,
    env,
    checks: { github, vercel, resend },
    recommendations: [
      !env.RESEND_API_KEY ? 'Add RESEND_API_KEY so contact/newsletter forms can send email.' : null,
      !env.CONTACT_FROM_EMAIL ? 'Set CONTACT_FROM_EMAIL to a verified Resend sender.' : null,
      !env.VERCEL_TOKEN ? 'Add VERCEL_TOKEN and VERCEL_PROJECT_ID for automatic deploy verification.' : null,
      !env.VERCEL_DEPLOY_HOOK_URL ? 'Add VERCEL_DEPLOY_HOOK_URL if GitHub commits do not auto-deploy.' : null,
    ].filter(Boolean),
  });
}

async function handleCollections(request, response, admin, body) {
  const requestUrl = new URL(request.url, 'https://folksteam.com');
  const collection = selectedCollection(body?.collection || requestUrl.searchParams.get('collection') || 'products');
  const target = String(body?.target || requestUrl.searchParams.get('target') || '').trim();

  if (!collection) return sendJson(response, 400, { ok: false, message: 'Invalid collection.' });

  if (request.method === 'GET') {
    if (target) {
      if (!isSafeTarget(target, collection)) return sendJson(response, 400, { ok: false, message: 'Invalid target path.' });
      const file = await readTextFile(admin.token, target);
      return sendJson(response, 200, { ok: true, collection: collection.key, target, ...file, summary: frontmatterSummary(file.content) });
    }

    const tree = await listTree(admin.token, collection.prefix);
    const items = tree
      .filter(item => item.type === 'blob' && collection.extensions.test(item.path))
      .map(item => ({ path: item.path, name: item.path.replace(collection.prefix, ''), size: item.size || 0, sha: item.sha }))
      .sort((left, right) => left.name.localeCompare(right.name));
    return sendJson(response, 200, {
      ok: true,
      collection: collection.key,
      label: collection.label,
      items,
      collections: Object.keys(COLLECTIONS).map(key => ({ key, label: COLLECTIONS[key].label })),
    });
  }

  if (!isSafeTarget(target, collection)) return sendJson(response, 400, { ok: false, message: 'Invalid target path.' });

  if (body.action === 'delete') {
    if (!body.sha) return sendJson(response, 400, { ok: false, message: 'Missing file SHA.' });
    await deleteFile(admin.token, target, String(body.sha), `Delete ${collection.label}: ${target}`);
    await appendAuditEvent(admin.token, { type: 'collection-delete', actor: admin.session.username, target });
    return sendJson(response, 200, { ok: true, target });
  }

  const content = String(body.content || '');
  if (!content.trim()) return sendJson(response, 400, { ok: false, message: 'Content is empty.' });
  const result = await saveTextFile(admin.token, target, content, String(body.sha || '').trim(), `${body.sha ? 'Update' : 'Create'} ${collection.label}: ${target}`);
  await appendAuditEvent(admin.token, {
    type: body.sha ? 'collection-update' : 'collection-create',
    actor: admin.session.username,
    target,
    commitSha: result.commitSha,
    commitUrl: result.commitUrl,
  });
  return sendJson(response, 200, { ok: true, result });
}

async function handleLibrary(request, response, admin, body) {
  if (request.method === 'GET') {
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
  }

  const target = String(body.target || '').trim();
  if (body.action !== 'delete' || !isSafeMediaTarget(target) || !body.sha) {
    return sendJson(response, 400, { ok: false, message: 'Invalid media delete request.' });
  }
  await deleteFile(admin.token, target, String(body.sha), `Delete media: ${target}`);
  await appendAuditEvent(admin.token, { type: 'media-delete', actor: admin.session.username, target });
  return sendJson(response, 200, { ok: true, target });
}

async function handleSubscribers(request, response, admin, body) {
  const store = await loadJsonFile(admin.token, SUBSCRIBERS_TARGET_PATH, { subscribers: [] });
  const content = normalizeSubscribers(store.content);
  if (request.method === 'GET') return sendJson(response, 200, { ok: true, ...content, sha: store.sha });

  const email = String(body.email || '').trim().toLowerCase();
  const id = String(body.id || '').trim();
  const now = new Date().toISOString();

  if (body.action === 'delete') {
    const subscribers = content.subscribers.filter(subscriber => subscriber.id !== id);
    const saved = await saveJsonFile(admin.token, SUBSCRIBERS_TARGET_PATH, { ...content, subscribers }, store.sha, `Delete subscriber: ${id}`);
    await appendAuditEvent(admin.token, { type: 'subscriber-delete', actor: admin.session.username, target: id });
    return sendJson(response, 200, { ok: true, ...saved });
  }

  if (!email || !email.includes('@')) return sendJson(response, 400, { ok: false, message: 'Email is required.' });
  const status = SUBSCRIBER_STATUSES.has(body.status) ? body.status : 'active';
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
  const saved = await saveJsonFile(admin.token, SUBSCRIBERS_TARGET_PATH, { ...content, subscribers }, store.sha, `${existingIndex >= 0 ? 'Update' : 'Create'} subscriber: ${email}`);
  await appendAuditEvent(admin.token, { type: existingIndex >= 0 ? 'subscriber-update' : 'subscriber-create', actor: admin.session.username, target: email });
  return sendJson(response, 200, { ok: true, subscriber: next, ...saved });
}

async function handleAudit(request, response, admin, body) {
  if (request.method === 'GET') {
    const store = await loadJsonFile(admin.token, AUDIT_TARGET_PATH, { events: [] });
    return sendJson(response, 200, { ok: true, events: Array.isArray(store.content.events) ? store.content.events : [], updatedAt: store.content.updatedAt || null, sha: store.sha });
  }

  if (body.action === 'restore-file') {
    const target = String(body.target || '').trim();
    const content = String(body.content || '');
    if (!target || !content) return sendJson(response, 400, { ok: false, message: 'Restore target and content are required.' });
    const result = await saveTextFile(admin.token, target, content, String(body.sha || '').trim(), `Restore file from admin audit: ${target}`);
    await appendAuditEvent(admin.token, { type: 'rollback', actor: admin.session.username, target, commitSha: result.commitSha, commitUrl: result.commitUrl });
    return sendJson(response, 200, { ok: true, result });
  }

  const event = await appendAuditEvent(admin.token, {
    type: String(body.type || 'manual-note').trim(),
    actor: admin.session.username,
    target: String(body.target || '').trim(),
    note: String(body.note || '').trim(),
  });
  return sendJson(response, 200, { ok: true, event: event.event });
}

async function handleReview(request, response, admin, body) {
  const store = await loadJsonFile(admin.token, REVIEW_QUEUE_TARGET_PATH, { items: [] });
  const content = normalizeReviews(store.content);
  if (request.method === 'GET') return sendJson(response, 200, { ok: true, ...content, sha: store.sha });

  const id = String(body.id || '').trim();
  const now = new Date().toISOString();
  if (body.action === 'delete') {
    const items = content.items.filter(item => item.id !== id);
    const saved = await saveJsonFile(admin.token, REVIEW_QUEUE_TARGET_PATH, { ...content, items }, store.sha, `Delete review item: ${id}`);
    await appendAuditEvent(admin.token, { type: 'review-delete', actor: admin.session.username, target: id });
    return sendJson(response, 200, { ok: true, ...saved });
  }

  const status = REVIEW_STATUSES.has(body.status) ? body.status : 'draft';
  const existingIndex = content.items.findIndex(item => item.id === id);
  const existing = existingIndex >= 0 ? content.items[existingIndex] : {};
  const item = {
    id: existing.id || `review-${Date.now()}`,
    title: String(body.title || existing.title || 'Untitled').trim(),
    type: String(body.type || existing.type || 'content').trim(),
    target: String(body.target || existing.target || '').trim(),
    status,
    owner: String(body.owner || existing.owner || '').trim(),
    note: String(body.note || '').trim(),
    createdAt: existing.createdAt || now,
    updatedAt: now,
    history: [
      { status, actor: admin.session.username, note: String(body.note || '').trim(), createdAt: now },
      ...(Array.isArray(existing.history) ? existing.history : []),
    ].slice(0, 50),
  };
  const items = content.items.slice();
  if (existingIndex >= 0) items[existingIndex] = item;
  else items.unshift(item);
  const saved = await saveJsonFile(admin.token, REVIEW_QUEUE_TARGET_PATH, { ...content, items }, store.sha, `${existingIndex >= 0 ? 'Update' : 'Create'} review item: ${item.title}`);
  await appendAuditEvent(admin.token, { type: existingIndex >= 0 ? 'review-update' : 'review-create', actor: admin.session.username, target: item.target || item.title, status });
  return sendJson(response, 200, { ok: true, item, ...saved });
}

export default async function handler(request, response) {
  const requestUrl = new URL(request.url, 'https://folksteam.com');
  const module = String(requestUrl.searchParams.get('module') || '').trim();

  if (request.method !== 'GET' && request.method !== 'POST') {
    return sendJson(response, 405, { ok: false, message: 'Method not allowed.' });
  }

  let body = {};
  if (request.method === 'POST') {
    try {
      body = await readJson(request);
    } catch {
      return sendJson(response, 400, { ok: false, message: 'Invalid JSON body.' });
    }
  }

  if (module === 'health') return handleHealth(request, response);

  const admin = requireAdmin(request, response);
  if (!admin) return;

  try {
    if (module === 'dashboard') return await handleDashboard(admin, response);
    if (module === 'collections') return await handleCollections(request, response, admin, body);
    if (module === 'library') return await handleLibrary(request, response, admin, body);
    if (module === 'subscribers') return await handleSubscribers(request, response, admin, body);
    if (module === 'audit') return await handleAudit(request, response, admin, body);
    if (module === 'review') return await handleReview(request, response, admin, body);
    return sendJson(response, 404, { ok: false, message: 'Unknown admin operations module.' });
  } catch (error) {
    return sendJson(response, error.status || 502, { ok: false, message: error.message });
  }
}
