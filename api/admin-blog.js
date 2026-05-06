import { hasAdminRole, requireAdminSession } from './_admin-session.js';
import { appendAuditEvent } from './_admin-data.js';

const GITHUB_API = 'https://api.github.com';

function sendJson(response, status, body) {
  response.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isSafeRepo(value) {
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(String(value || ''));
}

function isSafeBranch(value) {
  return /^[a-zA-Z0-9._/-]+$/.test(String(value || ''));
}

function targetRepo() {
  return String(process.env.GITHUB_REPO || 'xuanpv89/folksteam.com').trim();
}

function targetBranch() {
  return String(process.env.GITHUB_BRANCH || 'main').trim();
}

function getTargetPath(action, locale, slug) {
  if (!['en', 'vi'].includes(locale)) {
    throw new Error('Invalid locale.');
  }

  if (!slug) {
    throw new Error('Invalid slug.');
  }

  if (action === 'draft') {
    return `src/data_files/blogDrafts/${locale}/${slug}.md`;
  }

  return `src/content/blog/${locale}/${slug}.md`;
}

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.message || `GitHub API error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function triggerDeployHook() {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return null;
  }

  const response = await fetch(hookUrl, { method: 'POST' });
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    job: data?.job || null,
  };
}

function decodeGithubContent(file) {
  return Buffer.from(String(file?.content || '').replace(/\s/g, ''), file?.encoding || 'base64').toString('utf8');
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    return sendJson(response, 405, {
      ok: false,
      message: 'Method not allowed.',
    });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!adminSecret || !githubToken) {
    return sendJson(response, 500, {
      ok: false,
      message: 'Server is missing ADMIN_SECRET or GITHUB_TOKEN.',
    });
  }

  const session = requireAdminSession(request, adminSecret, { csrf: request.method === 'POST' });
  if (!session) {
    return sendJson(response, 401, {
      ok: false,
      message: 'Admin session is missing or expired. Please sign in again.',
    });
  }

  if (request.method === 'GET') {
    const params = new URL(request.url, 'https://admin.local').searchParams;
    const repo = targetRepo();
    const branch = targetBranch();
    const slug = slugify(params.get('slug'));
    const locale = String(params.get('locale') || 'en').trim();

    if (!isSafeRepo(repo) || !isSafeBranch(branch)) {
      return sendJson(response, 400, {
        ok: false,
        message: 'Invalid repository or branch.',
      });
    }

    let target;
    try {
      target = getTargetPath('publish', locale, slug);
    } catch (error) {
      return sendJson(response, 400, {
        ok: false,
        message: error.message,
      });
    }

    const apiPath = encodeURIComponent(target).replace(/%2F/g, '/');
    try {
      const existing = await githubRequest(
        `/repos/${repo}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`,
        githubToken
      );
      return sendJson(response, 200, {
        ok: true,
        exists: true,
        target,
        sha: existing.sha || null,
        fileUrl: existing.html_url || null,
        markdown: decodeGithubContent(existing),
      });
    } catch (error) {
      if (error.status === 404) {
        return sendJson(response, 200, {
          ok: true,
          exists: false,
          target,
          sha: null,
          fileUrl: null,
          markdown: '',
        });
      }
      return sendJson(response, error.status || 502, {
        ok: false,
        message: error.message,
      });
    }
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    return sendJson(response, 400, {
      ok: false,
      message: 'Invalid JSON body.',
    });
  }

  const action = body.action === 'draft' ? 'draft' : 'publish';
  if (action === 'publish' && !hasAdminRole(session, ['publisher'])) {
    return sendJson(response, 403, {
      ok: false,
      message: 'This account can save drafts, but publishing requires publisher or admin access.',
    });
  }
  const repo = targetRepo();
  const branch = targetBranch();
  const slug = slugify(body.slug);
  const locale = String(body.locale || 'en').trim();
  const markdown = String(body.markdown || '');

  if (!isSafeRepo(repo) || !isSafeBranch(branch)) {
    return sendJson(response, 400, {
      ok: false,
      message: 'Invalid repository or branch.',
    });
  }

  if (!markdown.trim()) {
    return sendJson(response, 400, {
      ok: false,
      message: 'Markdown content is empty.',
    });
  }

  let target;
  try {
    target = getTargetPath(action, locale, slug);
  } catch (error) {
    return sendJson(response, 400, {
      ok: false,
      message: error.message,
    });
  }

  const apiPath = encodeURIComponent(target).replace(/%2F/g, '/');
  let sha;

  try {
    const existing = await githubRequest(
      `/repos/${repo}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`,
      githubToken
    );
    sha = existing.sha;
  } catch (error) {
    if (error.status !== 404) {
      return sendJson(response, error.status || 502, {
        ok: false,
        message: error.message,
      });
    }
  }

  if (sha && action === 'publish' && body.allowUpdate !== true) {
    return sendJson(response, 409, {
      ok: false,
      message: 'A post with this slug already exists. Enable update mode or choose another slug.',
      target,
    });
  }

  try {
    const commit = await githubRequest(`/repos/${repo}/contents/${apiPath}`, githubToken, {
      method: 'PUT',
      body: JSON.stringify({
        message:
          action === 'draft'
            ? `${sha ? 'Update' : 'Create'} blog draft: ${slug}`
            : `${sha ? 'Update' : 'Create'} blog post: ${slug}`,
        content: Buffer.from(markdown, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    const deployHook = action === 'publish' ? await triggerDeployHook() : null;

    try {
      await appendAuditEvent(githubToken, {
        type: action === 'draft' ? 'blog-draft' : 'blog-publish',
        actor: requireAdminSession(request, adminSecret)?.username || 'admin',
        target,
        commitSha: commit?.commit?.sha || null,
        commitUrl: commit?.commit?.html_url || null,
      });
    } catch (error) {
      console.error('Could not record blog audit event', error);
    }

    return sendJson(response, 200, {
      ok: true,
      action,
      target,
      commitSha: commit?.commit?.sha || null,
      commitUrl: commit?.commit?.html_url || null,
      fileUrl: commit?.content?.html_url || null,
      deploy:
        deployHook === null
          ? {
              status: 'github',
              message: 'Committed to GitHub. Vercel should deploy from the connected main branch.',
            }
          : {
              status: deployHook.ok ? 'queued' : 'failed',
              message: deployHook.ok
                ? 'Deploy hook was triggered.'
                : `Deploy hook returned HTTP ${deployHook.status}.`,
            },
    });
  } catch (error) {
    return sendJson(response, error.status || 502, {
      ok: false,
      message: error.message,
    });
  }
}
