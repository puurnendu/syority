// Base template wrapper for all emails
function baseTemplate(content: string, orgName?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AURIANOA OS</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:580px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<div style="background:#0D2137;padding:24px 32px;">
<span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:2px;">AURIANOA</span>
<span style="color:rgba(255,255,255,0.4);font-size:11px;margin-left:4px;">OS</span>
${orgName ? `<div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px;">${orgName}</div>` : ''}
</div>
<div style="height:3px;background:linear-gradient(90deg,#E8701A,#F59E0B);"></div>
<div style="padding:32px;">${content}</div>
<div style="padding:20px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
<p style="margin:0;color:#9CA3AF;font-size:11px;text-align:center;line-height:1.6;">
AURIANOA OS — Industrial Workpack Management<br>
${orgName ? `Sent on behalf of ${orgName}. ` : ''}Do not reply to this email.</p>
</div>
</div>
</body>
</html>`;
}

export function welcomeEmail(params: {
    userName: string;
    orgName: string;
    email: string;
    tempPassword: string;
    loginUrl: string;
}): string {
    return baseTemplate(
        `
<h2 style="margin:0 0 8px;color:#0D2137;font-size:20px;">Welcome to AURIANOA OS</h2>
<p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Your account has been created for <strong>${params.orgName}</strong>.</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin-bottom:24px;">
<p style="margin:0 0 12px;color:#374151;font-size:13px;font-weight:600;text-transform:uppercase;">Your Login Credentials</p>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="color:#6B7280;font-size:13px;padding:4px 0;width:120px;">Email</td><td style="color:#111827;font-size:13px;">${params.email}</td></tr>
<tr><td style="color:#6B7280;font-size:13px;padding:4px 0;">Password</td><td style="color:#111827;font-size:13px;font-family:monospace;background:#FEF3C7;padding:2px 6px;border-radius:4px;">${params.tempPassword}</td></tr>
<tr><td style="color:#6B7280;font-size:13px;padding:4px 0;">Organisation</td><td style="color:#111827;font-size:13px;">${params.orgName}</td></tr>
</table>
</div>
<div style="text-align:center;margin:28px 0;">
<a href="${params.loginUrl}" style="display:inline-block;background:#0D2137;color:#FFFFFF;text-decoration:none;padding:12px 36px;border-radius:8px;font-size:14px;font-weight:600;">Sign In to AURIANOA OS →</a>
</div>
<p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center;">Please change your password after first login.</p>
`,
        params.orgName
    );
}

export function workpackReviewEmail(params: {
    reviewerName: string;
    plannerName: string;
    orgName: string;
    workpackNumber: string;
    workpackTitle: string;
    equipment: string;
    plannedStart: string;
    plannedEnd: string;
    activityCount: number;
    reviewUrl: string;
    expiresAt: string;
}): string {
    return baseTemplate(
        `
<h2 style="margin:0 0 8px;color:#0D2137;font-size:20px;">Workpack Review Required</h2>
<p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Dear ${params.reviewerName},<br><br><strong>${params.plannerName}</strong> has submitted a workpack for your review.</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin-bottom:24px;">
<div style="font-size:10px;color:#9CA3AF;text-transform:uppercase;">Workpack</div>
<div style="font-size:18px;font-weight:700;color:#0D2137;">${params.workpackNumber}</div>
<div style="font-size:14px;color:#374151;margin-bottom:16px;">${params.workpackTitle}</div>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="color:#6B7280;font-size:12px;padding:3px 0;width:130px;">Equipment</td><td style="color:#111827;font-size:12px;">${params.equipment}</td></tr>
<tr><td style="color:#6B7280;font-size:12px;padding:3px 0;">Planned Start</td><td style="color:#111827;font-size:12px;">${params.plannedStart}</td></tr>
<tr><td style="color:#6B7280;font-size:12px;padding:3px 0;">Planned End</td><td style="color:#111827;font-size:12px;">${params.plannedEnd}</td></tr>
<tr><td style="color:#6B7280;font-size:12px;padding:3px 0;">Activities</td><td style="color:#111827;font-size:12px;">${params.activityCount} planned</td></tr>
</table>
</div>
<div style="text-align:center;margin:28px 0;">
<a href="${params.reviewUrl}" style="display:inline-block;background:#0D2137;color:#FFFFFF;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:14px;font-weight:600;">Review & Approve Workpack →</a>
<div style="color:#9CA3AF;font-size:11px;margin-top:8px;">Link expires ${params.expiresAt}</div>
</div>
`,
        params.orgName
    );
}

export function workpackStatusEmail(params: {
    recipientName: string;
    orgName: string;
    workpackNumber: string;
    workpackTitle: string;
    newStatus: string;
    changedBy: string;
    notes?: string;
    workpackUrl: string;
}): string {
    const statusConfig: Record<string, { emoji: string; color: string; label: string }> = {
        approved: { emoji: '✅', color: '#065F46', label: 'Approved' },
        rejected: { emoji: '❌', color: '#991B1B', label: 'Rejected' },
        revision_requested: { emoji: '🔄', color: '#92400E', label: 'Revision Requested' },
        submitted: { emoji: '📤', color: '#1E3A5F', label: 'Submitted for Review' },
        in_progress: { emoji: '🔧', color: '#1D4ED8', label: 'In Progress' },
        complete: { emoji: '🏁', color: '#065F46', label: 'Complete' },
    };
    const sc = statusConfig[params.newStatus] ?? { emoji: '📋', color: '#374151', label: params.newStatus };
    return baseTemplate(
        `
<div style="text-align:center;margin-bottom:24px;">
<div style="font-size:40px;margin-bottom:8px;">${sc.emoji}</div>
<h2 style="margin:0;color:${sc.color};font-size:18px;">Workpack ${sc.label}</h2>
</div>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:20px;">
<div style="font-weight:700;color:#0D2137;font-size:16px;">${params.workpackNumber}</div>
<div style="color:#374151;font-size:13px;">${params.workpackTitle}</div>
<div style="color:#6B7280;font-size:12px;margin-top:8px;">Changed by: ${params.changedBy}</div>
${params.notes ? `<div style="margin-top:10px;padding:10px;background:#FFFBEB;border-radius:6px;color:#374151;font-size:13px;font-style:italic;">"${params.notes}"</div>` : ''}
</div>
<div style="text-align:center;">
<a href="${params.workpackUrl}" style="display:inline-block;background:#0D2137;color:#FFFFFF;text-decoration:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;">View Workpack →</a>
</div>
`,
        params.orgName
    );
}

export function renewalReminderEmail(params: {
    recipientName: string;
    orgName: string;
    daysRemaining: number;
    contractEndDate: string;
    contractValue: string;
    renewalUrl: string;
}): string {
    const urgent = params.daysRemaining <= 7;
    const color = urgent ? '#991B1B' : '#92400E';
    const emoji = urgent ? '🚨' : '⚠️';
    return baseTemplate(
        `
<div style="text-align:center;margin-bottom:20px;">
<div style="font-size:36px;">${emoji}</div>
<h2 style="margin:8px 0 0;color:${color};font-size:18px;">Contract Renewal ${urgent ? 'URGENT' : 'Reminder'}</h2>
</div>
<p style="color:#374151;font-size:14px;margin:0 0 20px;text-align:center;">The subscription for <strong>${params.orgName}</strong> expires in <strong>${params.daysRemaining} days</strong>.</p>
<div style="background:${urgent ? '#FEF2F2' : '#FFFBEB'};border:1px solid ${urgent ? '#FECACA' : '#FDE68A'};border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
<div style="font-size:13px;color:#6B7280;">Contract Ends</div>
<div style="font-size:20px;font-weight:700;color:${color};margin:4px 0;">${params.contractEndDate}</div>
<div style="font-size:13px;color:#6B7280;">Annual Value: ${params.contractValue}</div>
</div>
<div style="text-align:center;">
<a href="${params.renewalUrl}" style="display:inline-block;background:${urgent ? '#DC2626' : '#0D2137'};color:#FFFFFF;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Manage Renewal →</a>
</div>
`
    );
}

export function passwordResetEmail(params: {
    userName: string;
    orgName: string;
    resetUrl: string;
    expiresIn: string;
}): string {
    return baseTemplate(
        `
<h2 style="margin:0 0 16px;color:#0D2137;font-size:20px;">Password Reset Request</h2>
<p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Hi ${params.userName},<br><br>We received a request to reset your password. Click the button below to set a new password.</p>
<div style="text-align:center;margin:28px 0;">
<a href="${params.resetUrl}" style="display:inline-block;background:#0D2137;color:#FFFFFF;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:14px;font-weight:600;">Reset My Password →</a>
<div style="color:#9CA3AF;font-size:11px;margin-top:8px;">This link expires in ${params.expiresIn}.</div>
</div>
<p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center;">If you didn't request this, ignore this email.</p>
`,
        params.orgName
    );
}

export function holdPointReadyEmail(params: {
    recipientName: string;
    orgName: string;
    workpackNumber: string;
    workpackTitle: string;
    activityName: string;
    holdPointType: 'H' | 'W' | 'R' | 'I';
    workpackUrl: string;
}): string {
    const typeConfig: Record<string, { label: string; color: string; desc: string }> = {
        H: { label: 'HOLD Point', color: '#DC2626', desc: 'Work cannot proceed without your clearance.' },
        W: { label: 'WITNESS Point', color: '#D97706', desc: 'Your presence is requested for this activity.' },
        R: { label: 'REVIEW Point', color: '#2563EB', desc: 'Your review is required for this activity.' },
        I: { label: 'INFORMATION Point', color: '#6B7280', desc: 'For your information.' },
    };
    const tc = typeConfig[params.holdPointType] ?? typeConfig.I;
    return baseTemplate(
        `
<div style="border-left:4px solid ${tc.color};padding:12px 16px;margin-bottom:20px;background:#F9FAFB;border-radius:0 8px 8px 0;">
<div style="font-size:11px;font-weight:700;color:${tc.color};text-transform:uppercase;">${tc.label}</div>
<div style="color:#374151;font-size:13px;margin-top:4px;">${tc.desc}</div>
</div>
<p style="color:#374151;font-size:14px;margin:0 0 20px;">Dear ${params.recipientName},<br><br>A ${tc.label} has been reached in workpack <strong>${params.workpackNumber}</strong> and requires your attention.</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:24px;">
<table style="width:100%;border-collapse:collapse;">
<tr><td style="color:#6B7280;font-size:12px;padding:3px 0;width:120px;">Workpack</td><td style="color:#111827;font-size:12px;font-weight:600;">${params.workpackNumber}</td></tr>
<tr><td style="color:#6B7280;font-size:12px;padding:3px 0;">Title</td><td style="color:#111827;font-size:12px;">${params.workpackTitle}</td></tr>
<tr><td style="color:#6B7280;font-size:12px;padding:3px 0;">Activity</td><td style="color:#111827;font-size:12px;">${params.activityName}</td></tr>
</table>
</div>
<div style="text-align:center;">
<a href="${params.workpackUrl}" style="display:inline-block;background:${tc.color};color:#FFFFFF;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Sign Off Hold Point →</a>
</div>
`,
        params.orgName
    );
}

export function onboardingSubmissionEmail(params: {
    userName: string;
    orgName: string;
}): string {
    return baseTemplate(
        `
<h2 style="margin:0 0 8px;color:#0D2137;font-size:20px;">Onboarding Request Received</h2>
<p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Hi ${params.userName},<br><br>Thank you for your interest in AURIANOA OS. We have received your onboarding request for <strong>${params.orgName}</strong>.</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin-bottom:24px;">
<p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">Our platform administrators will review your request shortly. You will receive another email once your organization has been set up.</p>
</div>
<p style="color:#9CA3AF;font-size:12px;margin:0;text-align:center;">If you have any questions, please contact our support team.</p>
`
    );
}

export function onboardingApprovalEmail(params: {
    userName: string;
    orgName: string;
    loginUrl: string;
    tempPassword?: string;
}): string {
    return baseTemplate(
        `
<h2 style="margin:0 0 8px;color:#0D2137;font-size:20px;">Onboarding Approved!</h2>
<p style="color:#6B7280;font-size:14px;margin:0 0 24px;">Hi ${params.userName},<br><br>Great news! Your onboarding request for <strong>${params.orgName}</strong> has been approved. Your organization is now ready to use AURIANOA OS.</p>
<div style="background:#ECFDF5;border:1px solid #10B981;border-radius:8px;padding:20px;margin-bottom:24px;">
<p style="margin:0 0 12px;color:#065F46;font-size:13px;font-weight:600;text-transform:uppercase;">Next Steps</p>
<p style="margin:0;color:#065F46;font-size:13px;line-height:1.6;">You can now sign in using your email address. ${params.tempPassword ? `Use the temporary password below and you'll be prompted to change it upon first login.` : `Please use the "Forgot Password" flow if you haven't set a password yet.`}</p>
</div>
${params.tempPassword ? `
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
<div style="font-size:12px;color:#6B7280;margin-bottom:4px;">Temporary Password</div>
<div style="font-size:20px;font-weight:700;color:#0D2137;font-family:monospace;">${params.tempPassword}</div>
</div>
` : ''}
<div style="text-align:center;margin:28px 0;">
<a href="${params.loginUrl}" style="display:inline-block;background:#0D2137;color:#FFFFFF;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:14px;font-weight:600;">Sign In to AURIANOA OS →</a>
</div>
`,
        params.orgName
    );
}
