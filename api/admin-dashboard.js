import { loadLeadStore, sendJson } from './_lead-store.js';
import {
  AUDIT_TARGET_PATH,
  REVIEW_QUEUE_TARGET_PATH,
  SUBSCRIBERS_TARGET_PATH,
  listTree,
  loadJsonFile,
  requireAdmin,
} from './_admin-data.js';

function countByStatus(items, field = 'status') {
  return items.reduce((counts, item) => {
    const key = item?.[field] || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { ok: false, message: 'Method not allowed.' });
  }

  const admin = requireAdmin(request, response, { csrf: false });
  if (!admin) return;

  try {
    const [leadStore, subscriberStore, auditStore, reviewStore, tree] = await Promise.all([
      loadLeadStore(admin.token),
      loadJsonFile(admin.token, SUBSCRIBERS_TARGET_PATH, { subscribers: [] }),
      loadJsonFile(admin.token, AUDIT_TARGET_PATH, { events: [] }),
      loadJsonFile(admin.token, REVIEW_QUEUE_TARGET_PATH, { items: [] }),
      listTree(admin.token),
    ]);

    const leads = Array.isArray(leadStore.content.leads) ? leadStore.content.leads : [];
    const subscribers = Array.isArray(subscriberStore.content.subscribers)
      ? subscriberStore.content.subscribers
      : [];
    const events = Array.isArray(auditStore.content.events) ? auditStore.content.events : [];
    const reviewItems = Array.isArray(reviewStore.content.items) ? reviewStore.content.items : [];
    const files = tree.filter(item => item.type === 'blob');

    const contentCounts = {
      blog: files.filter(item => item.path.startsWith('src/content/blog/') && /\.mdx?$/.test(item.path)).length,
      products: files.filter(item => item.path.startsWith('src/content/products/') && /\.mdx?$/.test(item.path)).length,
      insights: files.filter(item => item.path.startsWith('src/content/insights/') && /\.mdx?$/.test(item.path)).length,
      docs: files.filter(item => item.path.startsWith('src/content/docs/') && /\.mdx?$/.test(item.path)).length,
      media: files.filter(item => item.path.startsWith('src/images/') && /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(item.path)).length,
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
  } catch (error) {
    return sendJson(response, error.status || 502, {
      ok: false,
      message: error.message,
    });
  }
}
