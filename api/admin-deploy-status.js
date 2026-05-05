import { getAdminSession } from './_admin-session.js';

const VERCEL_API = 'https://api.vercel.com';

function sendJson(response, status, body) {
  response.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function isSafeBranch(value) {
  return /^[a-zA-Z0-9._/-]+$/.test(String(value || ''));
}

function isSafeSha(value) {
  return /^[a-f0-9]{7,40}$/i.test(String(value || ''));
}

async function vercelRequest(path, token) {
  const response = await fetch(`${VERCEL_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || `Vercel API error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

function deploymentMessage(deployment) {
  const state = deployment?.readyState || deployment?.state;
  if (state === 'READY') return 'Deploy thành công. Website đã nhận bản mới.';
  if (state === 'ERROR') return deployment?.errorMessage || 'Deploy lỗi. Hãy mở Vercel để xem build log.';
  if (state === 'CANCELED') return 'Deploy đã bị hủy trên Vercel.';
  if (state === 'BUILDING') return 'Vercel đang build bản mới.';
  if (state === 'INITIALIZING' || state === 'QUEUED') return 'Deploy đang chờ Vercel xử lý.';
  return 'Chưa thấy deployment tương ứng trên Vercel. Hệ thống sẽ kiểm tra lại.';
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, {
      ok: false,
      message: 'Method not allowed.',
    });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  const vercelToken = process.env.VERCEL_TOKEN;

  if (!adminSecret) {
    return sendJson(response, 500, {
      ok: false,
      message: 'Server is missing ADMIN_SECRET.',
    });
  }

  if (!getAdminSession(request, adminSecret)) {
    return sendJson(response, 401, {
      ok: false,
      message: 'Admin session is missing or expired. Please sign in again.',
    });
  }

  if (!vercelToken) {
    return sendJson(response, 200, {
      ok: true,
      status: 'unconfigured',
      message: 'Chưa cấu hình VERCEL_TOKEN nên admin chỉ xác nhận được commit GitHub, chưa đọc được status deploy thật.',
    });
  }

  const requestUrl = new URL(request.url, 'https://folksteam.com');
  const commitSha = String(requestUrl.searchParams.get('sha') || '').trim();
  const branch = String(requestUrl.searchParams.get('branch') || process.env.GITHUB_BRANCH || 'main').trim();
  const project = String(
    requestUrl.searchParams.get('project') || process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME || ''
  ).trim();
  const teamId = String(requestUrl.searchParams.get('teamId') || process.env.VERCEL_TEAM_ID || '').trim();
  const slug = String(requestUrl.searchParams.get('slug') || process.env.VERCEL_TEAM_SLUG || '').trim();

  if (!isSafeSha(commitSha)) {
    return sendJson(response, 400, {
      ok: false,
      message: 'Commit SHA không hợp lệ.',
    });
  }

  if (!isSafeBranch(branch)) {
    return sendJson(response, 400, {
      ok: false,
      message: 'Branch không hợp lệ.',
    });
  }

  if (!project) {
    return sendJson(response, 200, {
      ok: true,
      status: 'unconfigured',
      message: 'Chưa cấu hình VERCEL_PROJECT_ID hoặc VERCEL_PROJECT_NAME nên chưa lọc được deployment chính xác.',
    });
  }

  const params = new URLSearchParams({
    limit: '5',
    target: 'production',
    projectId: project,
    sha: commitSha,
    branch,
  });
  if (teamId) params.set('teamId', teamId);
  if (slug) params.set('slug', slug);

  try {
    const data = await vercelRequest(`/v6/deployments?${params.toString()}`, vercelToken);
    const deployment = Array.isArray(data?.deployments) ? data.deployments[0] : null;

    if (!deployment) {
      return sendJson(response, 200, {
        ok: true,
        status: 'pending',
        message: 'Chưa thấy deployment tương ứng trên Vercel. Hệ thống sẽ kiểm tra lại.',
      });
    }

    const status = deployment.readyState || deployment.state || 'UNKNOWN';
    return sendJson(response, 200, {
      ok: true,
      status,
      message: deploymentMessage(deployment),
      deployment: {
        id: deployment.uid || deployment.id || null,
        url: deployment.url ? `https://${deployment.url}` : null,
        inspectorUrl: deployment.inspectorUrl || null,
        createdAt: deployment.createdAt || null,
        buildingAt: deployment.buildingAt || null,
        ready: deployment.ready || null,
        errorCode: deployment.errorCode || null,
        errorMessage: deployment.errorMessage || null,
      },
    });
  } catch (error) {
    return sendJson(response, error.status || 502, {
      ok: false,
      message: error.message,
    });
  }
}
