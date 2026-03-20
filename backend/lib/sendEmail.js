const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(toEmail, toName, token) {
  const appUrl = process.env.APP_URL || 'https://firstcallremovals.com';
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;
  const displayName = toName || toEmail;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email — First Call Removals</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                🚐 First Call Removals
              </h1>
              <p style="margin:8px 0 0;color:#a0a0b8;font-size:13px;">Professional Funeral Transport</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:20px;font-weight:600;">
                Verify Your Email Address
              </h2>
              <p style="margin:0 0 12px;color:#444;font-size:15px;line-height:1.6;">
                Hi ${displayName},
              </p>
              <p style="margin:0 0 28px;color:#444;font-size:15px;line-height:1.6;">
                Thanks for registering with First Call Removals. To activate your account, please verify your email address by clicking the button below.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#2563eb;border-radius:6px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
                      ✓ Verify My Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#888;font-size:13px;line-height:1.5;">
                This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
              </p>
              <p style="margin:0;color:#aaa;font-size:12px;word-break:break-all;">
                Or copy this link into your browser:<br/>
                <a href="${verifyUrl}" style="color:#2563eb;">${verifyUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9f9fb;border-top:1px solid #e8e8ec;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#aaa;font-size:12px;">
                First Call Removals &bull; Professional Funeral Transport Services<br/>
                Questions? Contact us at <a href="mailto:support@firstcallremovals.com" style="color:#2563eb;">support@firstcallremovals.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const result = await resend.emails.send({
      from: 'First Call Removals <leads@knowlegalleads.com>',
      to: toEmail,
      subject: 'Verify your email — First Call Removals',
      html,
    });
    return result;
  } catch (err) {
    console.error('[sendEmail] Failed to send verification email:', err);
    throw err;
  }
}

module.exports = { sendVerificationEmail };
