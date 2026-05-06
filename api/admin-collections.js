import {
  appendAuditEvent,
  deleteFile,
  listTree,
  readJson,
  readTextFile,
  requireAdmin,
  saveTextFile,
  sendJson,
} from './_admin-data.js';

const COLLECTIONS = {
  products: {
    label: 'Products',
    prefix: 'src/content/products/',
    extensions: /\.(md|mdx)$/i,
  },
  insights: {
    label: 'Insights',
    prefix: 'src/content/insights/',
    extensions: /\.(md|mdx)$/i,
  },
  docs: {
    label: 'Docs',
    prefix: 'src/content/docs/',
    extensions: /\.(md|mdx)$/i,
  },
  projects: {
    label: 'Projects',
    prefix: 'src/pages/projects/',
    extensions: /\.(astro|md|mdx)$/i,
  },
  caseStudies: {
    label: 'Case studies',
    prefix: 'src/pages/case-studies/',
    extensions: /\.(astro|md|mdx)$/i,
  },
  pages: {
    label: 'Website pages',
    prefix: 'src/pages/',
    extensions: /\.(astro|md|mdx)$/i,
  },
};

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

function frontmatterSummary(content) {
  const match = String(content || '').match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const summary = {};
  match[1].split('\n').forEach(line => {
    const separator = line.indexOf(':');
    if (separator < 0) return;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (['title', 'description', 'pubDate', 'category', 'cardImageAlt'].includes(key)) {
      summary[key] = value;
    }
  });
  return summary;
}

export default async function handler(request, response) {
  const admin = requireAdmin(request, response);
  if (!admin) return;

  if (request.method === 'GET') {
    const requestUrl = new URL(request.url, 'https://folksteam.com');
    const collection = selectedCollection(requestUrl.searchParams.get('collection') || 'products');
    const target = String(requestUrl.searchParams.get('target') || '').trim();

    if (!collection) {
      return sendJson(response, 400, { ok: false, message: 'Invalid collection.' });
    }

    try {
      if (target) {
        if (!isSafeTarget(target, collection)) {
          return sendJson(response, 400, { ok: false, message: 'Invalid target path.' });
        }
        const file = await readTextFile(admin.token, target);
        return sendJson(response, 200, {
          ok: true,
          collection: collection.key,
          target,
          ...file,
          summary: frontmatterSummary(file.content),
        });
      }

      const tree = await listTree(admin.token, collection.prefix);
      const items = tree
        .filter(item => item.type === 'blob' && collection.extensions.test(item.path))
        .map(item => ({
          path: item.path,
          name: item.path.replace(collection.prefix, ''),
          size: item.size || 0,
          sha: item.sha,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));

      return sendJson(response, 200, {
        ok: true,
        collection: collection.key,
        label: collection.label,
        items,
        collections: Object.keys(COLLECTIONS).map(key => ({ key, label: COLLECTIONS[key].label })),
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

  const collection = selectedCollection(body.collection);
  const target = String(body.target || '').trim();

  if (!collection || !isSafeTarget(target, collection)) {
    return sendJson(response, 400, { ok: false, message: 'Invalid collection or target path.' });
  }

  try {
    if (body.action === 'delete') {
      const sha = String(body.sha || '').trim();
      if (!sha) return sendJson(response, 400, { ok: false, message: 'Missing file SHA.' });
      await deleteFile(admin.token, target, sha, `Delete ${collection.label}: ${target}`);
      await appendAuditEvent(admin.token, {
        type: 'collection-delete',
        actor: admin.session.username,
        target,
      });
      return sendJson(response, 200, { ok: true, target });
    }

    const content = String(body.content || '');
    if (!content.trim()) {
      return sendJson(response, 400, { ok: false, message: 'Content is empty.' });
    }

    const result = await saveTextFile(
      admin.token,
      target,
      content,
      String(body.sha || '').trim(),
      `${body.sha ? 'Update' : 'Create'} ${collection.label}: ${target}`
    );
    await appendAuditEvent(admin.token, {
      type: body.sha ? 'collection-update' : 'collection-create',
      actor: admin.session.username,
      target,
      commitSha: result.commitSha,
      commitUrl: result.commitUrl,
    });
    return sendJson(response, 200, { ok: true, result });
  } catch (error) {
    return sendJson(response, error.status || 502, { ok: false, message: error.message });
  }
}
