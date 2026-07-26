import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import * as React from 'react';
import { WorkpackSubmittedEmail } from '../WorkpackSubmittedEmail';
import { WorkpackApprovedEmail } from '../WorkpackApprovedEmail';
import { WorkpackRejectedEmail } from '../WorkpackRejectedEmail';
import { DailyDigestEmail } from '../DailyDigestEmail';

describe('Email Templates Snapshot Tests', () => {
  const commonProps = {
    orgName: 'AURIANOA Industrial',
    logoUrl: 'https://aurianoa.com/logo.png',
    primaryColor: '#0D2137',
  };

  it('renders WorkpackSubmittedEmail correctly', async () => {
    const html = await render(
      <WorkpackSubmittedEmail
        {...commonProps}
        reviewerName="John Reviewer"
        plannerName="Jane Planner"
        workpackNumber="WP-2024-001"
        workpackTitle="Tank 101 Inspection"
        reviewUrl="https://app.aurianoa.com/workpacks/123"
      />
    );
    expect(html).toContain('Workpack Review Required');
    expect(html).toContain('Jane Planner');
    expect(html).toContain('WP-2024-001');
    expect(html.length).toBeGreaterThan(1000);
  });

  it('renders WorkpackApprovedEmail correctly', async () => {
    const html = await render(
      <WorkpackApprovedEmail
        {...commonProps}
        recipientName="Jane Planner"
        workpackNumber="WP-2024-001"
        workpackTitle="Tank 101 Inspection"
        changedBy="John Reviewer"
        workpackUrl="https://app.aurianoa.com/workpacks/123"
        notes="All documents look good. Approved."
      />
    );
    expect(html).toContain('Workpack Approved');
    expect(html).toMatch(/Approved by:.*John Reviewer/);
  });

  it('renders WorkpackRejectedEmail correctly', async () => {
    const html = await render(
      <WorkpackRejectedEmail
        {...commonProps}
        recipientName="Jane Planner"
        workpackNumber="WP-2024-001"
        workpackTitle="Tank 101 Inspection"
        changedBy="John Reviewer"
        workpackUrl="https://app.aurianoa.com/workpacks/123"
        notes="Missing P&ID attachments for Section 2."
      />
    );
    expect(html).toContain('Workpack Rejected');
    expect(html).toMatch(/Rejected by:.*John Reviewer/);
  });

  it('renders DailyDigestEmail correctly', async () => {
    const html = await render(
      <DailyDigestEmail
        {...commonProps}
        recipientName="Alex Manager"
        dashboardUrl="https://app.aurianoa.com/dashboard"
        items={[
          {
            id: '1',
            type: 'workpack.approved',
            title: 'WP-2024-001 Approved',
            message: 'Your workpack was approved by John.',
            actionUrl: 'https://app.aurianoa.com/workpacks/1',
          },
          {
            id: '2',
            type: 'workpack.submitted',
            title: 'WP-2024-005 Submitted',
            message: 'Jane submitted a new workpack for review.',
            actionUrl: 'https://app.aurianoa.com/workpacks/5',
          }
        ]}
      />
    );
    expect(html).toContain('Daily Activity Summary');
    expect(html).toContain('WP-2024-001 Approved');
    expect(html).toContain('WP-2024-005 Submitted');
  });

  it('renders plain text version correctly', async () => {
    const text = await render(
      <WorkpackSubmittedEmail
        {...commonProps}
        reviewerName="John Reviewer"
        plannerName="Jane Planner"
        workpackNumber="WP-2024-001"
        workpackTitle="Tank 101 Inspection"
        reviewUrl="https://app.aurianoa.com/workpacks/123"
      />,
      { plainText: true }
    );
    expect(text.toUpperCase()).toContain('WORKPACK REVIEW REQUIRED');
    expect(text).toContain('WP-2024-001');
    expect(text).not.toContain('<html');
  });
});
