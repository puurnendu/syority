import {
  Button,
  Heading,
  Hr,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from './BaseLayout';

interface DigestItem {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string;
}

interface DailyDigestEmailProps {
  recipientName: string;
  items: DigestItem[];
  dashboardUrl: string;
  orgName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export const DailyDigestEmail = ({
  recipientName,
  items,
  dashboardUrl,
  orgName,
  logoUrl,
  primaryColor,
}: DailyDigestEmailProps) => (
  <BaseLayout
    previewText={`Your Daily Activity Summary — ${items.length} updates`}
    orgName={orgName}
    logoUrl={logoUrl}
    primaryColor={primaryColor}
  >
    <Heading className="text-[#0D2137] text-[20px] font-bold p-0 m-0 mb-[16px]">
      Daily Activity Summary
    </Heading>
    <Text className="text-gray-600 text-[14px] leading-[24px] mb-[24px]">
      Hi {recipientName},<br /><br />
      Here is a summary of the activity in <strong>{orgName}</strong> over the last 24 hours.
    </Text>

    {items.map((item, index) => (
      <Section key={item.id} className="mb-[16px]">
        <Section className="bg-gray-50 border border-solid border-[#eaeaea] rounded-[8px] p-[16px]">
          <Text className="m-0 text-[#9CA3AF] text-[10px] uppercase font-bold tracking-wider mb-[4px]">
            {item.type.replace('.', ' ')}
          </Text>
          <Text className="m-0 text-[#0D2137] text-[14px] font-bold mb-[2px]">
            {item.title}
          </Text>
          <Text className="m-0 text-[#374151] text-[13px] mb-[8px]">
            {item.message}
          </Text>
          <Button
            className="text-[#4F46E5] text-[12px] font-bold no-underline"
            href={item.actionUrl}
          >
            View Details →
          </Button>
        </Section>
      </Section>
    ))}

    <Section className="text-center mt-[32px]">
      <Button
        className="bg-[#0D2137] rounded-[8px] color-[#fff] text-[14px] font-bold no-underline text-center px-[40px] py-[14px]"
        style={{ color: '#fff' }}
        href={dashboardUrl}
      >
        Go to Dashboard
      </Button>
    </Section>
  </BaseLayout>
);

export default DailyDigestEmail;
