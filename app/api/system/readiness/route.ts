import { NextResponse } from 'next/server';
import { getSystemReadiness } from '@/lib/system/readiness';

export async function GET() {
    try {
        const readiness = await getSystemReadiness();
        return NextResponse.json(readiness);
    } catch (error) {
        console.error('[API] Error checking system readiness:', error);
        return NextResponse.json(
            {
                isReady: false,
                checks: {
                    hasOrganization: false,
                    hasRole: false,
                    hasUser: false,
                    hasAiProvider: false,
                },
            },
            { status: 500 }
        );
    }
}
