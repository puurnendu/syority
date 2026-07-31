/**
 * M7.6 — Notification Platform Seed Data
 *
 * Seeds default notification templates and rules.
 * Run with: npx ts-node prisma/seeds/notification-seed.ts
 * Or import into your main seed file.
 */

import { prisma, disconnect } from '../seed-client';

// ─── Default Templates ────────────────────────────────────────────────────────

const TEMPLATES = [
  // ── Authentication ──────────────────────────────────────────────────────────
  {
    slug: 'password-reset',
    category: 'authentication',
    name: 'Password Reset',
    subject: 'AURIANOA OS — Password Reset Request',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">Password Reset Request</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">Hello <strong>{{user_name}}</strong>,</p>
<p style="color:#374151;font-size:14px;line-height:1.6;">We received a request to reset your password for {{company}}. Click the button below to set a new password:</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{reset_link}}" style="display:inline-block;padding:12px 32px;background:#E8701A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Reset Password</a>
</div>
<p style="color:#6B7280;font-size:13px;">This link expires in {{expires_in}}. If you didn't request this, please ignore this email.</p>
<p style="color:#6B7280;font-size:12px;margin-top:24px;border-top:1px solid #E5E7EB;padding-top:16px;">If the button doesn't work, copy and paste this URL into your browser:<br><a href="{{reset_link}}" style="color:#E8701A;word-break:break-all;">{{reset_link}}</a></p>`,
    variables: ['user_name', 'company', 'reset_link', 'expires_in', 'app_url'],
  },
  {
    slug: 'welcome',
    category: 'authentication',
    name: 'Welcome Email',
    subject: 'Welcome to {{company}} — AURIANOA OS',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">Welcome to AURIANOA OS! 🎉</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">Hello <strong>{{user_name}}</strong>,</p>
<p style="color:#374151;font-size:14px;line-height:1.6;">Your account has been created for <strong>{{company}}</strong>. You can now access the platform at:</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#0D2137;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open AURIANOA OS</a>
</div>
<p style="color:#6B7280;font-size:13px;">If you have questions, contact your organization administrator.</p>`,
    variables: ['user_name', 'company', 'app_url'],
  },
  {
    slug: 'user-invited',
    category: 'authentication',
    name: 'User Invitation',
    subject: "You've been invited to {{company}} — AURIANOA OS",
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">You're Invited!</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">Hello <strong>{{user_name}}</strong>,</p>
<p style="color:#374151;font-size:14px;line-height:1.6;">You have been invited to join <strong>{{company}}</strong> on AURIANOA OS. Click below to set up your account:</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{reset_link}}" style="display:inline-block;padding:12px 32px;background:#E8701A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Set Up Account</a>
</div>
<p style="color:#6B7280;font-size:13px;">This invitation was sent by {{changed_by}}.</p>`,
    variables: ['user_name', 'company', 'reset_link', 'changed_by'],
  },

  // ── Planning ────────────────────────────────────────────────────────────────
  {
    slug: 'workpack-submitted',
    category: 'planning',
    name: 'Workpack Submitted for Review',
    subject: 'Review Required: Workpack {{workpack_number}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">Workpack Submitted for Review</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A workpack has been submitted and requires your review:</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Number:</strong> {{workpack_number}}</p>
  <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Title:</strong> {{workpack_title}}</p>
  <p style="margin:0;color:#374151;font-size:14px;"><strong>Submitted by:</strong> {{user_name}}</p>
</div>
<div style="text-align:center;margin:24px 0;">
  <a href="{{approval_link}}" style="display:inline-block;padding:12px 32px;background:#E8701A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Review Workpack</a>
</div>`,
    variables: ['user_name', 'company', 'workpack_number', 'workpack_title', 'approval_link', 'app_url'],
  },
  {
    slug: 'workpack-approved',
    category: 'planning',
    name: 'Workpack Approved',
    subject: 'Workpack Approved: {{workpack_number}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">✅ Workpack Approved</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">Your workpack has been approved:</p>
<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#065F46;font-size:14px;"><strong>Number:</strong> {{workpack_number}}</p>
  <p style="margin:0 0 4px;color:#065F46;font-size:14px;"><strong>Title:</strong> {{workpack_title}}</p>
  <p style="margin:0;color:#065F46;font-size:14px;"><strong>Approved by:</strong> {{changed_by}}</p>
</div>
{{#if notes}}<p style="color:#374151;font-size:14px;"><strong>Notes:</strong> {{notes}}</p>{{/if}}
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#0D2137;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Workpack</a>
</div>`,
    variables: ['user_name', 'company', 'workpack_number', 'workpack_title', 'changed_by', 'notes', 'app_url'],
  },
  {
    slug: 'workpack-rejected',
    category: 'planning',
    name: 'Workpack Rejected',
    subject: 'Workpack Rejected: {{workpack_number}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">❌ Workpack Rejected</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">Your workpack has been rejected and requires revision:</p>
<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#991B1B;font-size:14px;"><strong>Number:</strong> {{workpack_number}}</p>
  <p style="margin:0 0 4px;color:#991B1B;font-size:14px;"><strong>Title:</strong> {{workpack_title}}</p>
  <p style="margin:0;color:#991B1B;font-size:14px;"><strong>Rejected by:</strong> {{changed_by}}</p>
</div>
{{#if notes}}<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;color:#92400E;font-size:14px;"><strong>Reason:</strong> {{notes}}</p></div>{{/if}}
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#E8701A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Revise Workpack</a>
</div>`,
    variables: ['user_name', 'company', 'workpack_number', 'workpack_title', 'changed_by', 'notes', 'app_url'],
  },
  {
    slug: 'workpack-issued',
    category: 'planning',
    name: 'Workpack Issued',
    subject: 'Workpack Issued: {{workpack_number}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">📋 Workpack Issued</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A workpack has been issued for execution:</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Number:</strong> {{workpack_number}}</p>
  <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Title:</strong> {{workpack_title}}</p>
  <p style="margin:0;color:#374151;font-size:14px;"><strong>Issued by:</strong> {{changed_by}}</p>
</div>`,
    variables: ['user_name', 'company', 'workpack_number', 'workpack_title', 'changed_by', 'app_url'],
  },

  // ── Execution ───────────────────────────────────────────────────────────────
  {
    slug: 'qa-assigned',
    category: 'execution',
    name: 'QA Check Assigned',
    subject: 'QA Check Assigned — {{workpack_number}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">🔍 QA Check Assigned</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">You have been assigned a QA check:</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Workpack:</strong> {{workpack_number}} — {{workpack_title}}</p>
  <p style="margin:0;color:#374151;font-size:14px;"><strong>Assigned by:</strong> {{changed_by}}</p>
</div>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#E8701A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View QA Check</a>
</div>`,
    variables: ['user_name', 'company', 'workpack_number', 'workpack_title', 'changed_by', 'app_url'],
  },
  {
    slug: 'qa-passed',
    category: 'execution',
    name: 'QA Check Passed',
    subject: 'QA Check Passed — {{workpack_number}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">✅ QA Check Passed</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A QA check has passed:</p>
<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#065F46;font-size:14px;"><strong>Workpack:</strong> {{workpack_number}}</p>
  <p style="margin:0;color:#065F46;font-size:14px;"><strong>Inspector:</strong> {{reviewer_name}}</p>
</div>`,
    variables: ['user_name', 'company', 'workpack_number', 'workpack_title', 'reviewer_name', 'app_url'],
  },
  {
    slug: 'hold-point-ready',
    category: 'execution',
    name: 'Hold Point Ready for Inspection',
    subject: 'Hold Point Ready — {{workpack_number}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">⚠️ Hold Point Ready</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A hold point is ready for inspection:</p>
<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#92400E;font-size:14px;"><strong>Workpack:</strong> {{workpack_number}} — {{workpack_title}}</p>
  <p style="margin:0;color:#92400E;font-size:14px;"><strong>Equipment:</strong> {{equipment}}</p>
</div>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#E8701A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Inspect Hold Point</a>
</div>`,
    variables: ['user_name', 'company', 'workpack_number', 'workpack_title', 'equipment', 'app_url'],
  },
  {
    slug: 'punch-assigned',
    category: 'execution',
    name: 'Punch Item Assigned',
    subject: 'Punch Item Assigned — {{workpack_number}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">🔧 Punch Item Assigned</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A punch item has been assigned to you:</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Workpack:</strong> {{workpack_number}} — {{workpack_title}}</p>
  <p style="margin:0;color:#374151;font-size:14px;"><strong>Assigned by:</strong> {{changed_by}}</p>
</div>`,
    variables: ['user_name', 'company', 'workpack_number', 'workpack_title', 'changed_by', 'app_url'],
  },

  // ── Reports ─────────────────────────────────────────────────────────────────
  {
    slug: 'daily-progress',
    category: 'reports',
    name: 'Daily Progress Report',
    subject: 'Daily Progress Report — {{date}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">📊 Daily Progress Report</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">Your daily progress report for <strong>{{date}}</strong> is ready.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#0D2137;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Report</a>
</div>`,
    variables: ['user_name', 'company', 'date', 'app_url'],
  },
  {
    slug: 'shift-report',
    category: 'reports',
    name: 'Shift Report',
    subject: 'Shift Report — {{date}} ({{time}})',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">📋 Shift Report</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">The shift report for <strong>{{date}}</strong> ({{time}} shift) is attached.</p>`,
    variables: ['user_name', 'company', 'date', 'time', 'app_url'],
  },
  {
    slug: 'weekly-dashboard',
    category: 'reports',
    name: 'Weekly Dashboard Summary',
    subject: 'Weekly Dashboard Summary — {{company}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">📈 Weekly Dashboard Summary</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">Hello <strong>{{user_name}}</strong>, here's your weekly summary for <strong>{{company}}</strong>.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#0D2137;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Dashboard</a>
</div>`,
    variables: ['user_name', 'company', 'app_url'],
  },
  {
    slug: 'executive-summary',
    category: 'reports',
    name: 'Executive Summary Report',
    subject: 'Executive Summary — {{company}} — {{date}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">📑 Executive Summary</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">The executive summary for <strong>{{company}}</strong> ({{date}}) is ready for review.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#0D2137;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Summary</a>
</div>`,
    variables: ['user_name', 'company', 'date', 'app_url'],
  },

  // ── Platform ────────────────────────────────────────────────────────────────
  {
    slug: 'onboarding-submission',
    category: 'platform',
    name: 'Onboarding Form Submitted',
    subject: 'Onboarding Form Submitted — {{company}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">📝 Onboarding Form Submitted</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A new onboarding form has been submitted by <strong>{{user_name}}</strong> for <strong>{{company}}</strong>.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#E8701A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Review Submission</a>
</div>`,
    variables: ['user_name', 'company', 'app_url'],
  },
  {
    slug: 'onboarding-approval',
    category: 'platform',
    name: 'Onboarding Approved',
    subject: 'Onboarding Approved — Welcome to {{company}}!',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">✅ Onboarding Approved</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">Your onboarding for <strong>{{company}}</strong> has been approved. You can now access the platform.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#0D2137;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Get Started</a>
</div>`,
    variables: ['user_name', 'company', 'app_url'],
  },
  {
    slug: 'scope-approved',
    category: 'platform',
    name: 'Shutdown Scope Approved',
    subject: 'Scope Approved — {{company}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">✅ Shutdown Scope Approved</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A shutdown scope has been approved for <strong>{{company}}</strong>.</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{app_url}}" style="display:inline-block;padding:12px 32px;background:#0D2137;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Scope</a>
</div>`,
    variables: ['user_name', 'company', 'app_url'],
  },
  {
    slug: 'event-created',
    category: 'platform',
    name: 'Shutdown Event Created',
    subject: 'New Shutdown Event — {{event}}',
    html_body: `<h2 style="color:#0D2137;margin:0 0 16px;">📅 Shutdown Event Created</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A new shutdown event has been created:</p>
<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin:16px 0;">
  <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Event:</strong> {{event}}</p>
  <p style="margin:0;color:#374151;font-size:14px;"><strong>Created by:</strong> {{changed_by}}</p>
</div>`,
    variables: ['user_name', 'company', 'event', 'changed_by', 'app_url'],
  },
  {
    slug: 'system-alert',
    category: 'platform',
    name: 'System Alert',
    subject: '⚠️ AURIANOA OS — System Alert',
    html_body: `<h2 style="color:#991B1B;margin:0 0 16px;">⚠️ System Alert</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">{{notes}}</p>
<p style="color:#6B7280;font-size:13px;">This is an automated system notification from AURIANOA OS.</p>`,
    variables: ['notes', 'app_url'],
  },
  {
    slug: 'backup-failed',
    category: 'platform',
    name: 'Backup Failed',
    subject: '🚨 AURIANOA OS — Backup Failed',
    html_body: `<h2 style="color:#991B1B;margin:0 0 16px;">🚨 Backup Failed</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;">A scheduled backup has failed. Please investigate immediately.</p>
{{#if notes}}<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;color:#991B1B;font-size:14px;"><strong>Error:</strong> {{notes}}</p></div>{{/if}}`,
    variables: ['notes', 'app_url'],
  },
];

// ─── Default Rules ────────────────────────────────────────────────────────────

interface RuleSeed {
  name: string;
  event_type: string;
  template_slug: string;
  channel: string;
  recipients: Array<{ recipient_type: string; recipient_value: string }>;
}

const RULES: RuleSeed[] = [
  {
    name: 'Password Reset → Email User',
    event_type: 'password.reset',
    template_slug: 'password-reset',
    channel: 'email',
    recipients: [{ recipient_type: 'actor', recipient_value: 'triggered_by' }],
  },
  {
    name: 'Workpack Submitted → Email Admins',
    event_type: 'workpack.submitted',
    template_slug: 'workpack-submitted',
    channel: 'email',
    recipients: [{ recipient_type: 'role', recipient_value: 'admin' }],
  },
  {
    name: 'Workpack Approved → Email Creator',
    event_type: 'workpack.approved',
    template_slug: 'workpack-approved',
    channel: 'email',
    recipients: [{ recipient_type: 'actor', recipient_value: 'triggered_by' }],
  },
  {
    name: 'Workpack Rejected → Email Creator',
    event_type: 'workpack.rejected',
    template_slug: 'workpack-rejected',
    channel: 'email',
    recipients: [{ recipient_type: 'actor', recipient_value: 'triggered_by' }],
  },
];

// ─── Seed Runner ──────────────────────────────────────────────────────────────

export async function seedNotificationPlatform() {
  console.log('🌱 Seeding notification templates...');

  for (const tpl of TEMPLATES) {
    const existing = await prisma.notification_templates.findUnique({ where: { slug: tpl.slug } });
    if (existing) {
      console.log(`  ⏭ Template "${tpl.slug}" already exists, skipping`);
      continue;
    }

    await prisma.notification_templates.create({
      data: {
        slug: tpl.slug,
        category: tpl.category,
        name: tpl.name,
        subject: tpl.subject,
        html_body: tpl.html_body,
        variables: tpl.variables,
      },
    });
    console.log(`  ✅ Created template: ${tpl.name} (${tpl.slug})`);
  }

  console.log('🌱 Seeding notification rules...');

  for (const rule of RULES) {
    // Find the template by slug
    const template = await prisma.notification_templates.findUnique({
      where: { slug: rule.template_slug },
    });
    if (!template) {
      console.log(`  ⚠️ Template "${rule.template_slug}" not found, skipping rule "${rule.name}"`);
      continue;
    }

    // Check if a rule with the same name already exists
    const existing = await prisma.notification_rules.findFirst({
      where: { name: rule.name },
    });
    if (existing) {
      console.log(`  ⏭ Rule "${rule.name}" already exists, skipping`);
      continue;
    }

    await prisma.notification_rules.create({
      data: {
        name: rule.name,
        event_type: rule.event_type,
        channel: rule.channel,
        template_id: template.id,
        is_enabled: true,
        recipients: {
          create: rule.recipients.map((r) => ({
            recipient_type: r.recipient_type,
            recipient_value: r.recipient_value,
          })),
        },
      },
    });
    console.log(`  ✅ Created rule: ${rule.name}`);
  }

  console.log('✅ Notification platform seed complete!');
}

// Allow direct execution
if (require.main === module) {
  seedNotificationPlatform()
    .then(() => disconnect())
    .catch((err) => {
      console.error('Seed failed:', err);
      disconnect();
      process.exit(1);
    });
}
