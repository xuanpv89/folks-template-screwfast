const RESEND_API_URL = 'https://api.resend.com/emails';
const GITHUB_API = 'https://api.github.com';
const SUBSCRIBERS_TARGET_PATH = 'src/data_files/subscribers.json';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sendJson(response, status, body) {
  response.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function targetRepo() {
  return String(process.env.GITHUB_REPO || 'xuanpv89/folksteam.com').trim();
}

function targetBranch() {
  return String(process.env.GITHUB_BRANCH || 'main').trim();
}

async function githubRequest(path, token, options = {}) {
  const githubResponse = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  const text = await githubResponse.text();
  const data = text ? JSON.parse(text) : null;
  if (!githubResponse.ok) {
    const error = new Error(data?.message || `GitHub API error ${githubResponse.status}`);
    error.status = githubResponse.status;
    throw error;
  }
  return data;
}

async function saveSubscriber(email, source, locale) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return false;

  const repo = targetRepo();
  const branch = targetBranch();
  const apiPath = encodeURIComponent(SUBSCRIBERS_TARGET_PATH).replace(/%2F/g, '/');
  let sha = null;
  let content = { updatedAt: null, subscribers: [] };

  try {
    const file = await githubRequest(`/repos/${repo}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`, token);
    sha = file.sha;
    content = JSON.parse(Buffer.from(file.content || '', 'base64').toString('utf8'));
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const now = new Date().toISOString();
  const subscribers = Array.isArray(content.subscribers) ? content.subscribers.slice() : [];
  const existingIndex = subscribers.findIndex(subscriber => subscriber.email === email.toLowerCase());
  const subscriber = {
    id: existingIndex >= 0 ? subscribers[existingIndex].id : `sub-${Date.now()}`,
    email: email.toLowerCase(),
    status: 'active',
    source,
    locale,
    tags: subscribers[existingIndex]?.tags || [],
    note: subscribers[existingIndex]?.note || '',
    createdAt: subscribers[existingIndex]?.createdAt || now,
    updatedAt: now,
  };
  if (existingIndex >= 0) subscribers[existingIndex] = subscriber;
  else subscribers.unshift(subscriber);

  await githubRequest(`/repos/${repo}/contents/${apiPath}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Capture newsletter signup: ${email}`,
      content: Buffer.from(JSON.stringify({ updatedAt: now, subscribers }, null, 2), 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  return true;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, {
      ok: false,
      message: 'Method not allowed.',
    });
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  const rawBody = Buffer.concat(chunks).toString('utf8');
  const params = new URLSearchParams(rawBody);
  const email = String(params.get('email') || '').trim();
  const source = String(params.get('source') || 'newsletter').trim();
  const locale = String(params.get('locale') || 'en').trim();

  if (!email || !email.includes('@')) {
    return sendJson(response, 400, {
      ok: false,
      message:
        locale === 'vi'
          ? 'Vui long nhap email hop le.'
          : locale === 'zh'
            ? 'Please enter a valid email address.'
            : 'Please enter a valid email address.',
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NEWSLETTER_TO_EMAIL || process.env.CONTACT_TO_EMAIL || 'contact@folksteam.com';
  const fromEmail =
    process.env.CONTACT_FROM_EMAIL ||
    'Folks Team Website <onboarding@resend.dev>';

  let subscriberSaved = false;
  try {
    subscriberSaved = await saveSubscriber(email, source, locale);
  } catch (error) {
    console.error('Could not save newsletter subscriber', error);
  }

  if (!apiKey) {
    return sendJson(response, subscriberSaved ? 200 : 500, {
      ok: subscriberSaved,
      subscriberSaved,
      message:
        locale === 'vi'
          ? subscriberSaved
            ? 'Da luu dang ky. May chu chua cau hinh RESEND_API_KEY de gui email thong bao.'
            : 'May chu chua cau hinh RESEND_API_KEY.'
          : subscriberSaved
            ? 'Subscription saved. Server is missing RESEND_API_KEY for email notification.'
            : 'Server is missing RESEND_API_KEY.',
    });
  }

  const html = `
    <h2>New Folks Team newsletter signup</h2>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><strong>Source</strong></td><td>${escapeHtml(source)}</td></tr>
      <tr><td><strong>Language</strong></td><td>${escapeHtml(locale)}</td></tr>
    </table>
  `;

  const resendResponse = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `New newsletter signup: ${email}`,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    return sendJson(response, 502, {
      ok: false,
      message:
        locale === 'vi'
          ? 'Khong gui duoc dang ky. Vui long kiem tra cau hinh Resend.'
          : 'Newsletter signup could not be sent. Please check the Resend setup.',
      detail,
    });
  }

  return sendJson(response, 200, {
    ok: true,
    subscriberSaved,
    message:
      locale === 'vi'
        ? 'Da dang ky. Cam on ban!'
        : locale === 'zh'
          ? 'Subscribed. Thank you!'
          : 'Subscribed. Thank you!',
  });
}
