export function generateContentRemovedEmail(
  firstName: string,
  contentTitle: string,
  reason: string,
  flags: string[]
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Content Removed - Jevah</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #112e2a 0%, #0a1f1c 100%);
      color: #ffffff;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .email-container {
      max-width: 600px;
      width: 100%;
      background: #0a1f1c;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 107, 53, 0.2);
    }
    .header {
      padding: 40px 40px 20px;
      text-align: center;
      border-bottom: 1px solid rgba(255, 107, 53, 0.1);
    }
    .logo { height: 80px; width: auto; display: block; margin: 0 auto 20px; }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #ff6b35;
      margin-bottom: 8px;
    }
    .content { padding: 32px 40px; }
    .greeting { font-size: 18px; margin-bottom: 16px; color: #ffffff; font-weight: 500; }
    .highlight { color: #ff6b35; font-weight: 600; }
    .message { font-size: 16px; margin-bottom: 24px; color: #b8b8b8; line-height: 1.6; }
    .content-box {
      background: #112e2a;
      border: 1px solid #ff6b35;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    .content-title { color: #ff6b35; font-weight: 600; margin-bottom: 12px; }
    .reason-box {
      background: rgba(255, 107, 53, 0.08);
      border-left: 3px solid #ff6b35;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .reason-title { color: #e0e0e0; font-weight: 600; margin-bottom: 8px; }
    .reason-text { color: #b8b8b8; font-size: 14px; }
    .flags { margin-top: 16px; }
    .flag-item {
      display: inline-block;
      background: rgba(255, 107, 53, 0.15);
      color: #ff6b35;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      margin: 4px 4px 4px 0;
    }
    .appeal-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 20px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .appeal-text { color: #b8b8b8; font-size: 14px; line-height: 1.6; }
    .footer {
      padding: 24px 40px 32px;
      text-align: center;
      border-top: 1px solid rgba(255, 107, 53, 0.1);
    }
    .footer-address {
      color: #8a8a8a;
      font-size: 13px;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    @media (max-width: 600px) {
      body { padding: 12px; }
      .header, .content, .footer { padding-left: 24px; padding-right: 24px; }
      .title { font-size: 20px; }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <img
        src="https://res.cloudinary.com/ddgzzjp4x/image/upload/v1755907362/jevah-hq-removebg-preview_tv9rtc.png"
        alt="Jevah Logo"
        class="logo"
      />
      <h1 class="title">Content Removed</h1>
    </div>
    <div class="content">
      <p class="greeting">Hi <span class="highlight">${firstName}</span>,</p>
      <p class="message">
        We wanted to inform you that one of your uploaded content items has been removed from the Jevah platform 
        after review by our content moderation system.
      </p>
      <div class="content-box">
        <div class="content-title">Content Title:</div>
        <div style="color: #e0e0e0;">${contentTitle}</div>
      </div>
      <div class="reason-box">
        <div class="reason-title">Reason for Removal:</div>
        <div class="reason-text">${reason}</div>
        ${flags.length > 0 ? `
        <div class="flags">
          <div style="color: #e0e0e0; font-size: 12px; margin-bottom: 8px;">Issues Detected:</div>
          ${flags.map(flag => `<span class="flag-item">${flag.replace(/_/g, ' ')}</span>`).join('')}
        </div>
        ` : ''}
      </div>
      <div class="appeal-box">
        <div class="appeal-text">
          <strong style="color: #e0e0e0;">Appeal Process:</strong><br/>
          If you believe this removal was made in error, you can appeal this decision by contacting our support team 
          at support@jevahapp.com. Please include the content title and any additional context that may help us review your case.
        </div>
      </div>
      <p class="message" style="margin-top: 24px;">
        We appreciate your understanding and commitment to maintaining a safe, gospel-focused community on Jevah.
      </p>
    </div>
    <div class="footer">
      <p class="footer-address">
        23A, Bashorun Okusanya Street, Off Admiralty Road, Off Admiralty Wy,<br />
        Lekki Phase 1, Lagos, Nigeria
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function generateAdminModerationAlertEmail(
  mediaTitle: string,
  contentType: string,
  uploadedBy: string,
  moderationResult: any,
  reportCount?: number
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Content Moderation Alert - Jevah Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #112e2a 0%, #0a1f1c 100%);
      color: #ffffff;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    .email-container {
      max-width: 700px;
      width: 100%;
      background: #0a1f1c;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 107, 53, 0.2);
      margin: 0 auto;
    }
    .header {
      padding: 30px 40px 20px;
      text-align: center;
      border-bottom: 1px solid rgba(255, 107, 53, 0.1);
      background: rgba(255, 107, 53, 0.05);
    }
    .alert-badge {
      display: inline-block;
      background: #ff6b35;
      color: #0a1f1c;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 16px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #ff6b35;
    }
    .content { padding: 32px 40px; }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .info-label { color: #b8b8b8; font-size: 14px; }
    .info-value { color: #ffffff; font-weight: 500; }
    .status-box {
      background: ${moderationResult.isApproved ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)'};
      border-left: 3px solid ${moderationResult.isApproved ? '#4caf50' : '#f44336'};
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .status-text {
      color: ${moderationResult.isApproved ? '#4caf50' : '#f44336'};
      font-weight: 600;
      font-size: 16px;
    }
    .cta-button {
      display: inline-block;
      background: #ff6b35;
      color: #0a1f1c;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 20px;
    }
    .footer {
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid rgba(255, 107, 53, 0.1);
      color: #8a8a8a;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="alert-badge">⚠️ MODERATION ALERT</div>
      <h1 class="title">Content Requires Review</h1>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="info-label">Content Title:</span>
        <span class="info-value">${mediaTitle}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Content Type:</span>
        <span class="info-value">${contentType}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Uploaded By:</span>
        <span class="info-value">${uploadedBy}</span>
      </div>
      ${reportCount ? `
      <div class="info-row">
        <span class="info-label">User Reports:</span>
        <span class="info-value" style="color: #ff6b35;">${reportCount}</span>
      </div>
      ` : ''}
      <div class="status-box">
        <div class="status-text">
          Status: ${moderationResult.isApproved ? 'APPROVED' : moderationResult.requiresReview ? 'UNDER REVIEW' : 'REJECTED'}
        </div>
        <div style="color: #b8b8b8; font-size: 14px; margin-top: 8px;">
          ${moderationResult.reason || 'No reason provided'}
        </div>
        ${moderationResult.flags && moderationResult.flags.length > 0 ? `
        <div style="margin-top: 12px;">
          <div style="color: #b8b8b8; font-size: 12px; margin-bottom: 6px;">Flags:</div>
          ${moderationResult.flags.map((flag: string) => `<span style="display: inline-block; background: rgba(255, 107, 53, 0.15); color: #ff6b35; padding: 4px 8px; border-radius: 4px; font-size: 11px; margin: 2px;">${flag}</span>`).join('')}
        </div>
        ` : ''}
      </div>
      <div style="text-align: center;">
        <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.jevahapp.com'}/moderation" class="cta-button">
          Review in Dashboard
        </a>
      </div>
    </div>
    <div class="footer">
      Jevah Admin Dashboard - Automated Moderation Alert
    </div>
  </div>
</body>
</html>`;
}
