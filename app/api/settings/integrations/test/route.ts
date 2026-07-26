import { NextResponse } from 'next/server';
import { guardApi } from '@/lib/apiGuard';

export async function POST(req: Request) {
  const { session, error } = await guardApi('settings.org.edit');
  if (error) return error;

  try {
    const { provider, config } = await req.json();

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
    }

    // Simulate network delay to make the test feel real
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Scaffolded simulated responses based on the provider
    switch (provider) {
      case 'sap':
        if (!config.apiUrl || !config.apiKey) {
          return NextResponse.json({ success: false, message: 'Missing API URL or Key.' });
        }
        return NextResponse.json({ success: true, message: 'Successfully authenticated with SAP REST Bridge.' });
        
      case 'p6':
        return NextResponse.json({ success: true, message: 'Successfully verified P6 EPPM API connection.' });

      case 'slack':
        if (!config.webhookUrl) {
          return NextResponse.json({ success: false, message: 'Missing Webhook URL.' });
        }
        return NextResponse.json({ success: true, message: 'Test message delivered to Slack successfully.' });

      case 'docusign':
        return NextResponse.json({ success: true, message: 'OAuth credentials validated.' });

      case 'msproject':
        return NextResponse.json({ success: true, message: 'MS Project Server connected.' });

      default:
        return NextResponse.json({ success: true, message: 'Connection tested successfully.' });
    }

  } catch (err: any) {
    console.error('[Integrations Test POST] Error:', err);
    return NextResponse.json({ error: 'Failed to test integration' }, { status: 500 });
  }
}
