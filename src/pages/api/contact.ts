export const prerender = false;

const RESEND_API_URL = 'https://api.resend.com/emails';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function POST({ request }: { request: Request }) {
  const formData = await request.formData();
  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const message = String(formData.get('message') || '').trim();
  const locale = String(formData.get('locale') || 'en').trim();

  if (!firstName || !email || !message) {
    return json(
      {
        ok: false,
        message:
          locale === 'vi'
            ? 'Vui lòng điền tên, email và nội dung.'
            : 'Please fill in your name, email, and message.',
      },
      400
    );
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const toEmail = import.meta.env.CONTACT_TO_EMAIL || 'contact@folksteam.com';
  const fromEmail =
    import.meta.env.CONTACT_FROM_EMAIL ||
    'Folks Team Website <onboarding@resend.dev>';

  if (!apiKey) {
    return json(
      {
        ok: false,
        message:
          locale === 'vi'
            ? 'Máy chủ chưa cấu hình RESEND_API_KEY.'
            : 'Server is missing RESEND_API_KEY.',
      },
      500
    );
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
    const errorText = await resendResponse.text();
    return json(
      {
        ok: false,
        message:
          locale === 'vi'
            ? 'Không gửi được email. Vui lòng kiểm tra cấu hình Resend.'
            : 'Email could not be sent. Please check the Resend setup.',
        detail: errorText,
      },
      502
    );
  }

  return json({
    ok: true,
    message:
      locale === 'vi'
        ? 'Đã gửi thông tin. Chúng tôi sẽ phản hồi sớm.'
        : 'Message sent. We will get back to you soon.',
  });
}
