import { requireAdminSession } from './_admin-session.js';

const GITHUB_API = 'https://api.github.com';

function sendJson(response, status, body) {
  response
    .status(status)
    .setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function targetRepo() {
  return String(process.env.GITHUB_REPO || 'xuanpv89/folksteam.com').trim();
}

function targetBranch() {
  return String(process.env.GITHUB_BRANCH || 'main').trim();
}

async function githubRequest(path, token) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(
      data?.message || `GitHub API error ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function decodeGithubContent(file) {
  return Buffer.from(
    String(file?.content || '').replace(/\s/g, ''),
    file?.encoding || 'base64'
  ).toString('utf8');
}

function frontmatterValue(markdown, key) {
  const match = markdown.match(
    new RegExp(`^${key}:\\s*['"]?([^'"\\n]+)['"]?`, 'm')
  );
  return match?.[1]?.trim() || '';
}

function postUrl(locale, slug) {
  return locale === 'vi' ? `/vi/blog/${slug}/` : `/blog/${slug}/`;
}

async function listMarkdownPosts({ repo, branch, token, locale, status, dir }) {
  const apiDir = encodeURIComponent(dir).replace(/%2F/g, '/');
  let files = [];

  try {
    files = await githubRequest(
      `/repos/${repo}/contents/${apiDir}?ref=${encodeURIComponent(branch)}`,
      token
    );
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }

  return Promise.all(
    files
      .filter(file => file.type === 'file' && file.name.endsWith('.md'))
      .map(async file => {
        const data = await githubRequest(
          `/repos/${repo}/contents/${apiDir}/${encodeURIComponent(file.name)}?ref=${encodeURIComponent(branch)}`,
          token
        );
        const markdown = decodeGithubContent(data);
        const slug = file.name.replace(/\.md$/, '');
        return {
          title: frontmatterValue(markdown, 'title') || slug,
          slug,
          locale,
          status,
          category: frontmatterValue(markdown, 'category') || '',
          savedAt:
            frontmatterValue(markdown, 'pubDate') ||
            data.commit?.committer?.date ||
            '',
          fileUrl: data.html_url || file.html_url || '',
          publicUrl: status === 'Published' ? postUrl(locale, slug) : '',
          source: status === 'Published' ? 'published' : 'cloud-draft',
        };
      })
  );
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
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
      message: 'CMS is not configured for blog listing.',
    });
  }

  const session = requireAdminSession(request, adminSecret);
  if (!session) {
    return sendJson(response, 401, {
      ok: false,
      message: 'Admin session is missing or expired. Please sign in again.',
    });
  }

  const repo = targetRepo();
  const branch = targetBranch();

  try {
    const posts = (
      await Promise.all([
        listMarkdownPosts({
          repo,
          branch,
          token: githubToken,
          locale: 'en',
          status: 'Published',
          dir: 'src/content/blog/en',
        }),
        listMarkdownPosts({
          repo,
          branch,
          token: githubToken,
          locale: 'vi',
          status: 'Published',
          dir: 'src/content/blog/vi',
        }),
        listMarkdownPosts({
          repo,
          branch,
          token: githubToken,
          locale: 'en',
          status: 'Cloud draft',
          dir: 'src/data_files/blogDrafts/en',
        }),
        listMarkdownPosts({
          repo,
          branch,
          token: githubToken,
          locale: 'vi',
          status: 'Cloud draft',
          dir: 'src/data_files/blogDrafts/vi',
        }),
      ])
    ).flat();

    return sendJson(response, 200, {
      ok: true,
      posts,
    });
  } catch (error) {
    return sendJson(response, error.status || 502, {
      ok: false,
      message: error.message,
    });
  }
}
