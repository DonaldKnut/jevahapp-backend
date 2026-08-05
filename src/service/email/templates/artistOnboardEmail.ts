/**
 * Branded HTML for admin → artist onboard / invite emails (ops, not marketing opt-out).
 */
export function buildArtistOnboardEmailHtml(params: {
  artistName: string;
  firstName?: string;
  customMessageHtml?: string;
  ctaUrl: string;
  ctaLabel?: string;
}): string {
  const name =
    params.firstName?.trim() ||
    params.artistName?.trim() ||
    "there";
  const ctaLabel = params.ctaLabel || "Open creator studio";
  const custom = params.customMessageHtml
    ? `<div style="margin:0 0 16px;">${params.customMessageHtml}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Jevah Creators</title>
</head>
<body style="margin:0;padding:0;background:#0a1f1c;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#112e2a;border-radius:12px;overflow:hidden;border:1px solid rgba(255,107,53,0.25);">
      <div style="padding:28px 28px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:22px;font-weight:700;letter-spacing:0.02em;">Jevah</div>
        <div style="margin-top:6px;font-size:13px;color:rgba(255,255,255,0.65);">Creator onboard</div>
      </div>
      <div style="padding:28px;line-height:1.6;font-size:15px;color:rgba(255,255,255,0.92);">
        <p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
        ${custom}
        <p style="margin:0 0 16px;">You’re invited to create on <strong>Jevah</strong> — gospel media for everyday life. Upload your music to the <strong>Artists</strong> catalog (separate from Copyright-free beds).</p>
        <p style="margin:0 0 8px;">Getting started:</p>
        <ol style="margin:0 0 20px;padding-left:20px;color:rgba(255,255,255,0.88);">
          <li style="margin-bottom:8px;">Open the creator hub and finish your profile</li>
          <li style="margin-bottom:8px;">Upload a track (intent → upload → finalize)</li>
          <li style="margin-bottom:8px;">Publish when you’re ready — listeners find you on Music → Artists</li>
        </ol>
        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:#ff6b35;color:#112e2a;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:700;">${escapeHtml(ctaLabel)}</a>
        </div>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">If the button doesn’t work, copy this link:<br/>
          <span style="word-break:break-all;color:#ff6b35;">${escapeHtml(params.ctaUrl)}</span>
        </p>
      </div>
      <div style="padding:20px 28px 28px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:rgba(255,255,255,0.55);line-height:1.5;">
        <p style="margin:0;">Sent by the Jevah team to help you onboard as a creator.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function plainTextToHtmlParagraphs(message: string): string {
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
