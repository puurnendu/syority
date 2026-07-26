import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface BaseLayoutProps {
  previewText: string;
  children: React.ReactNode;
  orgName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export const BaseLayout = ({
  previewText,
  children,
  orgName = 'AURIANOA OS',
  logoUrl,
  primaryColor = '#4F46E5',
}: BaseLayoutProps) => (
  <Html>
    <Head />
    <Preview>{previewText}</Preview>
    <Tailwind>
      <Body className="bg-gray-100 my-auto mx-auto font-sans">
        <Container className="bg-white border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[580px]">
          <Section className="mt-[32px] mb-[32px] text-center">
            {logoUrl ? (
              <Img
                src={logoUrl}
                width="140"
                height="40"
                alt={orgName}
                className="mx-auto my-0"
              />
            ) : (
              <Text className="m-0 font-bold text-2xl tracking-widest text-[#0D2137]">
                AURIANOA <span className="text-gray-400 text-sm">OS</span>
              </Text>
            )}
            {orgName && orgName !== 'AURIANOA OS' && (
                <Text className="text-gray-400 text-xs mt-1 lowercase">{orgName}</Text>
            )}
          </Section>
          <Hr className="border-0 border-solid my-0 mx-0 w-full" style={{ borderTop: `3px solid ${primaryColor}`, background: primaryColor }} />
          <Section className="px-[32px] py-[32px]">
            {children}
          </Section>
          <Hr className="border border-solid border-[#eaeaea] my-[0px] mx-0 w-full" />
          <Section className="bg-gray-50 px-[32px] py-[20px] rounded-b">
            <Text className="text-[#9CA3AF] text-[11px] leading-[1.6] text-center m-0">
                AURIANOA OS — Industrial Workpack Management<br />
                {orgName ? `Sent on behalf of ${orgName}. ` : ''}Do not reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);
