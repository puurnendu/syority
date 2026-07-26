import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import {
    previewNextWorkpackIdCode,
    normaliseUnitCode,
    normaliseDiscCode,
} from '@/lib/workpackId';

/**
 * GET /api/workpacks/preview-id?unit_code=FCC&discipline_code=MECH
 * Returns the NEXT workpack ID code without consuming it.
 * Safe to call on every keystroke.
 */
export async function GET(req: Request) {
    const { session, error } = await guardApi('workpacks.create');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const url = new URL(req.url);
    const unit = url.searchParams.get('unit_code');
    const disc = url.searchParams.get('discipline_code');

    if (!unit?.trim() || !disc?.trim()) {
        return NextResponse.json(
            { error: 'unit_code and discipline_code are required' },
            { status: 400 }
        );
    }

    const preview = await previewNextWorkpackIdCode(
        orgId,
        unit.trim(),
        disc.trim()
    );

    return NextResponse.json({
        preview,
        unit_normalised: normaliseUnitCode(unit),
        disc_normalised: normaliseDiscCode(disc),
    });
}
