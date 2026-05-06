const RESEND_API_URL = 'https://api.resend.com/emails';
const GITHUB_API = 'https://api.github.com';
const LEADS_TARGET_PATH = 'src/data_files/leads.json';

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

function isSafeRepo(value) {
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(String(value || ''));
}

function isSafeBranch(value) {
  return /^[a-zA-Z0-9._/-]+$/.test(String(value || ''));
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

function normalizeLeadStore(content) {
  return {
    updatedAt: content?.updatedAt || null,
    leads: Array.isArray(content?.leads) ? content.leads : [],
  };
}

async function loadLeadStore(token) {
  const repo = targetRepo();
  const branch = targetBranch();
  if (!isSafeRepo(repo) || !isSafeBranch(branch)) throw new Error('Invalid repository or branch.');

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

async function saveLeadSubmission(lead) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const store = await loadLeadStore(token);
  const nextContent = {
    ...store.content,
    updatedAt: new Date().toISOString(),
    leads: [lead, ...store.content.leads].slice(0, 500),
  };
  const apiPath = encodeURIComponent(LEADS_TARGET_PATH).replace(/%2F/g, '/');
  const commit = await githubRequest(`/repos/${store.repo}/contents/${apiPath}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Capture contact lead: ${lead.name || lead.email}`,
      content: Buffer.from(JSON.stringify(nextContent, null, 2), 'utf8').toString('base64'),
      branch: store.branch,
      ...(store.sha ? { sha: store.sha } : {}),
    }),
  });

  return {
    sha: commit?.content?.sha || null,
    commitSha: commit?.commit?.sha || null,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, {
      ok: false,
      message: 'Method not allowed.',
    });
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  const params = new URLSearchParams(rawBody);
  const firstName = String(params.get('first_name') || '').trim();
  const lastName = String(params.get('last_name') || '').trim();
  const email = String(params.get('email') || '').trim();
  const phone = String(params.get('phone') || '').trim();
  const message = String(params.get('message') || '').trim();
  const locale = String(params.get('locale') || 'en').trim();

  if (!firstName || !email || !message) {
    return sendJson(response, 400, {
      ok: false,
      message:
        locale === 'vi'
          ? 'Vui lòng điền tên, email và nội dung.'
          : 'Please fill in your name, email, and message.',
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL || 'contact@folksteam.com';
  const fromEmail =
    process.env.CONTACT_FROM_EMAIL ||
    'Folks Team Website <onboarding@resend.dev>';

  if (!apiKey) {
    return sendJson(response, 500, {
      ok: false,
      message:
        locale === 'vi'
          ? 'Máy chủ chưa cấu hình RESEND_API_KEY.'
          : 'Server is missing RESEND_API_KEY.',
    });
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const now = new Date().toISOString();
  const referer = String(request.headers.referer || request.headers.referrer || '').trim();
  const lead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
    status: 'new',
    priority: 'normal',
    source: 'contact-form',
    locale,
    page: referer,
    name: fullName,
    firstName,
    lastName,
    email,
    phone,
    message,
    owner: '',
    notes: [],
    events: [
      {
        type: 'submitted',
        createdAt: now,
      },
    ],
  };
  const subject = `New contact form submission from ${fullName}`;
  const html = `
    <h2>New Folks Team contact form submission</h2>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone || '-')}</td></tr>
      <tr><td><strong>Language</strong></td><td>${escapeHtml(locale)}</td></tr>
    </table>
    <h3>Message</h3>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
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
      subject,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    return sendJson(response, 502, {
      ok: false,
      message:
        locale === 'vi'
          ? 'Không gửi được email. Vui lòng kiểm tra cấu hình Resend.'
          : 'Email could not be sent. Please check the Resend setup.',
      detail,
    });
  }

  let leadSaved = false;
  try {
    leadSaved = Boolean(await saveLeadSubmission(lead));
  } catch (error) {
    console.error('Could not save contact lead', error);
  }

  return sendJson(response, 200, {
    ok: true,
    leadSaved,
    message:
      locale === 'vi'
        ? 'Đã gửi thông tin. Chúng tôi sẽ phản hồi sớm.'
        : 'Message sent. We will get back to you soon.',
  });
}
