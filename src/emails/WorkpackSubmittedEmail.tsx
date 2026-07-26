import {
  Button,
  Heading,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './BaseLayout';

interface WorkpackSubmittedEmailProps {
  reviewerName: string;
  plannerName: string;
  workpackNumber: string;
  workpackTitle: string;
  reviewUrl: string;
  orgName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export const WorkpackSubmittedEmail = ({
  reviewerName,
  plannerName,
  workpackNumber,
  workpackTitle,
  reviewUrl,
  orgName,
  logoUrl,
  primaryColor,
}: WorkpackSubmittedEmailProps) => (
  <BaseLayout
    previewText={`Review required for Workpack ${workpackNumber}`}
    orgName={orgName}
    logoUrl={logoUrl}
    primaryColor={primaryColor}
  >
    <Heading className="text-[#0D2137] text-[20px] font-bold p-0 m-0 mb-[8px]">
      Workpack Review Required
    </Heading>
    <Text className="text-gray-600 text-[14px] leading-[24px]">
      Dear {reviewerName},<br /><br />
      <strong>{plannerName}</strong> has submitted a workpack for your review.
    </Text>
    <Section className="bg-gray-50 border border-solid border-[#eaeaea] rounded-[8px] p-[20px] mb-[24px]">
      <Text className="m-0 text-[#9CA3AF] text-[10px] uppercase font-bold tracking-wider">
        Workpack
      </Text>
      <Text className="m-0 text-[#0D2137] text-[18px] font-bold">
        {workpackNumber}
      </Text>
      <Text className="m-0 text-[#374151] text-[14px] mb-[16px]">
        {workpackTitle}
      </Text>
    </Section>
    <Section className="text-center mt-[28px] mb-[28px]">
      <Button
        className="bg-[#0D2137] rounded-[8px] color-[#fff] text-[14px] font-bold no-underline text-center px-[40px] py-[14px]"
        style={{ color: '#fff' }}
        href={reviewUrl}
      >
        Review & Approve Workpack →
      </Button>
    </Section>
  </BaseLayout>
);

export default WorkpackSubmittedEmail;
