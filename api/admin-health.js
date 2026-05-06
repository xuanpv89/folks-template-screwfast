import { getAdminSession } from './_admin-session.js';
import { githubRequest, sendJson, targetBranch, targetRepo } from './_lead-store.js';

async function checkGithub(token) {
  if (!token) return { ok: false, status: 'missing', message: 'Missing GITHUB_TOKEN.' };
  try {
    const repo = targetRepo();
    await githubRequest(`/repos/${repo}`, token);
    return { ok: true, status: 'ready', message: `GitHub token can access ${repo}.` };
  } catch (error) {
    return { ok: false, status: 'error', message: error.message };
  }
}

async function checkVercel(token) {
  if (!token) return { ok: false, status: 'optional', message: 'Missing VERCEL_TOKEN, deploy status checks are limited.' };
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

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { ok: false, message: 'Method not allowed.' });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return sendJson(response, 500, { ok: false, message: 'Server is missing ADMIN_SECRET.' });
  }

  if (!getAdminSession(request, adminSecret)) {
    return sendJson(response, 401, { ok: false, message: 'Admin session is missing or expired.' });
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
