export function generateAdminReportNotificationEmail(
  mediaTitle: string,
  contentType: string,
  uploadedBy: string,
  reporterName: string,
  reportReason: string,
  reportDescription: string | undefined,
  mediaId: string,
  reportCount: number
): string {
  const reasonLabels: { [key: string]: string } = {
    inappropriate_content: "Inappropriate Content",
    non_gospel_content: "Non-Gospel Content",
    explicit_language: "Explicit Language",
    violence: "Violence",
    sexual_content: "Sexual Content",
    blasphemy: "Blasphemy",
    spam: "Spam",
    copyright: "Copyright Violation",
    other: "Other",
  };

  const reasonLabel = reasonLabels[reportReason] || reportReason;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Content Report - Jevah Admin</title>
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
    .report-box {
      background: rgba(255, 107, 53, 0.1);
      border-left: 3px solid #ff6b35;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .report-reason {
      color: #ff6b35;
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .report-description {
      color: #b8b8b8;
      font-size: 14px;
      margin-top: 8px;
      white-space: pre-wrap;
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
    .count-badge {
      display: inline-block;
      background: rgba(255, 107, 53, 0.2);
      color: #ff6b35;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="alert-badge">📋 NEW REPORT</div>
      <h1 class="title">Content Reported by User</h1>
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
      <div class="info-row">
        <span class="info-label">Reported By:</span>
        <span class="info-value">${reporterName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Total Reports:</span>
        <span class="info-value">${reportCount}<span class="count-badge">${reportCount === 1 ? 'NEW' : reportCount >= 3 ? 'URGENT' : 'MULTIPLE'}</span></span>
      </div>
      <div class="report-box">
        <div class="report-reason">Reason: ${reasonLabel}</div>
        ${reportDescription ? `
        <div class="report-description">
          <strong>Description:</strong><br/>
          ${reportDescription}
        </div>
        ` : '<div class="report-description" style="color: #8a8a8a; font-style: italic;">No additional description provided</div>'}
      </div>
      <div style="text-align: center;">
        <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.jevahapp.com'}/reports?mediaId=${mediaId}" class="cta-button">
          Review Report in Dashboard
        </a>
      </div>
    </div>
    <div class="footer">
      Jevah Admin Dashboard - Automated Report Notification
    </div>
  </div>
</body>
</html>`;
}

export function generateAdminCommentReportNotificationEmail(
  commentContent: string,
  mediaTitle: string,
  contentType: string,
  commentAuthorEmail: string,
  commentAuthorName: string,
  reporterName: string,
  reportReason: string,
  reportDescription: string | undefined,
  commentId: string,
  mediaId: string,
  reportCount: number
): string {
  const reasonLabels: { [key: string]: string } = {
    inappropriate_content: "Inappropriate Content",
    non_gospel_content: "Non-Gospel Content",
    explicit_language: "Explicit Language",
    violence: "Violence",
    sexual_content: "Sexual Content",
    blasphemy: "Blasphemy",
    spam: "Spam",
    copyright: "Copyright Violation",
    other: "Other",
  };

  const reasonLabel = reasonLabels[reportReason] || reportReason;
  const truncatedComment = commentContent.length > 200
    ? commentContent.substring(0, 200) + "..."
    : commentContent;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Comment Report - Jevah Admin</title>
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
    .comment-box {
      background: rgba(255, 255, 255, 0.05);
      border-left: 3px solid #4a9eff;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .comment-content {
      color: #ffffff;
      font-size: 15px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .report-box {
      background: rgba(255, 107, 53, 0.1);
      border-left: 3px solid #ff6b35;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .report-reason {
      color: #ff6b35;
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .report-description {
      color: #b8b8b8;
      font-size: 14px;
      margin-top: 8px;
      white-space: pre-wrap;
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
    .count-badge {
      display: inline-block;
      background: rgba(255, 107, 53, 0.2);
      color: #ff6b35;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="alert-badge">💬 NEW COMMENT REPORT</div>
      <h1 class="title">Comment Reported by User</h1>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="info-label">Media Title:</span>
        <span class="info-value">${mediaTitle}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Content Type:</span>
        <span class="info-value">${contentType}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Comment Author:</span>
        <span class="info-value">${commentAuthorName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Reported By:</span>
        <span class="info-value">${reporterName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Total Reports:</span>
        <span class="info-value">${reportCount}<span class="count-badge">${reportCount === 1 ? 'NEW' : reportCount >= 3 ? 'URGENT' : 'MULTIPLE'}</span></span>
      </div>
      <div class="comment-box">
        <div style="color: #4a9eff; font-weight: 600; margin-bottom: 8px; font-size: 14px;">REPORTED COMMENT:</div>
        <div class="comment-content">${truncatedComment}</div>
      </div>
      <div class="report-box">
        <div class="report-reason">Reason: ${reasonLabel}</div>
        ${reportDescription ? `
        <div class="report-description">
          <strong>Description:</strong><br/>
          ${reportDescription}
        </div>
        ` : '<div class="report-description" style="color: #8a8a8a; font-style: italic;">No additional description provided</div>'}
      </div>
      <div style="text-align: center;">
        <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://admin.jevahapp.com'}/reports?commentId=${commentId}&mediaId=${mediaId}" class="cta-button">
          Review Comment Report in Dashboard
        </a>
      </div>
    </div>
    <div class="footer">
      Jevah Admin Dashboard - Automated Comment Report Notification
    </div>
  </div>
</body>
</html>`;
}
