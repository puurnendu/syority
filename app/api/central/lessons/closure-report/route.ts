import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import puppeteer from 'puppeteer';

export async function GET() {
    const { session, error } = await guardApi('workpacks.view');
    if (error) return error;
    const { orgId } = orgScope(session!);

    const lessons = await prisma.lessonLearned.findMany({
        where: {
            organization_id: orgId,
            deleted_at: null,
            is_in_central_register: true,
        },
        include: {
            workpack: {
                select: { workpack_id_code: true, title: true },
            },
        },
        orderBy: [{ category: 'asc' }, { created_at: 'desc' }],
    });

    const byCategory = lessons.reduce((acc: Record<string, typeof lessons>, l) => {
        const cat = (l as any).category || 'general';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(l as any);
        return acc;
    }, {});

    function escapeHtml(s: string) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: system-ui, sans-serif; color: #111; line-height: 1.5; font-size: 11px; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 12px; margin-bottom: 24px; }
        .page-break { page-break-after: always; }
        .category-section { margin-bottom: 24px; }
        .category-title { background: #f3f4f6; padding: 8px 12px; font-weight: 700; text-transform: capitalize; margin-bottom: 12px; border-left: 4px solid #2563eb; }
        .lesson { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
        .lesson-title { font-weight: 600; margin-bottom: 6px; }
        .lesson-meta { font-size: 10px; color: #6b7280; margin-bottom: 6px; }
        .lesson-desc { color: #374151; margin-bottom: 6px; }
        .lesson-recommendation { background: #eff6ff; padding: 8px; border-radius: 6px; font-size: 10px; }
    </style>
</head>
<body>
    <div class="page-break">
        <h1>Project Closure Report — Lessons Learned</h1>
        <p class="subtitle">Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · ${lessons.length} lesson(s) in central register</p>
    </div>
    ${Object.entries(byCategory).map(([cat, items]) => `
    <div class="category-section">
        <div class="category-title">${escapeHtml(cat)}</div>
        ${(items as any[]).map((l) => `
        <div class="lesson">
            <div class="lesson-title">${escapeHtml(l.title)}</div>
            <div class="lesson-meta">Workpack: ${escapeHtml(l.workpack?.workpack_id_code ?? '—')} · Impact: ${escapeHtml(String(l.impact))} · ${l.created_at ? new Date(l.created_at).toLocaleDateString('en-GB') : ''}</div>
            <div class="lesson-desc">${escapeHtml(String(l.description || '').slice(0, 500))}${(l.description?.length ?? 0) > 500 ? '…' : ''}</div>
            ${l.recommendation ? `<div class="lesson-recommendation">Recommendation: ${escapeHtml(String(l.recommendation).slice(0, 300))}${(l.recommendation?.length ?? 0) > 300 ? '…' : ''}</div>` : ''}
        </div>
        `).join('')}
    </div>
    `).join('')}
</body>
</html>
`;

    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        });
        await browser.close();
        return new NextResponse(new Blob([pdf as BlobPart]), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Project_Closure_Report_Lessons_${new Date().toISOString().slice(0, 10)}.pdf"`,
            },
        });
    } catch (err) {
        if (browser) await browser.close();
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
