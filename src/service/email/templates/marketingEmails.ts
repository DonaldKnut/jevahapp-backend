/**
 * Branded HTML shell for marketing / product announcement emails.
 */
export function buildMarketingEmailHtml(params: {
  subject: string;
  bodyHtml: string;
  firstName?: string;
  unsubscribeUrl: string;
}): string {
  const greeting = params.firstName
    ? `Hi ${escapeHtml(params.firstName)},`
    : "Hi,";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0a1f1c;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#112e2a;border-radius:12px;overflow:hidden;border:1px solid rgba(255,107,53,0.25);">
      <div style="padding:28px 28px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:22px;font-weight:700;letter-spacing:0.02em;">Jevah</div>
        <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.65);">Gospel media for everyday life</div>
      </div>
      <div style="padding:28px;line-height:1.6;font-size:15px;color:rgba(255,255,255,0.92);">
        <p style="margin:0 0 16px;">${greeting}</p>
        <div>${params.bodyHtml}</div>
      </div>
      <div style="padding:20px 28px 28px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;">
        <p style="margin:0 0 8px;">You’re receiving this because you have a Jevah account and marketing emails are enabled.</p>
        <p style="margin:0;">
          <a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#ff6b35;text-decoration:underline;">Unsubscribe from marketing emails</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function plainTextToMarketingHtml(message: string): string {
  const escaped = escapeHtml(message).replace(/\n/g, "<br/>");
  return `<p style="margin:0;">${escaped}</p>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
