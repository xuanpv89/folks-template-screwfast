const RESEND_API_URL = 'https://api.resend.com/emails';

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

  return sendJson(response, 200, {
    ok: true,
    message:
      locale === 'vi'
        ? 'Đã gửi thông tin. Chúng tôi sẽ phản hồi sớm.'
        : 'Message sent. We will get back to you soon.',
  });
}
