import { render } from '@react-email/render';
import * as React from 'react';
import { WorkpackSubmittedEmail } from '../src/emails/WorkpackSubmittedEmail';
import { sendEmail } from '../src/lib/email/emailService';

async function sendPreview() {
  console.log('Rendering template...');
  const props = {
    reviewerName: 'John Reviewer',
    plannerName: 'Jane Planner',
    workpackNumber: 'WP-TEST-999',
    workpackTitle: 'Preview Test Workpack',
    reviewUrl: `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''}/workpacks/test`,
    orgName: 'AURIANOA Demo',
    primaryColor: '#0D2137',
  };

  const html = await render(React.createElement(WorkpackSubmittedEmail, props));
  const text = await render(React.createElement(WorkpackSubmittedEmail, props), { plainText: true });

  console.log('Sending email...');
  // Using a try-catch because SMTP might not be configured in this environment
  try {
    const result = await sendEmail({
        to: 'test@example.com',
        subject: 'PREVIEW: Workpack Review Required',
        html,
        text,
    });
    console.log('Result:', result);
  } catch (e) {
    console.log('Email delivery failed as expected (no SMTP), but rendering succeeded.');
    console.log('HTML Length:', html.length);
  }
}

sendPreview().catch(console.error);
