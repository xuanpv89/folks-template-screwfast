import { getAdminSession } from './_admin-session.js';

const GITHUB_API = 'https://api.github.com';
const TARGET_PATH = 'src/data_files/cmsContent.json';

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

function isSafeRepo(value) {
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(String(value || ''));
}

function isSafeBranch(value) {
  return /^[a-zA-Z0-9._/-]+$/.test(String(value || ''));
}

function validateContent(content) {
  const errors = [];
  const pages = Array.isArray(content?.pages) ? content.pages : [];

  if (!pages.length) {
    errors.push('Cần có ít nhất một trang.');
  }

  pages.forEach((page, pageIndex) => {
    const pageName = page.title || `Trang ${pageIndex + 1}`;
    if (!String(page.title || '').trim()) errors.push(`${pageName}: thiếu tên trang.`);
    if (!String(page.path || '').trim().startsWith('/')) {
      errors.push(`${pageName}: đường dẫn trang phải bắt đầu bằng "/".`);
    }

    const sections = Array.isArray(page.sections) ? page.sections : [];
    if (!sections.length) errors.push(`${pageName}: cần có ít nhất một section.`);

    sections.forEach((section, sectionIndex) => {
      const sectionName = section.title || `Section ${sectionIndex + 1}`;
      const fields = Array.isArray(section.fields) ? section.fields : [];
      const keys = new Set();

      if (!String(section.id || '').trim()) errors.push(`${pageName} / ${sectionName}: thiếu mã section.`);
      if (!String(section.title || '').trim()) errors.push(`${pageName} / ${sectionName}: thiếu tên section.`);

      fields.forEach((field, fieldIndex) => {
        const key = String(field.key || '').trim();
        if (!key) {
          errors.push(`${pageName} / ${sectionName}: trường ${fieldIndex + 1} thiếu mã nội dung.`);
        } else if (keys.has(key)) {
          errors.push(`${pageName} / ${sectionName}: mã nội dung "${key}" bị trùng.`);
        }
        keys.add(key);

        if (!String(field.label || '').trim()) {
          errors.push(`${pageName} / ${sectionName}: trường "${key || fieldIndex + 1}" thiếu tên hiển thị.`);
        }
        if (!['text', 'textarea'].includes(field.type)) {
          errors.push(`${pageName} / ${sectionName}: trường "${key || fieldIndex + 1}" có kiểu nội dung không hợp lệ.`);
        }
      });
    });
  });

  return errors;
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
  if (!hookUrl) return null;

  const response = await fetch(hookUrl, { method: 'POST' });
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    job: data?.job || null,
  };
}

export default async function handler(request, response) {
  const adminSecret = process.env.ADMIN_SECRET;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!adminSecret || !githubToken) {
    return sendJson(response, 500, {
      ok: false,
      message: 'Server chưa có ADMIN_SECRET hoặc GITHUB_TOKEN.',
    });
  }

  if (!getAdminSession(request, adminSecret)) {
    return sendJson(response, 401, {
      ok: false,
      message: 'Phiên đăng nhập admin đã hết hạn. Hãy đăng nhập lại.',
    });
  }

  if (request.method === 'GET') {
    const requestUrl = new URL(request.url, 'https://folksteam.com');
    const repo = String(requestUrl.searchParams.get('repo') || process.env.GITHUB_REPO || 'xuanpv89/folksteam.com').trim();
    const branch = String(requestUrl.searchParams.get('branch') || process.env.GITHUB_BRANCH || 'main').trim();

    if (!isSafeRepo(repo) || !isSafeBranch(branch)) {
      return sendJson(response, 400, {
        ok: false,
        message: 'Kho dữ liệu hoặc nhánh dữ liệu không hợp lệ.',
      });
    }

    try {
      const apiPath = encodeURIComponent(TARGET_PATH).replace(/%2F/g, '/');
      const file = await githubRequest(
        `/repos/${repo}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`,
        githubToken
      );
      const json = Buffer.from(file.content || '', 'base64').toString('utf8');

      return sendJson(response, 200, {
        ok: true,
        target: TARGET_PATH,
        repo,
        branch,
        sha: file.sha,
        content: JSON.parse(json),
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
      message: 'Phương thức không được hỗ trợ.',
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

  const repo = String(body.repo || process.env.GITHUB_REPO || 'xuanpv89/folksteam.com').trim();
  const branch = String(body.branch || process.env.GITHUB_BRANCH || 'main').trim();
  const content = body.content;
  const baseSha = String(body.baseSha || '').trim();
  const validationErrors = validateContent(content);

  if (!isSafeRepo(repo) || !isSafeBranch(branch)) {
    return sendJson(response, 400, {
      ok: false,
      message: 'Kho dữ liệu hoặc nhánh dữ liệu không hợp lệ.',
    });
  }

  if (validationErrors.length) {
    return sendJson(response, 400, {
      ok: false,
      message: validationErrors.join(' '),
      validationErrors,
    });
  }

  const apiPath = encodeURIComponent(TARGET_PATH).replace(/%2F/g, '/');
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

  if (sha && !baseSha) {
    return sendJson(response, 409, {
      ok: false,
      code: 'CONTENT_BASE_REQUIRED',
      message:
        'CMS chưa có mốc so sánh với nội dung online hiện tại. Hãy tải lại nội dung online trước khi đăng để tránh ghi đè thay đổi mới.',
      currentSha: sha,
    });
  }

  if (baseSha && sha && baseSha !== sha) {
    return sendJson(response, 409, {
      ok: false,
      code: 'CONTENT_CHANGED',
      message:
        'Nội dung online đã được cập nhật bởi một phiên khác. Hãy tải lại nội dung online trước khi đăng để tránh ghi đè thay đổi mới.',
      currentSha: sha,
      baseSha,
    });
  }

  try {
    const json = JSON.stringify(
      {
        ...content,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const commit = await githubRequest(`/repos/${repo}/contents/${apiPath}`, githubToken, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Update CMS page content',
        content: Buffer.from(json, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    const deployHook = await triggerDeployHook();

    return sendJson(response, 200, {
      ok: true,
      target: TARGET_PATH,
      sha: commit?.content?.sha || sha || null,
      commitSha: commit?.commit?.sha || null,
      commitUrl: commit?.commit?.html_url || null,
      fileUrl: commit?.content?.html_url || null,
      deploy:
        deployHook === null
          ? {
            status: 'github',
              message: 'Đã gửi nội dung mới. Website sẽ tự cập nhật sau khi deploy hoàn tất.',
            }
          : {
              status: deployHook.ok ? 'queued' : 'failed',
              message: deployHook.ok
                ? 'Đã kích hoạt deploy hook.'
                : `Deploy hook trả về HTTP ${deployHook.status}.`,
            },
    });
  } catch (error) {
    return sendJson(response, error.status || 502, {
      ok: false,
      message: error.message,
    });
  }
}
