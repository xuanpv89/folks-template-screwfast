const GITHUB_API = 'https://api.github.com';
export const LEADS_TARGET_PATH = 'src/data_files/leads.json';

export function sendJson(response, status, body) {
  response.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

export function targetRepo() {
  return String(process.env.GITHUB_REPO || 'xuanpv89/folksteam.com').trim();
}

export function targetBranch() {
  return String(process.env.GITHUB_BRANCH || 'main').trim();
}

export function isSafeRepo(value) {
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(String(value || ''));
}

export function isSafeBranch(value) {
  return /^[a-zA-Z0-9._/-]+$/.test(String(value || ''));
}

export function normalizeLeadStore(content) {
  return {
    updatedAt: content?.updatedAt || null,
    leads: Array.isArray(content?.leads) ? content.leads : [],
  };
}

export async function githubRequest(path, token, options = {}) {
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

export async function loadLeadStore(token) {
  const repo = targetRepo();
  const branch = targetBranch();

  if (!isSafeRepo(repo) || !isSafeBranch(branch)) {
    throw new Error('Invalid repository or branch.');
  }

  const apiPath = encodeURIComponent(LEADS_TARGET_PATH).replace(/%2F/g, '/');

  try {
    const file = await githubRequest(
      `/repos/${repo}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`,
      token
    );
    const json = Buffer.from(file.content || '', 'base64').toString('utf8');
    return {
      repo,
      branch,
      sha: file.sha,
      content: normalizeLeadStore(JSON.parse(json)),
    };
  } catch (error) {
    if (error.status !== 404) throw error;
    return {
      repo,
      branch,
      sha: null,
      content: normalizeLeadStore({ leads: [] }),
    };
  }
}

export async function saveLeadStore(token, content, sha, message) {
  const repo = targetRepo();
  const branch = targetBranch();
  const apiPath = encodeURIComponent(LEADS_TARGET_PATH).replace(/%2F/g, '/');
  const payload = {
    ...normalizeLeadStore(content),
    updatedAt: new Date().toISOString(),
  };

  const commit = await githubRequest(`/repos/${repo}/contents/${apiPath}`, token, {
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
