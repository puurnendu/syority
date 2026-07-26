import {
  Button,
  Heading,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './BaseLayout';

interface WorkpackRejectedEmailProps {
  recipientName: string;
  workpackNumber: string;
  workpackTitle: string;
  changedBy: string;
  workpackUrl: string;
  notes?: string;
  orgName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export const WorkpackRejectedEmail = ({
  recipientName,
  workpackNumber,
  workpackTitle,
  changedBy,
  workpackUrl,
  notes,
  orgName,
  logoUrl,
  primaryColor = '#991B1B',
}: WorkpackRejectedEmailProps) => (
  <BaseLayout
    previewText={`Workpack ${workpackNumber} Rejected`}
    orgName={orgName}
    logoUrl={logoUrl}
    primaryColor={primaryColor}
  >
    <Section className="text-center mb-[24px]">
      <Text className="text-[40px] m-0">❌</Text>
      <Heading className="text-[#991B1B] text-[18px] font-bold p-0 m-0">
        Workpack Rejected
      </Heading>
    </Section>
    <Text className="text-gray-600 text-[14px] leading-[24px]">
      Hi {recipientName},<br /><br />
      Your workpack requires revisions before it can be approved.
    </Text>
    <Section className="bg-gray-50 border border-solid border-[#eaeaea] rounded-[8px] p-[16px] mb-[20px]">
      <Text className="m-0 text-[#0D2137] text-[16px] font-bold">
        {workpackNumber}
      </Text>
      <Text className="m-0 text-[#374151] text-[13px]">
        {workpackTitle}
      </Text>
      <Text className="m-0 text-[#6B7280] text-[12px] mt-[8px]">
        Rejected by: {changedBy}
      </Text>
      {notes && (
        <Section className="mt-[10px] p-[10px] bg-[#FEF2F2] border border-solid border-[#FECACA] rounded-[6px]">
          <Text className="m-0 text-[#991B1B] text-[13px] italic">
            "{notes}"
          </Text>
        </Section>
      )}
    </Section>
    <Section className="text-center">
      <Button
        className="bg-[#0D2137] rounded-[8px] color-[#fff] text-[13px] font-bold no-underline text-center px-[28px] py-[10px]"
        style={{ color: '#fff' }}
        href={workpackUrl}
      >
        Edit Workpack →
      </Button>
    </Section>
  </BaseLayout>
);

export default WorkpackRejectedEmail;
