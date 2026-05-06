import { requireAdminSession } from './_admin-session.js';
import {
  githubRequest,
  isSafeBranch,
  isSafeRepo,
  readJson,
  sendJson,
  targetBranch,
  targetRepo,
} from './_lead-store.js';

export const AUDIT_TARGET_PATH = 'src/data_files/adminAudit.json';
export const SUBSCRIBERS_TARGET_PATH = 'src/data_files/subscribers.json';
export const REVIEW_QUEUE_TARGET_PATH = 'src/data_files/reviewQueue.json';

export function requireAdmin(request, response, options = {}) {
  const adminSecret = process.env.ADMIN_SECRET;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!adminSecret || !githubToken) {
    sendJson(response, 500, {
      ok: false,
      message: 'Server is missing ADMIN_SECRET or GITHUB_TOKEN.',
    });
    return null;
  }

  const session = requireAdminSession(request, adminSecret, {
    csrf: options.csrf ?? request.method !== 'GET',
  });

  if (!session) {
    sendJson(response, 401, {
      ok: false,
      message: 'Admin session is missing or expired. Please sign in again.',
    });
    return null;
  }

  return {
    session,
    token: githubToken,
    repo: targetRepo(),
    branch: targetBranch(),
  };
}

export function assertRepoTarget(repo, branch) {
  if (!isSafeRepo(repo) || !isSafeBranch(branch)) {
    throw new Error('Invalid repository or branch.');
  }
}

export function apiPath(target) {
  return encodeURIComponent(target).replace(/%2F/g, '/');
}

export async function loadJsonFile(token, target, fallback) {
  const repo = targetRepo();
  const branch = targetBranch();
  assertRepoTarget(repo, branch);

  try {
    const file = await githubRequest(
      `/repos/${repo}/contents/${apiPath(target)}?ref=${encodeURIComponent(branch)}`,
      token
    );
    const json = Buffer.from(file.content || '', 'base64').toString('utf8');
    return {
      repo,
      branch,
      sha: file.sha,
      content: JSON.parse(json),
    };
  } catch (error) {
    if (error.status !== 404) throw error;
    return {
      repo,
      branch,
      sha: null,
      content: fallback,
    };
  }
}

export async function saveJsonFile(token, target, content, sha, message) {
  const repo = targetRepo();
  const branch = targetBranch();
  assertRepoTarget(repo, branch);

  const payload = {
    ...content,
    updatedAt: new Date().toISOString(),
  };

  const commit = await githubRequest(`/repos/${repo}/contents/${apiPath(target)}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  return {
    content: payload,
    sha: commit?.content?.sha || sha || null,
    commitSha: commit?.commit?.sha || null,
    commitUrl: commit?.commit?.html_url || null,
  };
}

export async function appendAuditEvent(token, event) {
  const store = await loadJsonFile(token, AUDIT_TARGET_PATH, {
    updatedAt: null,
    events: [],
  });
  const now = new Date().toISOString();
  const nextEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    ...event,
  };
  const events = [nextEvent, ...(Array.isArray(store.content.events) ? store.content.events : [])].slice(0, 1000);
  const saved = await saveJsonFile(
    token,
    AUDIT_TARGET_PATH,
    { ...store.content, events },
    store.sha,
    `Record admin audit event: ${event.type || 'event'}`
  );
  return {
    event: nextEvent,
    ...saved,
  };
}

export async function listTree(token, prefix = '') {
  const repo = targetRepo();
  const branch = targetBranch();
  assertRepoTarget(repo, branch);
  const ref = await githubRequest(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, token);
  const tree = await githubRequest(`/repos/${repo}/git/trees/${ref.object.sha}?recursive=1`, token);
  const items = Array.isArray(tree?.tree) ? tree.tree : [];
  return prefix ? items.filter(item => String(item.path || '').startsWith(prefix)) : items;
}

export async function readTextFile(token, target) {
  const repo = targetRepo();
  const branch = targetBranch();
  assertRepoTarget(repo, branch);
  const file = await githubRequest(
    `/repos/${repo}/contents/${apiPath(target)}?ref=${encodeURIComponent(branch)}`,
    token
  );
  return {
    sha: file.sha,
    content: Buffer.from(file.content || '', 'base64').toString('utf8'),
    htmlUrl: file.html_url || null,
  };
}

export async function saveTextFile(token, target, content, sha, message) {
  const repo = targetRepo();
  const branch = targetBranch();
  assertRepoTarget(repo, branch);
  const commit = await githubRequest(`/repos/${repo}/contents/${apiPath(target)}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  return {
    target,
    sha: commit?.content?.sha || sha || null,
    commitSha: commit?.commit?.sha || null,
    commitUrl: commit?.commit?.html_url || null,
    fileUrl: commit?.content?.html_url || null,
  };
}

export async function deleteFile(token, target, sha, message) {
  const repo = targetRepo();
  const branch = targetBranch();
  assertRepoTarget(repo, branch);
  return githubRequest(`/repos/${repo}/contents/${apiPath(target)}`, token, {
    method: 'DELETE',
    body: JSON.stringify({
      message,
      sha,
      branch,
    }),
  });
}

export { readJson, sendJson };
