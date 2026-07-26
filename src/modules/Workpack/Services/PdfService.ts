import { existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import { prisma } from '@/lib/prisma';
import { CertificateService } from '@/modules/certificates/services/CertificateService';
import { renderBandHtml } from '@/lib/renderZoneItemHtml';
import { resolveVariables } from '@/lib/printVariables';
import type { HeaderFooterZones } from '@/types/printSettings.types';
import { parseZones, DEFAULT_HEADER_ZONES, DEFAULT_FOOTER_ZONES } from '@/lib/printSettingsZones';
import { MATERIAL_DISCIPLINES } from '@/lib/materials/disciplines';
import { appUrl } from '@/lib/appUrl';

const MAX_MERGED_PDF_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * Strip or replace characters that WinAnsi PDF encoding cannot handle.
 * Prevents "WinAnsi cannot encode" crash for Unicode symbols (e.g. ▲ ⚠ ✓).
 */
function sanitiseForPdf(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return str
        .replace(/⚠|▲|△/g, '!')
        .replace(/✓|✔/g, 'Y')
        .replace(/✗|✘|✕/g, 'N')
        .replace(/→|►|▶/g, '->')
        .replace(/←|◄|◀/g, '<-')
        .replace(/★|☆/g, '*')
        .replace(/•|·/g, '-')
        .replace(/—/g, '--')
        .replace(/–/g, '-')
        .replace(/"/g, '"')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/'/g, "'")
        .replace(/…/g, '...')
        .replace(/°/g, ' deg')
        .replace(/²/g, '2')
        .replace(/³/g, '3')
        .replace(/[^\x00-\xFF]/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim();
}

interface IndexEntry {
    sectionCode: string;
    title: string;
    pageRef?: string;
    isGroup?: boolean;
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
    return arr.reduce((acc, item) => {
        const k = String(item[key]);
        if (!acc[k]) acc[k] = [];
        acc[k].push(item);
        return acc;
    }, {} as Record<string, T[]>);
}

function buildWorkpackIndex(workpack: any, pdfColumns: any, extra: any): IndexEntry[] {
    const entries: IndexEntry[] = [];

    entries.push({ sectionCode: 'A', title: 'Cover Page & Work Pack Details' });
    entries.push({ sectionCode: 'B', title: 'Revision History' });
    entries.push({ sectionCode: 'C', title: 'Equipment Technical Data' });
    entries.push({ sectionCode: 'D', title: 'Scope of Work' });
    entries.push({ sectionCode: 'E', title: 'Operations / Activity Register' });

    if (workpack.joint_integrity_items?.length > 0) {
        entries.push({ sectionCode: 'G', title: 'Maintenance Hold Points' });
        entries.push({ sectionCode: 'H', title: 'Inspection Hold Points' });
    }

    if (pdfColumns?.showElectrical) {
        entries.push({ sectionCode: 'I', title: 'Electrical Requirements' });
    }

    entries.push({ sectionCode: 'J', title: 'Materials List' });
    entries.push({ sectionCode: 'K', title: 'Blind Register / Joint Register' });

    if (Array.isArray(extra?.boxupData?.joints) && extra.boxupData.joints.length > 0) {
        entries.push({ sectionCode: '04', title: 'Flange Boxup Cert' });
    }

    const hydroActivities = Array.isArray(extra?.hydroData?.activities) && extra.hydroData.activities.length > 0
        ? extra.hydroData.activities
        : (workpack.activities ?? []).filter((a: any) => /hydro|test|pressure|shell test|tube test/i.test(a.description || a.name || ''));
    if (hydroActivities.length > 0) {
        entries.push({ sectionCode: '05', title: 'Hydrotest Cert' });
    }

    if (extra?.constraintItems?.length > 0) {
        entries.push({ sectionCode: '07', title: 'Open Constraints' });
    }

    if (workpack.cleaning_records?.length > 0) {
        entries.push({ sectionCode: '08', title: 'Cleaning Records' });
    }

    // Attachment groups (WorkpackAttachment template-based)
    const attachmentGroups = groupBy(workpack.attachments?.filter((a: any) => a.isActive) ?? [], 'group');

    const GROUP_ORDER = ['procedures', 'certificates', 'checklists', 'reports', 'jsas'];
    const GROUP_LABELS: Record<string, string> = {
        procedures: 'Procedures',
        certificates: 'Certificates',
        checklists: 'Checklists',
        reports: 'Test Reports',
        jsas: 'Job Safety Analysis (JSA)',
    };

    let attachIdx = 1;
    for (const groupKey of GROUP_ORDER) {
        const items = attachmentGroups[groupKey];
        if (!items?.length) continue;

        entries.push({ sectionCode: `Attachment ${attachIdx}`, title: GROUP_LABELS[groupKey] ?? groupKey, isGroup: true });
        items.forEach((att: any, i: number) => {
            entries.push({ sectionCode: `${attachIdx}.${i + 1}`, title: att.title });
        });
        attachIdx++;
    }

    return entries;
}

function renderIndexPageHtml(entries: IndexEntry[]): string {
    const rows = entries.map(e => `
      <tr>
        <td style="font-weight: ${e.isGroup ? 'bold' : 'normal'}; padding-left: ${e.isGroup ? '8px' : '16px'}; border: 1px solid #e5e7eb; padding: 6px 8px;">${sanitiseForPdf(e.sectionCode)}</td>
        <td style="font-weight: ${e.isGroup ? 'bold' : 'normal'}; border: 1px solid #e5e7eb; padding: 6px 8px;">${sanitiseForPdf(e.title)}</td>
        <td style="text-align: center; border: 1px solid #e5e7eb; padding: 6px 8px;">—</td>
      </tr>
    `).join('');
  
    return `
      <div class="header">
          <span class="title">TABLE OF CONTENTS</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
              <tr>
                  <th style="width: 20%; background: #f9fafb; font-weight: 700; text-transform: uppercase; font-size: 8px; color: #6b7280; border: 1px solid #e5e7eb; padding: 6px 8px;">Section</th>
                  <th style="width: 65%; background: #f9fafb; font-weight: 700; text-transform: uppercase; font-size: 8px; color: #6b7280; border: 1px solid #e5e7eb; padding: 6px 8px;">Description</th>
                  <th style="width: 15%; text-align: center; background: #f9fafb; font-weight: 700; text-transform: uppercase; font-size: 8px; color: #6b7280; border: 1px solid #e5e7eb; padding: 6px 8px;">Page</th>
              </tr>
          </thead>
          <tbody>
              ${rows}
          </tbody>
      </table>
      <div class="page-break"></div>
    `;
}

/** Load logo from org path (file or URL) or public folder; return base64 data URL for PDF header. */
function loadLogoBase64(orgLogoPath?: string | null): string {
    try {
        if (orgLogoPath) {
            const relativePath = orgLogoPath.startsWith('/') ? orgLogoPath.slice(1) : orgLogoPath;
            const absolutePath = path.join(process.cwd(), 'public', relativePath);
            if (existsSync(absolutePath)) {
                const ext = path.extname(absolutePath).replace('.', '') || 'png';
                const mime = ext === 'svg' ? 'svg+xml' : ext;
                const b64 = readFileSync(absolutePath).toString('base64');
                return `data:image/${mime};base64,${b64}`;
            }
        }

        const candidates = [
            path.join(process.cwd(), 'public', 'logo.png'),
            path.join(process.cwd(), 'public', 'logo.svg'),
            path.join(process.cwd(), 'public', 'logo.webp'),
            path.join(process.cwd(), 'public', 'logo.jpg'),
            path.join(process.cwd(), 'public', 'logos', 'logo.png'),
            path.join(process.cwd(), 'public', 'images', 'logo.png'),
            path.join(process.cwd(), 'public', 'assets', 'logo.png'),
        ];
        for (const p of candidates) {
            if (existsSync(p)) {
                const ext = path.extname(p).replace('.', '');
                const mime = ext === 'svg' ? 'svg+xml' : ext;
                const b64 = readFileSync(p).toString('base64');
                return `data:image/${mime};base64,${b64}`;
            }
        }
        return '';
    } catch (e) {
        console.warn('[PDF] loadLogoBase64 error:', e);
        return '';
    }
}

/** Load org logo from URL or path; returns Buffer or null. Use for PDF when fetch is available. */
async function loadOrgLogo(org: { logo_path?: string | null; logo_url?: string | null; logo?: string | null }): Promise<Buffer | null> {
    try {
        const logoUrl = org?.logo_url ?? org?.logo ?? org?.logo_path ?? null;
        if (!logoUrl) return null;
        const fullUrl = logoUrl.startsWith('http')
            ? logoUrl
            : appUrl(logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`);
        const res = await fetch(fullUrl, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch (err) {
        console.warn('[PDF] Logo load failed:', err);
        return null;
    }
}

/** Build cover page HTML (full single-page document). Uses cover_page_settings when provided. */
function buildCoverPageHtml(
    workpack: any,
    coverSettings: any,
    logoDataUrl: string,
    _orgName: string,
): string {
    const heroH = coverSettings?.heroHeightPercent ?? 60;
    const heroBg = coverSettings?.heroBgColor ?? '#1e3a5f';
    const logoPos = coverSettings?.logo_alignment ?? coverSettings?.logoPosition ?? 'left';
    const logoSz = coverSettings?.logoSize ?? 48;
    const titleSz = coverSettings?.titleSize ?? 32;
    const titleWt = coverSettings?.titleWeight === 'black'
        ? '900'
        : coverSettings?.titleWeight === 'bold'
            ? '700'
            : '400';
    const titleAlign = coverSettings?.titlePosition ?? 'center';
    const subText = resolveVariables(
        coverSettings?.subtitleText ?? '{org_name} | {site_name}',
        workpack,
    );

    const logoHtml = (coverSettings?.showLogo !== false) && logoDataUrl
        ? `<img src="${logoDataUrl}" style="height:${logoSz}px; max-width:200px; object-fit:contain; display:block;" />`
        : '';

    const logoContainerStyle: Record<string, string> = {
        left: 'justify-content:flex-start;',
        center: 'justify-content:center;',
        right: 'justify-content:flex-end;',
    };
    const logoJustify = logoContainerStyle[logoPos as string] ?? 'justify-content:flex-start;';

    const body = `
    <div style="
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
    ">
      <div style="
        width: 100%;
        height: ${heroH}%;
        background-color: ${heroBg};
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: ${titleAlign === 'center' ? 'center' : 'flex-start'};
        padding: 40px 48px;
        box-sizing: border-box;
        flex-shrink: 0;
      ">
        ${logoHtml ? `<div style="display:flex; ${logoJustify} margin-bottom:32px; width:100%;"><div>${logoHtml}</div></div>` : ''}
        ${coverSettings?.showTitle !== false ? `
          <div style="
            font-size: ${titleSz}px;
            font-weight: ${titleWt};
            color: ${coverSettings?.titleColor ?? '#ffffff'};
            text-align: ${titleAlign};
            line-height: 1.2;
            margin-bottom: 16px;
            width: 100%;
          ">${sanitiseForPdf(workpack.title ?? '')}</div>` : ''}
        ${coverSettings?.showSubtitle !== false ? `
          <div style="
            font-size: ${coverSettings?.subtitleSize ?? 14}px;
            color: ${coverSettings?.subtitleColor ?? '#ffffff'};
            text-align: ${titleAlign};
            opacity: 0.85;
            margin-bottom: 24px;
          ">${sanitiseForPdf(subText)}</div>` : ''}
        ${coverSettings?.showMeta !== false ? `
          <div style="
            font-size: ${coverSettings?.metaSize ?? 11}px;
            color: ${coverSettings?.metaColor ?? '#ffffff'};
            text-align: ${titleAlign};
            opacity: 0.7;
            letter-spacing: 0.5px;
          ">
            REVISION: ${sanitiseForPdf(workpack.revision ?? 'R0')}
            &nbsp;&nbsp;&bull;&nbsp;&nbsp;
            ${sanitiseForPdf(String(workpack.priority ?? 'medium').toUpperCase())} PRIORITY
            &nbsp;&nbsp;&bull;&nbsp;&nbsp;
            CONTRACTOR: ${sanitiseForPdf(workpack.contractor?.name ?? workpack.contractor ?? 'In-House')}
          </div>` : ''}
      </div>
      <div style="width: 100%; height: 4px; background: linear-gradient(90deg, #f97316 0%, #ea580c 100%); flex-shrink: 0;"></div>
      <div style="
        flex: 1;
        background: #ffffff;
        padding: 32px 48px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      ">
        ${coverSettings?.showWpNumber !== false ? `
          <div style="
            font-size: ${coverSettings?.wpNumberSize ?? 16}px;
            font-weight: 700;
            color: ${coverSettings?.wpNumberColor ?? heroBg};
            margin-bottom: 8px;
          ">${sanitiseForPdf(workpack.workpack_number ?? '')}</div>` : ''}
        ${coverSettings?.showScopePreview && workpack.scope_of_work ? `
          <div style="
            font-size: 10px;
            color: #6b7280;
            line-height: 1.5;
            max-height: 48px;
            overflow: hidden;
          ">${sanitiseForPdf(String(workpack.scope_of_work)).slice(0, 200)}...</div>` : ''}
      </div>
    </div>
  `;
    return `<!DOCTYPE html><html><head><style>body{margin:0;padding:0;height:100vh;}</style></head><body>${body}</body></html>`;
}

/** Build last page HTML (full single-page document). */
function buildLastPageHtml(workpack: any, lastSettings: any, logoDataUrl: string): string {
    if (!lastSettings?.enabled) return '';
    const bg = lastSettings?.bgColor ?? '#1e3a5f';

    const sigBlock = lastSettings?.showSignatureBlock
        ? `
    <div style="
      display: flex;
      gap: 32px;
      margin-top: 48px;
      padding-top: 32px;
    ">
      ${[
            lastSettings.signatureLabel1 ?? 'Prepared by',
            lastSettings.signatureLabel2 ?? 'Reviewed by',
            lastSettings.signatureLabel3 ?? 'Approved by',
        ]
            .map(
                (label: string) => `
        <div style="flex:1; border-top:1px solid rgba(255,255,255,0.3); padding-top:8px;">
          <div style="font-size:9px; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:0.5px;">
            ${sanitiseForPdf(label)}
          </div>
          <div style="font-size:9px; color:rgba(255,255,255,0.4); margin-top:20px;">
            Name / Date
          </div>
        </div>
      `,
            )
            .join('')}
    </div>`
        : '';

    const logoHtml =
        (lastSettings?.logoOnLastPage !== false) && logoDataUrl
            ? `<img src="${logoDataUrl}" style="height:40px; object-fit:contain; display:block; ${lastSettings?.logoPosition === 'left' ? '' : 'margin:0 auto;'}" />`
            : '';

    const controlledText =
        lastSettings.controlledNoteText ??
        'Controlled when printed — verify against live system';

    const body = `
    <div style="
      width:100%; height:100%;
      background-color: ${bg};
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      padding:60px 48px;
      box-sizing:border-box;
      font-family:Arial,Helvetica,sans-serif;
      position:relative;
      min-height:100vh;
    ">
      ${logoHtml ? `<div style="margin-bottom:32px;">${logoHtml}</div>` : ''}
      ${lastSettings?.customText ? `
        <div style="
          font-size:${lastSettings.customTextSize ?? 11}px;
          color:${lastSettings.customTextColor ?? '#cccccc'};
          text-align:center;
          max-width:480px;
          line-height:1.6;
          margin-bottom:24px;
        ">${sanitiseForPdf(lastSettings.customText)}</div>` : ''}
      ${sigBlock}
      <div style="
        position:absolute;
        bottom:32px;
        left:0; right:0;
        text-align:center;
      ">
        ${lastSettings?.showGeneratedDate ? `
          <div style="font-size:8px; color:rgba(255,255,255,0.4); margin-bottom:4px;">
            Generated: ${new Date().toLocaleDateString('en-GB')}
          </div>` : ''}
        ${lastSettings?.showControlledNote ? `
          <div style="font-size:8px; color:rgba(255,255,255,0.4);">
            ${sanitiseForPdf(controlledText)}
          </div>` : ''}
      </div>
    </div>
  `;
    return `<!DOCTYPE html><html><head><style>body{margin:0;padding:0;}</style></head><body>${body}</body></html>`;
}

/** Clone header/footer zones and inject base64 logo into image items, or replace with AURIANOA text when no logo. */
function injectLogoIntoZones(zones: HeaderFooterZones, logoBase64: string): HeaderFooterZones {
    const clone = JSON.parse(JSON.stringify(zones)) as HeaderFooterZones;
    const processItems = (items: { type?: string; imageUrl?: string; id?: string }[]) => {
        items?.forEach((item) => {
            if (item.type === 'image') {
                if (logoBase64) {
                    item.imageUrl = logoBase64;
                } else {
                    // Text fallback when no logo file found
                    (item as { type: string; text?: string; fontSize?: number; fontWeight?: string; color?: string }).type = 'text';
                    (item as { text?: string }).text = 'AURIANOA';
                    (item as { fontSize?: number }).fontSize = 16;
                    (item as { fontWeight?: string }).fontWeight = 'bold';
                    (item as { color?: string }).color = 'white';
                    delete (item as { imageUrl?: string }).imageUrl;
                }
            }
        });
    };
    processItems(clone.left?.items ?? []);
    processItems(clone.center?.items ?? []);
    processItems(clone.right?.items ?? []);
    return clone;
}

type WorkpackDocumentForMerge = {
    id: string;
    document_type: string | null;
    original_filename: string;
    storage_path: string;
    mime_type: string | null;
    description: string | null;
    created_at: Date;
};

async function fetchFileBuffer(doc: WorkpackDocumentForMerge): Promise<Buffer> {
    const isAbs = path.isAbsolute(doc.storage_path);
    const storagePath = isAbs
        ? doc.storage_path
        : path.join(process.cwd(), doc.storage_path);

    if (!existsSync(storagePath)) {
        throw new Error(`File not found on server (Missing: ${doc.storage_path.split('/').pop()})`);
    }

    const buf = await readFile(storagePath);
    return Buffer.from(buf);
}

function getMimeType(doc: WorkpackDocumentForMerge): string {
    if (doc.mime_type?.trim()) return doc.mime_type.trim();
    const ext = doc.original_filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
    };
    return map[ext || ''] || 'application/octet-stream';
}

function groupAttachments(attachments: WorkpackDocumentForMerge[]): Record<string, WorkpackDocumentForMerge[]> {
    const docs: WorkpackDocumentForMerge[] = [];
    const drawings: WorkpackDocumentForMerge[] = [];
    const procedures: WorkpackDocumentForMerge[] = [];
    const certificates: WorkpackDocumentForMerge[] = [];
    const images: WorkpackDocumentForMerge[] = [];

    for (const a of attachments) {
        const type = (a.document_type ?? 'attachment').toLowerCase();
        const mime = getMimeType(a);
        if (['drawing'].includes(type) || /\.dwg|\.dxf|p&id|pid/i.test(a.original_filename)) {
            drawings.push(a);
        } else if (['procedure', 'jsa', 'method_statement'].includes(type)) {
            procedures.push(a);
        } else if (type === 'certificate') {
            certificates.push(a);
        } else if (['image', 'photo'].includes(type) || mime.startsWith('image/')) {
            images.push(a);
        } else {
            docs.push(a);
        }
    }

    return {
        'Documents': docs,
        'Drawings & P&IDs': drawings,
        'Procedures / JSA': procedures,
        'Certificates': certificates,
        'Images': images,
    };
}

function getDefaultDescription(
    name: string,
    type: string,
    mimeType?: string | null,
): string {
    const n = name.toLowerCase();
    const t = (type || '').toLowerCase();

    if (n.includes('ga') || n.includes('general arrangement')) return 'General Arrangement Drawing';
    if (n.includes('rigging')) return 'Rigging & Lifting Plan';
    if (n.includes('qap') || n.includes('quality assurance')) return 'Quality Assurance Plan';
    if (n.includes('oem') || n.includes('manual')) return 'OEM Technical Manual';
    if (n.includes('itp') || n.includes('inspection test')) return 'Inspection & Test Plan';
    if (n.includes('wps') || n.includes('welding procedure')) return 'Welding Procedure Specification';
    if (n.includes('jsa') || n.includes('job safety')) return 'Job Safety Analysis';
    if (n.includes('procedure')) return 'Work Procedure Document';
    if (n.includes('certificate') || n.includes('cert')) return 'Certificate / Compliance Document';
    if (n.includes('drawing') || n.includes('dwg') || n.includes('p&id')) return 'Engineering Drawing';
    if (n.includes('schedule') || n.includes('planning')) return 'Planning / Schedule Document';
    if (n.includes('dossier') || n.includes('workpack')) return 'Workpack Dossier';
    if (mimeType?.includes('spreadsheet') || n.endsWith('.xlsx') || n.endsWith('.xls')) return 'Spreadsheet / Data Sheet';
    if (t === 'certificate') return 'Inspection Certificate';
    if (t === 'drawing') return 'Technical Drawing';
    if (t === 'procedure') return 'Procedure Document';

    return 'Supporting Document';
}

async function addDividerPage(
    pdf: PDFDocument,
    title: string,
    docs: WorkpackDocumentForMerge[],
) {
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

    // Dark header band
    page.drawRectangle({
        x: 0, y: 680, width: 595, height: 162,
        color: rgb(0.05, 0.13, 0.22),
    });
    page.drawRectangle({
        x: 0, y: 838, width: 595, height: 4,
        color: rgb(0.91, 0.44, 0.10),
    });
    page.drawText(sanitiseForPdf(title).toUpperCase(), {
        x: 48, y: 760, size: 26, font,
        color: rgb(1, 1, 1),
    });
    page.drawText(
        sanitiseForPdf(`${docs.length} ${docs.length === 1 ? 'document' : 'documents'} attached`),
        { x: 48, y: 725, size: 12, font: regular, color: rgb(0.65, 0.75, 0.85) },
    );

    // Index table
    const tableTop = 650;
    page.drawLine({
        start: { x: 48, y: tableTop + 4 },
        end: { x: 547, y: tableTop + 4 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
    });
    page.drawText('NO.', { x: 48, y: tableTop - 10, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('DOCUMENT NAME', { x: 72, y: tableTop - 10, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('TYPE', { x: 340, y: tableTop - 10, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('DESCRIPTION', { x: 400, y: tableTop - 10, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawLine({
        start: { x: 48, y: tableTop - 16 },
        end: { x: 547, y: tableTop - 16 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
    });

    const rowHeight = 28;
    let y = tableTop - 16;

    docs.forEach((doc, index) => {
        y -= rowHeight;

        if (index % 2 === 0) {
            page.drawRectangle({
                x: 48, y: y - 6,
                width: 499, height: rowHeight,
                color: rgb(0.97, 0.97, 0.98),
            });
        }

        page.drawText(`${index + 1}`, {
            x: 52, y: y + 6, size: 9, font,
            color: rgb(0.5, 0.5, 0.5),
        });

        const name = doc.original_filename.length > 38
            ? doc.original_filename.substring(0, 35) + '...'
            : doc.original_filename;
        page.drawText(sanitiseForPdf(name), {
            x: 72, y: y + 6, size: 9, font: regular,
            color: rgb(0.1, 0.1, 0.1),
        });

        const ext = doc.original_filename.split('.').pop()?.toUpperCase()
            ?? doc.mime_type?.split('/').pop()?.toUpperCase()
            ?? '—';
        page.drawText(sanitiseForPdf(ext).substring(0, 6), {
            x: 340, y: y + 6, size: 8, font,
            color: rgb(0.2, 0.4, 0.7),
        });

        const description = doc.description?.trim()
            || getDefaultDescription(doc.original_filename, doc.document_type ?? 'attachment', doc.mime_type);
        const desc = description.length > 28 ? description.substring(0, 25) + '...' : description;
        page.drawText(sanitiseForPdf(desc), {
            x: 400, y: y + 6, size: 8, font: italic,
            color: rgb(0.4, 0.4, 0.4),
        });

        page.drawLine({
            start: { x: 48, y: y - 6 },
            end: { x: 547, y: y - 6 },
            thickness: 0.3,
            color: rgb(0.9, 0.9, 0.9),
        });
    });

    page.drawText(
        'Documents appended on following pages - verify originals in the system',
        { x: 48, y: 30, size: 8, font: regular, color: rgb(0.5, 0.5, 0.5) },
    );
}

async function addPlaceholderPage(
    pdf: PDFDocument,
    name: string,
    message: string,
) {
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText('Document not embedded', {
        x: 60, y: 700, size: 14, font: bold,
        color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(sanitiseForPdf(`File: ${name}`), {
        x: 60, y: 670, size: 11, font,
        color: rgb(0.4, 0.4, 0.4),
    });
    page.drawText(sanitiseForPdf(message), {
        x: 60, y: 648, size: 10, font,
        color: rgb(0.5, 0.5, 0.5),
    });
}

async function addErrorPage(
    pdf: PDFDocument,
    name: string,
    reason: string,
) {
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText('! Attachment could not be included', {
        x: 60, y: 700, size: 14, font: bold,
        color: rgb(0.86, 0.15, 0.15),
    });
    page.drawText(sanitiseForPdf(`File: ${name}`), {
        x: 60, y: 670, size: 11, font,
        color: rgb(0.2, 0.2, 0.2),
    });
    page.drawText(sanitiseForPdf(`Reason: ${reason}`), {
        x: 60, y: 648, size: 10, font,
        color: rgb(0.5, 0.5, 0.5),
    });
    page.drawText('Please refer to the original file attached to this workpack.', {
        x: 60, y: 620, size: 10, font,
        color: rgb(0.4, 0.4, 0.4),
    });
}

async function appendImagePage(
    pdf: PDFDocument,
    buffer: Buffer,
    mimeType: string,
    name: string,
) {
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let image;
    try {
        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            image = await pdf.embedJpg(buffer);
        } else if (mimeType === 'image/png') {
            image = await pdf.embedPng(buffer);
        } else {
            await addPlaceholderPage(pdf, name, 'Image format not supported for embedding');
            return;
        }
    } catch {
        await addPlaceholderPage(pdf, name, 'Image could not be embedded');
        return;
    }
    const margin = 60;
    const maxW = 595 - margin * 2;
    const maxH = 842 - margin * 2 - 40;
    const scale = Math.min(maxW / image.width, maxH / image.height, 1);
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (595 - w) / 2;
    const y = (842 - h) / 2;
    page.drawImage(image, { x, y, width: w, height: h });
    page.drawText(sanitiseForPdf(name), {
        x: margin, y: 30, size: 8, font,
        color: rgb(0.5, 0.5, 0.5),
    });
}

async function convertDocxToPdf(buffer: Buffer, originalFilename: string): Promise<Buffer> {
    const mammoth = await import('mammoth');
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const rawHtml = htmlResult.value;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
                    line-height: 1.5;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    font-size: 12px;
                }
                h1, h2, h3, h4, h5, h6 { color: #111; margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
                h1 { font-size: 20px; }
                h2 { font-size: 16px; }
                h3 { font-size: 14px; }
                p { margin-bottom: 1em; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 1.5em; font-size: 10px; }
                th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
                th { background-color: #f9fafb; font-weight: 600; color: #4b5563; }
                img { max-width: 100%; height: auto; margin: 1em 0; }
                ul, ol { padding-left: 20px; margin-bottom: 1em; }
                li { margin-bottom: 0.25em; }
            </style>
        </head>
        <body>
            <div style="margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 9px; margin: 0; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Converted Word Document</p>
                <h1 style="font-size: 18px; margin: 4px 0 0 0; color: #111827;">${sanitiseForPdf(originalFilename)}</h1>
            </div>
            ${rawHtml}
        </body>
        </html>
    `;

    const { getBrowser } = await import('@/lib/puppeteer');
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set a very generous timeout for document rendering
    page.setDefaultTimeout(60000);

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    const pdfBuf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
    });

    await page.close();
    return Buffer.from(pdfBuf);
}

async function appendAttachment(
    mergedPdf: PDFDocument,
    doc: WorkpackDocumentForMerge,
    fileBuffer?: Buffer,
): Promise<void> {
    const mimeType = getMimeType(doc);
    const name = doc.original_filename || 'document';
    const buffer = fileBuffer ?? await fetchFileBuffer(doc);

    if (mimeType === 'application/pdf') {
        const attachDoc = await PDFDocument.load(new Uint8Array(buffer));
        const indices = attachDoc.getPageIndices();
        const pages = await mergedPdf.copyPages(attachDoc, indices);
        pages.forEach((p: PDFPage) => mergedPdf.addPage(p));
        return;
    }

    if (mimeType.startsWith('image/')) {
        await appendImagePage(mergedPdf, buffer, mimeType, name);
        return;
    }

    if (mimeType.includes('word') || /\.docx?$/i.test(doc.original_filename)) {
        try {
            const pdfBuffer = await convertDocxToPdf(buffer, name);
            const attachDoc = await PDFDocument.load(new Uint8Array(pdfBuffer));
            const indices = attachDoc.getPageIndices();
            const pages = await mergedPdf.copyPages(attachDoc, indices);
            pages.forEach((p: PDFPage) => mergedPdf.addPage(p));
            return;
        } catch (e) {
            console.error('Failed to convert DOCX', e);
            await addPlaceholderPage(mergedPdf, name, 'Word document conversion failed — open original file to view');
            return;
        }
    }

    await addPlaceholderPage(mergedPdf, name, 'File type not supported for embedding in PDF');
}

async function addEndPage(pdf: PDFDocument, _workpackId: string) {
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawRectangle({
        x: 0, y: 0, width: 595, height: 842,
        color: rgb(0.05, 0.13, 0.22),
    });
    page.drawRectangle({
        x: 0, y: 838, width: 595, height: 4,
        color: rgb(0.91, 0.44, 0.10),
    });
    page.drawText('END OF WORKPACK DOCUMENT', {
        x: 60, y: 430, size: 22, font,
        color: rgb(1, 1, 1),
    });
    page.drawText(sanitiseForPdf(`Generated: ${new Date().toLocaleDateString()} `), {
        x: 60, y: 395, size: 11, font: regular,
        color: rgb(0.6, 0.7, 0.8),
    });
    page.drawText('Controlled when printed - verify against live system', {
        x: 60, y: 60, size: 8, font: regular,
        color: rgb(0.4, 0.5, 0.6),
    });
}

export class PdfService {
    static async generateMergedPdf(workpackId: string, orgId: string): Promise<{ buffer: Buffer; warning?: string }> {
        const workpackResult = await PdfService.generateWorkpackPdf(workpackId, orgId, { forMerge: true });
        const workpackPdfBuffer = 'buffer' in workpackResult ? workpackResult.buffer : Buffer.isBuffer(workpackResult) ? workpackResult : Buffer.from(workpackResult as ArrayBuffer);
        const lastPageBuffer = 'lastPageBuffer' in workpackResult ? workpackResult.lastPageBuffer : null;

        const attachments = await prisma.workpackDocument.findMany({
            where: {
                workpack_id: workpackId,
                organization_id: orgId,
                deleted_at: null,
                include_in_pdf: true,
            },
            orderBy: [{ document_type: 'asc' }, { created_at: 'asc' }],
            select: {
                id: true,
                document_type: true,
                original_filename: true,
                storage_path: true,
                mime_type: true,
                description: true,
                created_at: true,
            },
        });

        if (attachments.length === 0) {
            const single = await PdfService.generateWorkpackPdf(workpackId, orgId);
            const buf = Buffer.isBuffer(single) ? single : 'buffer' in single ? single.buffer : Buffer.from((single as any) as ArrayBuffer);
            return { buffer: buf };
        }

        const mergedPdf = await PDFDocument.create();
        const wpBuf = Buffer.isBuffer(workpackPdfBuffer) ? workpackPdfBuffer : Buffer.from(workpackPdfBuffer as ArrayBuffer);
        const workpackDoc = await PDFDocument.load(new Uint8Array(wpBuf));
        const workpackPageIndices = workpackDoc.getPageIndices();
        const workpackPages = await mergedPdf.copyPages(workpackDoc, workpackPageIndices);
        workpackPages.forEach((p: PDFPage) => mergedPdf.addPage(p));

        const groups = groupAttachments(attachments as WorkpackDocumentForMerge[]);
        let totalSize = wpBuf.length;
        const errorCount = { value: 0 };

        for (const [groupName, docs] of Object.entries(groups)) {
            if (docs.length === 0) continue;

            await addDividerPage(mergedPdf, groupName, docs);

            for (const doc of docs) {
                try {
                    const fileBuffer = await fetchFileBuffer(doc);
                    totalSize += Buffer.isBuffer(fileBuffer) ? fileBuffer.length : (fileBuffer as ArrayBuffer).byteLength;
                    if (totalSize > MAX_MERGED_PDF_BYTES) {
                        await addErrorPage(mergedPdf, doc.original_filename, 'Total size exceeded 100MB — attachment excluded');
                        errorCount.value++;
                        continue;
                    }
                    await appendAttachment(mergedPdf, doc, fileBuffer);
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Unknown error';
                    await addErrorPage(mergedPdf, doc.original_filename, `Could not load attachment: ${message} `);
                    errorCount.value++;
                }
            }
        }

        if (lastPageBuffer) {
            const lastBuf = Buffer.isBuffer(lastPageBuffer) ? lastPageBuffer : Buffer.from(lastPageBuffer as ArrayBuffer);
            const lastDoc = await PDFDocument.load(new Uint8Array(lastBuf));
            const lastPages = await mergedPdf.copyPages(lastDoc, lastDoc.getPageIndices());
            lastPages.forEach((p: PDFPage) => mergedPdf.addPage(p));
        } else {
            await addEndPage(mergedPdf, workpackId);
        }

        const mergedBytes = await mergedPdf.save();
        const result = Buffer.from(mergedBytes);

        if (result.length > MAX_MERGED_PDF_BYTES) {
            return { buffer: wpBuf, warning: 'Attachments excluded — total size exceeded 100MB' };
        }
        return { buffer: result, warning: errorCount.value > 0 ? `${errorCount.value} attachment(s) could not be included` : undefined };
    }

    static async generateWorkpackPdf(
        workpackId: string,
        orgId: string,
        options?: { forMerge?: boolean }
    ): Promise<Buffer | { buffer: Buffer; lastPageBuffer: Buffer | null }> {
        const workpack = await prisma.workpack.findFirst({
            where: { id: workpackId, organization_id: orgId },
            include: {
                activities: {
                    where: { deleted_at: null },
                    orderBy: { sequence_number: 'asc' },
                    include: {
                        discipline: true,
                        udf_values: true,
                        resources: { include: { resource: true } },
                        qa_clearance_records: true,
                        predecessors: { include: { predecessor: { select: { activity_number: true, description: true } } } },
                    },
                },
                joint_integrity_items: { where: { deleted_at: null }, orderBy: { joint_number: 'asc' } },
                blinds: { where: { deleted_at: null }, orderBy: { blind_number: 'asc' } },
                workpack_materials: { where: { deleted_at: null } },
                workpack_material_lines: {
                    where: { deleted_at: null },
                    include: {
                        item_catalog: {
                            select: {
                                item_code: true,
                                sap_material_number: true,
                                specification: true,
                                unit_cost: true,
                                currency: true,
                            },
                        },
                    },
                    orderBy: [{ source_type: 'asc' }, { created_at: 'asc' }],
                },
                constraints: { where: { deleted_at: null } },
                punch_list_items: {
                    where: { deleted_at: null },
                    orderBy: [{ category: 'asc' }, { item_number: 'asc' }],
                },
                workpack_documents: { where: { deleted_at: null }, orderBy: { created_at: 'asc' } },
                document_instances: {
                    where: { deleted_at: null, include_in_pdf: true },
                    orderBy: { sequence_number: 'asc' },
                },
                form_instances: {
                    where: { deleted_at: null },
                    orderBy: { sequence_number: 'asc' },
                    include: { form_template: true },
                },
                cleaning_records: { where: { deleted_at: null } },
                job_completion_certificate: true,
                lessonLearneds: { where: { deleted_at: null } },
                dropping_boxup_checklists: { include: { items: { orderBy: { sequence_number: 'asc' } } } },
                clearance_for_boxup: { include: { sign_offs: true } },
                qa_clearance_records: true,
                organization: true,
                site: true,
                asset: true,
                contractor: true,
                discipline: true,
                User_Workpack_created_byToUser: { select: { id: true, name: true, email: true } },
                versions: { orderBy: { created_at: 'desc' } },
                workflow_transitions: { orderBy: { performed_at: 'desc' } },
                attachments: { orderBy: [{ group: 'asc' }, { sort_order: 'asc' }] },
            },
        });

        if (!workpack) throw new Error('Workpack not found');

        // Fetch specialized certificate data
        const [boxupData, torqueData, hydroData, constraintItems, certInstances, lessonItems] = await Promise.all([
            CertificateService.getFlangeBoxupData(workpackId, orgId),
            CertificateService.getTorqueData(workpackId, orgId),
            CertificateService.getHydrotestData(workpackId, orgId),
            prisma.constraintLog.findMany({
                where: {
                    workpack_id: workpackId,
                    status: { in: ['open', 'in_progress'] },
                    deleted_at: null,
                },
                orderBy: [{ severity: 'desc' }, { created_at: 'asc' }],
            }).catch(() => [] as any[]),
            prisma.certificateInstance.findMany({
                where: {
                    workpack_id: workpackId,
                    include_in_pdf: true,
                    deleted_at: null,
                },
                include: {
                    template: {
                        select: { cert_name: true, fields: true },
                    },
                },
                orderBy: { created_at: 'asc' },
            }).catch(() => [] as any[]),
            prisma.lessonLearned.findMany({
                where: {
                    workpack_id: workpackId,
                    status: 'published',
                    deleted_at: null,
                },
                orderBy: { created_at: 'asc' },
            }).catch(() => [] as any[]),
        ]);

        const printSettings = await prisma.workpackPrintSettings.findUnique({
            where: { organization_id: orgId },
        });

        const headerZones = parseZones(printSettings?.header_zones, DEFAULT_HEADER_ZONES);
        const footerZones = parseZones(printSettings?.footer_zones, DEFAULT_FOOTER_ZONES);
        const org = (workpack as { organization?: { logo_path?: string; logo_url?: string; logo?: string } }).organization;
        const orgLogoPath = org?.logo_path ?? null;
        let logoBase64 = '';
        if (org) {
            const logoBuf = await loadOrgLogo(org);
            if (logoBuf) logoBase64 = `data: image / png; base64, ${logoBuf.toString('base64')} `;
        }
        if (!logoBase64) logoBase64 = loadLogoBase64(orgLogoPath);
        const headerZonesWithLogo = injectLogoIntoZones(headerZones, logoBase64);
        const marginTop = Number(printSettings?.margin_top_mm ?? 15);
        const marginBottom = Number(printSettings?.margin_bottom_mm ?? 15);
        const marginLeft = Number(printSettings?.margin_left_mm ?? 15);
        const marginRight = Number(printSettings?.margin_right_mm ?? 15);
        const headerHeightMm = Number(printSettings?.header_height_mm ?? 18);
        const footerHeightMm = Number(printSettings?.footer_height_mm ?? 12);

        const headerHtml = renderBandHtml(
            headerZonesWithLogo,
            {
                bg_color: printSettings?.header_bg_color ?? '#0D2137',
                text_color: printSettings?.header_text_color ?? '#FFFFFF',
                height_mm: headerHeightMm,
                show_border: printSettings?.header_show_border ?? false,
                border_color: printSettings?.header_border_color ?? '#E8701A',
            },
            workpack as unknown as Record<string, unknown>
        );
        const footerHtml = renderBandHtml(
            footerZones,
            {
                bg_color: printSettings?.footer_bg_color ?? '#0D2137',
                text_color: printSettings?.footer_text_color ?? '#FFFFFF',
                height_mm: footerHeightMm,
                show_border: printSettings?.footer_show_border ?? true,
                border_color: printSettings?.footer_border_color ?? '#E8701A',
            },
            workpack as unknown as Record<string, unknown>
        );

        const stripNonLatin1 = (s: string) => s.replace(/[^\x00-\xFF]/g, '');
        const safeHeaderHtml = stripNonLatin1(headerHtml);
        const safeFooterHtml = stripNonLatin1(footerHtml);

        const coverPageSettings = (printSettings as { cover_page_settings?: unknown })?.cover_page_settings ?? null;
        const lastPageSettings = (printSettings as { last_page_settings?: unknown })?.last_page_settings ?? null;
        const showCover = printSettings?.cover_show !== false;
        const orgName = (workpack as { organization?: { name?: string } }).organization?.name ?? '';

        const pdfFormat = (printSettings?.page_size === 'Letter' ? 'Letter' : 'A4') as 'A4';
        const contentMargins = {
            top: `${marginTop + headerHeightMm + 5} mm`,
            bottom: `${marginBottom + footerHeightMm + 5} mm`,
            left: `${marginLeft} mm`,
            right: `${marginRight} mm`,
        };

        const { getBrowser } = await import('@/lib/puppeteer');
        const browser = await getBrowser();

        const printHtmlToPdf = async (
            html: string,
            opts: { displayHeaderFooter: boolean; headerTemplate?: string; footerTemplate?: string; margin?: Record<string, string> },
        ): Promise<Buffer> => {
            const page = await browser.newPage();
            page.setDefaultTimeout(120000);
            page.setDefaultNavigationTimeout(120000);
            await page.setContent(stripNonLatin1(html), { waitUntil: 'domcontentloaded', timeout: 120000 });
            await page.evaluateHandle('document.fonts.ready');
            await new Promise((r) => setTimeout(r, 1500));
            const buf = await page.pdf({
                format: pdfFormat,
                printBackground: true,
                margin: opts.margin ?? { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
                displayHeaderFooter: opts.displayHeaderFooter,
                headerTemplate: opts.headerTemplate ?? '',
                footerTemplate: opts.footerTemplate ?? '',
                timeout: 120000,
            });
            await page.close();
            return Buffer.from(buf);
        };

        let coverBuffer: Buffer | null = null;
        if (showCover) {
            const coverHtml =
                coverPageSettings && typeof coverPageSettings === 'object'
                    ? buildCoverPageHtml(workpack, coverPageSettings, logoBase64, orgName)
                    : (() => {
                        const wpVars = { ...workpack, workpack_number: workpack.workpack_number ?? undefined, revision: workpack.revision ?? undefined };
                        const resolvedTitle = sanitiseForPdf(resolveVariables(printSettings?.cover_title_variable ?? '{workpack_number} — {title}', wpVars as Parameters<typeof resolveVariables>[1]));
                        const resolvedSubtitle = sanitiseForPdf(resolveVariables(printSettings?.cover_subtitle_variable ?? '{org_name} | {site_name}', wpVars as Parameters<typeof resolveVariables>[1]));
                        const accentColor = printSettings?.cover_accent_color ?? '#E8701A';
                        const coverBg = printSettings?.cover_bg_color ?? '#0D2137';
                        return `< !DOCTYPE html > <html><head><style>body{ margin: 0; padding: 0; height: 100vh; } </style></head > <body>
        <div class="page-break" style = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;background:${coverBg};color:#fff;" >
            <div style="width:100px;height:4px;background:${accentColor};margin:20px 0;" > </div>
                < h1 style = "font-size:28px;font-weight:800;margin-bottom:8px;text-align:center;" > ${resolvedTitle} </h1>
                    < p style = "font-size:14px;opacity:0.9;margin-top:0;" > ${resolvedSubtitle} </p>
                        < p style = "font-size:12px;font-weight:700;text-transform:uppercase;margin-top:16px;" > Revision: ${sanitiseForPdf(workpack.revision)} </p>
                            < p style = "font-size:12px;opacity:0.8;" > ${sanitiseForPdf(workpack.work_type)} • ${sanitiseForPdf(workpack.priority)} Priority </p>
                                < div style = "margin-top:40px;text-align:center;" >
                                    <p style="color:rgba(255,255,255,0.7);font-size:8px;" > Contractor </p>
                                        < p style = "font-size:16px;" > ${sanitiseForPdf(workpack.contractor?.name ?? 'In-House')} </p>
                                            </div>
                                            </div>
                                            < /body></html > `;
                    })();
            coverBuffer = await printHtmlToPdf(coverHtml, { displayHeaderFooter: false });
        }

        const contentHtml = this.renderHtml(
            workpack,
            { boxupData, torqueData, hydroData, constraintItems, certInstances, lessonItems },
            printSettings,
            { skipCover: true },
        );
        const contentBuffer = await printHtmlToPdf(contentHtml, {
            displayHeaderFooter: true,
            headerTemplate: safeHeaderHtml,
            footerTemplate: safeFooterHtml,
            margin: contentMargins,
        });

        let lastBuffer: Buffer | null = null;
        if (lastPageSettings && typeof lastPageSettings === 'object' && (lastPageSettings as { enabled?: boolean }).enabled !== false) {
            const lastHtml = buildLastPageHtml(workpack, lastPageSettings, logoBase64);
            if (lastHtml) lastBuffer = await printHtmlToPdf(lastHtml, { displayHeaderFooter: false });
        }

        const forMerge = options?.forMerge === true;
        const hasCover = coverBuffer != null;
        const hasLast = lastBuffer != null;
        let workpackPdfBuffer: Buffer;
        if (hasCover || hasLast) {
            const mergedPdf = await PDFDocument.create();
            if (coverBuffer) {
                const coverDoc = await PDFDocument.load(new Uint8Array(coverBuffer));
                const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
                coverPages.forEach((p: PDFPage) => mergedPdf.addPage(p));
            }
            const contentDoc = await PDFDocument.load(new Uint8Array(contentBuffer));
            const contentPages = await mergedPdf.copyPages(contentDoc, contentDoc.getPageIndices());
            contentPages.forEach((p: PDFPage) => mergedPdf.addPage(p));
            if (lastBuffer && !forMerge) {
                const lastDoc = await PDFDocument.load(new Uint8Array(lastBuffer));
                const lastPages = await mergedPdf.copyPages(lastDoc, lastDoc.getPageIndices());
                lastPages.forEach((p: PDFPage) => mergedPdf.addPage(p));
            }
            workpackPdfBuffer = Buffer.from(await mergedPdf.save());
        } else {
            workpackPdfBuffer = contentBuffer;
        }

        if (forMerge) return { buffer: workpackPdfBuffer, lastPageBuffer: lastBuffer };
        return workpackPdfBuffer;
    }

    private static renderHtml(
        wp: any,
        extra: any,
        printSettings?: {
            cover_show?: boolean;
            cover_title_variable?: string;
            cover_subtitle_variable?: string;
            cover_accent_color?: string;
            cover_bg_color?: string;
        } | null,
        options?: { skipCover?: boolean },
    ) {
        const skipCover = options?.skipCover === true;
        const showCover = !skipCover && printSettings?.cover_show !== false;
        const coverTitle = printSettings?.cover_title_variable ?? '{workpack_number} — {title}';
        const coverSubtitle = printSettings?.cover_subtitle_variable ?? '{org_name} | {site_name}';
        const accentColor = printSettings?.cover_accent_color ?? '#E8701A';
        const coverBg = printSettings?.cover_bg_color ?? '#0D2137';
        const wpVars = { ...wp, workpack_number: wp.workpack_number ?? undefined, revision: wp.revision ?? undefined };
        const resolvedTitle = sanitiseForPdf(resolveVariables(coverTitle, wpVars as Parameters<typeof resolveVariables>[1]));
        const resolvedSubtitle = sanitiseForPdf(resolveVariables(coverSubtitle, wpVars as Parameters<typeof resolveVariables>[1]));

        const approvalStatus = wp.approval_status ?? 'not_submitted';
        const showApprovalBlock = approvalStatus !== 'not_submitted';
        const approvalLabel = (() => {
            const map: Record<string, string> = {
                submitted: 'Submitted for Approval',
                approved: 'Approved',
                rejected: 'Rejected',
                revision_requested: 'Revision Requested',
            };
            return map[approvalStatus] ?? approvalStatus;
        })();
        const approvalDecidedAt = wp.approval_decided_at
            ? new Date(wp.approval_decided_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : '—';
        const approvedBy = wp.approved_by_name
            ? `${wp.approved_by_name}${wp.approved_by_email ? ` (${wp.approved_by_email})` : ''} `
            : '—';
        const approvalNotes = sanitiseForPdf(wp.approval_notes ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        return `
        <!DOCTYPE html>
            <html>
            <head>
            <style>
                body { font-family: 'Inter', system-ui, sans-serif; color: #111; line-height: 1.4; font-size: 10px; }
                .page-break { page-break-after: always; break-after: page; }
                .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                .title { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
                .section-title { background: #f3f4f6; padding: 6px 10px; font-weight: 800; text-transform: uppercase; margin: 20px 0 10px; border-left: 4px solid #2563eb; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
                th { background: #f9fafb; font-weight: 700; text-transform: uppercase; font-size: 8px; color: #6b7280; }
                .field-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
                .field-label { font-size: 8px; color: #9ca3af; font-weight: 700; text-transform: uppercase; }
                .field-value { font-weight: 600; font-size: 10px; }
                .activities-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
                .activities-table th, .activities-table td { border: 1px solid #E5E7EB; padding: 6px 8px; text-align: left; }
                .activities-table th { background: #F3F4F6; text-transform: uppercase; font-size: 8px; letter-spacing: 0.08em; color: #6B7280; font-weight: 700; }
                .activities-table tbody tr:nth-child(even) { background: #F9FAFB; }
                .activities-table tbody tr:nth-child(odd) { background: #fff; }
                .section-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1a1a2e; padding-bottom: 8px; margin-bottom: 16px; }
                .section-left { }
                .section-right { display: flex; align-items: flex-end; }
                .section-number { font-size: 14px; font-weight: 800; color: #0D2137; margin-right: 8px; }
                .duration-box { text-align: right; border-left: 3px solid #E8701A; padding-left: 12px; }
                .duration-label { display: block; font-size: 8px; font-weight: 700; letter-spacing: 0.08em; color: #888; text-transform: uppercase; margin-bottom: 2px; }
                .duration-value { display: block; font-size: 18px; font-weight: 800; color: #0D2137; font-family: 'Courier New', monospace; line-height: 1; }
                .duration-sub { display: block; font-size: 9px; color: #aaa; margin-top: 2px; }
            </style>
        </head>
        <body>
                ${showCover ? `
                <!-- COVER PAGE (no header/footer on this page) -->
                <div class="page-break" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 90vh; background: ${coverBg}; color: #fff;">
                    <div style="width: 100px; height: 4px; background: ${accentColor}; margin: 20px 0;"></div>
                    <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 8px; text-align: center;">${resolvedTitle}</h1>
                    <p style="font-size: 14px; opacity: 0.9; margin-top: 0;">${resolvedSubtitle}</p>
                    <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 16px;">Revision: ${sanitiseForPdf(wp.revision)}</p>
                    <p style="font-size: 12px; opacity: 0.8;">${sanitiseForPdf(wp.work_type)} • ${sanitiseForPdf(wp.priority)} Priority</p>
                    <div style="margin-top: 40px; text-align: center;">
                        <p class="field-label" style="color: rgba(255,255,255,0.7);">Contractor</p>
                        <p class="field-value" style="font-size: 16px;">${sanitiseForPdf(wp.contractor?.name || 'In-House')}</p>
                    </div>
                </div>
                ` : ''
            }

    <!-- TABLE OF CONTENTS -->
    ${(() => {
        const orgPdfColumns = wp.organization?.workpackPdfColumns || {};
        const parsedOrgColumns = typeof orgPdfColumns === 'string' ? JSON.parse(orgPdfColumns) : orgPdfColumns;
        const indexEntries = buildWorkpackIndex(wp, parsedOrgColumns, extra);
        return renderIndexPageHtml(indexEntries);
    })()}

    <!--OVERVIEW -->
        <div class="header">
            <span class="title">01. Overview</span>
            <span style="font-size: 8px; color: #999;">${sanitiseForPdf(wp.workpack_number)}</span>
        </div>
        <div class="field-grid">
            <div><p class="field-label">SAP Work Order</p><p class="field-value">${sanitiseForPdf(wp.sap_work_order || 'N/A')}</p></div>
            <div><p class="field-label">SAP Notification</p><p class="field-value">${sanitiseForPdf(wp.sap_notification || 'N/A')}</p></div>
            <div><p class="field-label">Planned Start</p><p class="field-value">${wp.planned_start_date ? new Date(wp.planned_start_date).toLocaleDateString() : '—'}</p></div>
            <div><p class="field-label">Planned End</p><p class="field-value">${wp.planned_end_date ? new Date(wp.planned_end_date).toLocaleDateString() : '—'}</p></div>
        </div>
        <div class="section-title">Scope of Work</div>
        <p style="white-space: pre-wrap;">${sanitiseForPdf(wp.scope_of_work || 'No scope defined.')}</p>
        ${showApprovalBlock ? `
                <div class="section-title">Client Approval Status</div>
                <table style="margin-bottom: 20px;">
                    <tr><td class="field-label" style="width: 180px;">Status</td><td class="field-value">${sanitiseForPdf(approvalLabel)}</td></tr>
                    <tr><td class="field-label">Approved by</td><td class="field-value">${sanitiseForPdf(approvedBy)}</td></tr>
                    <tr><td class="field-label">Approval date</td><td class="field-value">${sanitiseForPdf(approvalDecidedAt)}</td></tr>
                </table>
                ` : ''}
    <div class="page-break"></div>

                ${(() => {
                const data = typeof wp.equipment_technical_data === 'string'
                    ? JSON.parse(wp.equipment_technical_data || '{}')
                    : (wp.equipment_technical_data || {});
                if (!data || Object.keys(data).length === 0) return '';

                const eq = data.equipment || {};
                const dims = data.dimensions || {};
                const tubes = data.tube_bundle || {};
                const shell = data.shell_side || {};
                const tube = data.tube_side || {};
                const mats = data.materials || {};
                const nozzles = data.nozzles || {};
                const designCodes = Array.isArray(data.design_codes) ? data.design_codes : [];

                const val = (v: any, unit = '') => (v != null && v !== '') ? `${v}${unit ? ' ' + unit : ''}` : '—';
                const renderList = (title: string, items: any[]) => `
                    <div>
                        <p class="field-label" style="border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">${title}</p>
                        ${items.map(([l, v]) => `
                            <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                                <span style="color:#6b7280;">${sanitiseForPdf(l)}</span>
                                <span style="font-weight:600;">${sanitiseForPdf(v)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;

                return `
                <!-- EQUIPMENT TECHNICAL DATA -->
                <div class="header">
                    <span class="title">01B. Equipment Technical Data</span>
                </div>
                
                <div style="background: #0D2137; color: white; padding: 12px; border-radius: 4px; border-left: 4px solid #E8701A; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 700;">${sanitiseForPdf(eq.name || 'Equipment')} · ${sanitiseForPdf(eq.type || 'Asset')}</h3>
                    ${eq.tema_designation ? `<span style="display:inline-block; margin-top: 6px; padding: 2px 6px; background: rgba(255,255,255,0.2); font-size: 8px; border-radius: 2px;">TEMA ${sanitiseForPdf(eq.tema_designation)}</span>` : ''}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    ${renderList('Physical Dimensions', [
                    ['Shell ID', val(dims.shell_id_mm, 'mm')],
                    ['Overall Length', val(dims.overall_length_mm, 'mm')],
                    ['Tube Length', val(dims.tube_length_mm, 'mm')],
                    ['Heat Surface', val(dims.heat_surface_area_m2, 'm²')],
                    ['Weight (Dry)', val(dims.weight_dry_kg, 'kg')],
                    ['Weight (Operating)', val(dims.weight_operating_kg, 'kg')],
                    ['Weight (Flooded)', val(dims.weight_flooded_kg, 'kg')]
                ])}
                    <div>
                        ${renderList('Tube Bundle', [
                    ['Total Tubes', val(tubes.total_tubes)],
                    ['Tube Passes', val(tubes.tube_passes)],
                    ['OD × Thick', tubes.tube_od_mm != null ? `${tubes.tube_od_mm} × ${tubes.tube_thickness_mm ?? '—'} mm` : '—'],
                    ['Arrangement', val(tubes.tube_arrangement)],
                    ['Baffle Type', val(tubes.baffle_type)]
                ])}
                        ${designCodes.length > 0 ? `
                            <p class="field-label" style="margin-top: 12px;">Design Codes</p>
                            <p class="field-value" style="color:#2563eb;">${sanitiseForPdf(designCodes.join(', '))}</p>
                        ` : ''}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    ${renderList('Shell Side Nozzles', (nozzles.shell_side || []).map((n: any) => [
                    `${n.mark} (${n.service})`,
                    `${n.size || '—'} / ${n.rating || '—'}`
                ]))}
                    ${renderList('Tube Side Nozzles', (nozzles.tube_side || []).map((n: any) => [
                    `${n.mark} (${n.service})`,
                    `${n.size || '—'} / ${n.rating || '—'}`
                ]))}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    ${renderList('Shell Side (' + (shell.medium || 'Medium TBD') + ')', [
                    ['Flow Rate', val(shell.flow_rate)],
                    ['Inlet Temp', val(shell.inlet_temp_c, '°C')],
                    ['Outlet Temp', val(shell.outlet_temp_c, '°C')],
                    ['Design Press', val(shell.design_pressure_kg_cm2, 'kg/cm²')],
                    ['Test Press', val(shell.test_pressure_kg_cm2, 'kg/cm²')],
                    ['Design Temp', val(shell.design_temp_c, '°C')],
                    ['Press Drop', val(shell.pressure_drop_kg_cm2, 'kg/cm²')],
                    ['Velocity', val(shell.velocity_m_s, 'm/s')],
                    ['Passes', val(shell.passes)]
                ])}
                    ${renderList('Tube Side (' + (tube.medium || 'Medium TBD') + ')', [
                    ['Flow Rate', val(tube.flow_rate)],
                    ['Inlet Temp', val(tube.inlet_temp_c, '°C')],
                    ['Outlet Temp', val(tube.outlet_temp_c, '°C')],
                    ['Design Press', val(tube.design_pressure_kg_cm2, 'kg/cm²')],
                    ['Test Press', val(tube.test_pressure_kg_cm2, 'kg/cm²')],
                    ['Design Temp', val(tube.design_temp_c, '°C')],
                    ['Press Drop', val(tube.pressure_drop_kg_cm2, 'kg/cm²')],
                    ['Velocity', val(tube.velocity_m_s, 'm/s')],
                    ['Passes', val(tube.passes)]
                ])}
                </div>

                ${Object.keys(mats).length > 0 ? `
                <div>
                    <p class="field-label" style="border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">Materials of Construction</p>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        ${Object.entries(mats).map(([k, v]) => `
                            <div style="display:flex; justify-content:space-between;">
                                <span style="color:#6b7280; text-transform:capitalize;">${sanitiseForPdf(k.replace(/_/g, ' '))}</span>
                                <span style="font-weight:600;">${sanitiseForPdf(String(v))}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="page-break"></div>
                `;
            })()}

                <!-- ACTIVITIES -->
                ${(() => {
                const orgCol = wp.organization?.workpackPdfColumns || {};
                const cols = typeof orgCol === 'string' ? JSON.parse(orgCol) : orgCol;
                const showWindow = cols.showWindow ?? true;
                const showDuration = cols.showDuration ?? true;
                const showManpower = cols.showManpower ?? false;
                const showContractor = cols.showContractor ?? true;
                const showPredecessor = cols.showPredecessor ?? false;
                const showScaffolding = cols.showScaffolding ?? true;

                const rawActivities = wp.activities ?? [];
                const seenIds = new Set<string>();
                const activities = rawActivities.filter((a: any) => {
                    const id = a?.id;
                    if (!id || seenIds.has(id)) return false;
                    seenIds.add(id);
                    return true;
                });
                const totalHours = activities.reduce((sum: number, a: any) => sum + (Number(a.duration_hours) || 0), 0);
                const workingDays = Math.ceil(totalHours / 8);
                const totalDurationLabel = totalHours === 0 ? 'Duration TBD' : totalHours < 8 ? totalHours + 'h' : totalHours + 'h (' + workingDays + 'd)';
                const fmtDuration = (hours: number | null | undefined): string => {
                    if (hours == null || Number(hours) <= 0) return '—';
                    const h = Number(hours);
                    const days = Math.floor(h / 8);
                    if (days >= 1) return h + 'h (' + days + 'd)';
                    return h + 'h';
                };
                const formatPredecessors = (a: any): string => {
                    const preds = a.predecessors;
                    if (!Array.isArray(preds) || preds.length === 0) return '—';
                    return preds.map((rel: any) => {
                        const code = sanitiseForPdf(rel.predecessor?.activity_number ?? rel.predecessor?.description ?? '?');
                        const type = (rel.relationship_type ?? 'FS') + '';
                        const lag = rel.lag_days != null && Number(rel.lag_days) !== 0
                            ? (Number(rel.lag_days) > 0 ? '+' + rel.lag_days + 'd' : rel.lag_days + 'd')
                            : '';
                        return lag ? code + ' ' + type + lag : code + ' ' + type;
                    }).join(', ');
                };
                const getResource = (a: any): string => {
                    const resList = a.resources;
                    if (Array.isArray(resList) && resList.length > 0 && resList[0].resource?.name) return resList[0].resource.name;
                    if (a.discipline?.name) return a.discipline.name;
                    if (a.discipline?.discipline_code) return a.discipline.discipline_code;
                    return '—';
                };
                const getScaffold = (a: any) => {
                    const udfs = a.udf_values || [];
                    const v = udfs.find((u:any) => u.definition?.code === 'scaffolding_qty');
                    if(v) return v.value_number ?? v.value_string ?? '—';
                    return '—';
                };
                return `
                <div class="section-header activities-header">
                    <div class="section-left">
                        <span class="section-number">02.</span>
                        <span class="section-title">ACTIVITIES</span>
                    </div>
                    <div class="section-right">
                        <div class="duration-box">
                            <span class="duration-label">TOTAL DURATION</span>
                            <span class="duration-value">${totalDurationLabel}</span>
                            <span class="duration-sub">${activities.length} activities</span>
                        </div>
                    </div>
                </div>
                <table class="activities-table">
                    <thead>
                        <tr>
                            <th style="width:10%">ACT. CODE</th>
                            <th>ACTIVITY NAME</th>
                            ${showWindow ? '<th style="width:8%">WINDOW</th>' : ''}
                            ${showDuration ? '<th style="width:8%">DUR.</th>' : ''}
                            ${showPredecessor ? '<th style="width:12%">PRED.</th>' : ''}
                            ${showManpower ? '<th style="width:12%">RESOURCE</th>' : ''}
                            ${showContractor ? '<th style="width:12%">CONTRACTOR</th>' : ''}
                            ${showScaffolding ? '<th style="width:8%">SCAFF.</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${activities.map((a: any, i: number) => `
                            <tr style="background: ${i % 2 === 0 ? '#fff' : '#F9FAFB'};">
                                <td>${sanitiseForPdf(a.activity_id ?? a.activity_number ?? a.activity_code ?? String(a.sequence_number ?? '')).replace(/</g, '&lt;')}</td>
                                <td>${sanitiseForPdf(a.description ?? a.name ?? '—').replace(/</g, '&lt;')}</td>
                                ${showWindow ? `<td>${sanitiseForPdf(a.window ?? '—')}</td>` : ''}
                                ${showDuration ? `<td>${fmtDuration(a.duration_hours)}</td>` : ''}
                                ${showPredecessor ? `<td>${sanitiseForPdf(formatPredecessors(a)).replace(/</g, '&lt;')}</td>` : ''}
                                ${showManpower ? `<td>${sanitiseForPdf(getResource(a) ?? '—').replace(/</g, '&lt;')}</td>` : ''}
                                ${showContractor ? `<td>${sanitiseForPdf(wp.contractor?.name ?? '—')}</td>` : ''}
                                ${showScaffolding ? `<td>${sanitiseForPdf(getScaffold(a))}</td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                    `;
            })()}
                <div class="page-break"></div>

                <!-- JOINT INTEGRITY -->
                <div class="header">
                    <span class="title">03. Joint Integrity</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Joint No.</th>
                            <th>Tightening</th>
                            <th>Size/Spec</th>
                            <th>Line No.</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(wp.joint_integrity_items ?? []).map((j: any) => `
                            <tr>
                                <td>${sanitiseForPdf(j.joint_number ?? '—')}</td>
                                <td>${sanitiseForPdf(j.tightening_method ?? '—')}</td>
                                <td>${sanitiseForPdf([j.flange_size, j.specification, j.rating].filter(Boolean).join(' / ') || '—')}</td>
                                <td>${sanitiseForPdf(j.pipeline_number ?? j.line_number ?? '—')}</td>
                                <td>${sanitiseForPdf(j.status ?? '—')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="page-break"></div>

                <!-- CERTIFICATES -->
                ${(Array.isArray(extra?.boxupData?.joints) && extra.boxupData.joints.length > 0) ? `
                <div class="header">
                    <span class="title">04. Flange Boxup Cert</span>
                </div>
                <p>This document certifies the successful completion of joint integrity for the following items.</p>
                <table>
                    <thead><tr><th>Joint No.</th><th>Sign-off By</th><th>Date</th></tr></thead>
                    <tbody>
                        ${(extra.boxupData.joints as any[]).map((d: any) => `
                            <tr><td>${sanitiseForPdf(d.joint_number)}</td><td>SYSTEM VERIFIED</td><td>${new Date().toLocaleDateString()}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="page-break"></div>
                ` : ''}

                ${(() => {
                const hydroActivities = Array.isArray(extra?.hydroData?.activities) && extra.hydroData.activities.length > 0
                    ? extra.hydroData.activities
                    : (wp.activities ?? []).filter((a: any) => /hydro|test|pressure|shell test|tube test/i.test(a.description || a.name || ''));
                if (hydroActivities.length === 0) return '';
                return `
                <div class="header">
                    <span class="title">05. Hydrotest Cert</span>
                </div>
                <table>
                    <thead><tr><th>Activity</th><th>Status</th><th>Verification</th></tr></thead>
                    <tbody>
                        ${hydroActivities.map((d: any) => `
                            <tr><td>${sanitiseForPdf(d.description ?? d.name ?? '—')}</td><td>${sanitiseForPdf(d.status ?? 'Pending')}</td><td>—</td></tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="page-break"></div>
                    `;
            })()}

                ${(wp.material_lines?.length > 0) ? (() => {
                const allLines = wp.material_lines || [];
                const activityMap: Record<string, string> = {};
                for (const a of (wp.activities || []) as any[]) {
                    if (a?.id) activityMap[a.id] = sanitiseForPdf(a.activity_id || a.activity_number || a.id?.slice(0, 8) || '—');
                }

                const orgCol = wp.organization?.workpackPdfColumns || {};
                const pdfCols = typeof orgCol === 'string' ? JSON.parse(orgCol) : orgCol;
                const showElectrical = pdfCols.showElectrical ?? false;

                let electricalHtml = '';
                if (showElectrical) {
                    const electricalLines = allLines.filter((l: any) => l.material_category === 'electrical' && l.includedInPdf !== false);
                    const activityElectrical = (wp.activities || []).flatMap((a: any) => 
                        (a.materials || []).filter((m: any) => m.material_category === 'electrical').map((m: any) => ({...m, activity: a}))
                    );

                    const aggregated = new Map<string, any>();
                    [...electricalLines, ...activityElectrical].forEach(item => {
                        const key = (item.description || '').toLowerCase().trim();
                        const qty = Number(item.quantity_required) || 0;
                        const uom = item.unit_of_measure || 'EA';
                        const actRef = item.activity ? (item.activity.activity_id || item.activity.activity_number || '—') : (item.linked_to || '—');
                        
                        if (aggregated.has(key)) {
                            const existing = aggregated.get(key);
                            existing.quantity += qty;
                            if (actRef !== '—' && !existing.activities.includes(actRef)) {
                                existing.activities.push(actRef);
                            }
                        } else {
                            aggregated.set(key, {
                                description: item.description,
                                quantity: qty,
                                uom: uom,
                                activities: actRef !== '—' ? [actRef] : [],
                                note: item.activity?.description?.slice(0, 100) || ''
                            });
                        }
                    });

                    if (aggregated.size > 0) {
                        electricalHtml = `
                        <div class="page-break"></div>
                        <div class="header">
                            <span class="title">SECTION I — ELECTRICAL REQUIREMENTS</span>
                        </div>
                        <p style="margin-bottom: 12px; font-size: 8px; color: #6b7280;">Consolidated list of electrical equipment, cables and temporary power requirements.</p>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:30px;">S.No</th>
                                    <th>Electrical Item / Equipment</th>
                                    <th style="width:40px;">UOM</th>
                                    <th style="width:40px;">Qty</th>
                                    <th>Requirement Note</th>
                                    <th style="width:70px;">Activity Ref</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.from(aggregated.values()).map((item, idx) => `
                                    <tr>
                                        <td style="text-align:center;">${idx + 1}</td>
                                        <td style="font-weight:600;">${sanitiseForPdf(item.description)}</td>
                                        <td style="text-align:center;">${sanitiseForPdf(item.uom)}</td>
                                        <td style="text-align:center;">${item.quantity}</td>
                                        <td style="font-size:8px; color:#6b7280; font-style:italic;">${sanitiseForPdf(item.note)}</td>
                                        <td style="font-size:8px; color:#1e40af; font-weight:600;">${sanitiseForPdf(item.activities.join(', '))}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        `;
                    }
                }

                const lines = allLines.filter((l: any) => {
                    const isIncluded = l.includedInPdf !== false;
                    const isElectrical = l.material_category === 'electrical';
                    if (showElectrical && isElectrical) return false;
                    return isIncluded;
                });

                if (lines.length === 0 && !electricalHtml) return '';

                const grouped: Record<string, any[]> = {};
                for (const l of lines) {
                    const disc = (l as any).material_category ?? 'mechanical';
                    if (!grouped[disc]) grouped[disc] = [];
                    grouped[disc].push(l);
                }
                const activeDisciplines = MATERIAL_DISCIPLINES.filter((d) => (grouped[d.key] ?? []).length > 0);
                const totalItems = lines.length;

                let html = electricalHtml + `
                <div class="page-break"></div>
                <!-- SECTION J — MATERIALS LIST (mini-index) -->
                <div class="header">
                    <span class="title">SECTION J — MATERIALS LIST</span>
                </div>
                <p style="margin-bottom: 16px; font-size: 9px; color: #6b7280;">Index of discipline-wise material lists</p>
                <table>
                    <thead>
                        <tr>
                            <th style="width:50px;">Section</th>
                            <th style="width:100px;">Discipline</th>
                            <th>Description</th>
                            <th style="width:70px; text-align:center;">No. of Items</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activeDisciplines.map((disc) => `
                            <tr>
                                <td style="text-align:center;">${sanitiseForPdf(disc.sectionCode)}</td>
                                <td style="font-weight:600;">${sanitiseForPdf(disc.label)}</td>
                                <td style="font-size:8px; color:#6b7280;">${sanitiseForPdf(disc.description)}</td>
                                <td style="text-align:center; font-weight:600;">${(grouped[disc.key] ?? []).length}</td>
                            </tr>
                        `).join('')}
                        <tr style="border-top: 1px solid #e5e7eb;">
                            <td></td>
                            <td style="font-weight:700;">TOTAL</td>
                            <td></td>
                            <td style="text-align:center; font-weight:700; background:#f3f4f6;">${totalItems}</td>
                        </tr>
                    </tbody>
                </table>
                `;

                for (const disc of activeDisciplines) {
                    const items = grouped[disc.key] ?? [];
                    html += `
                <div class="page-break"></div>
                <!-- ${disc.sectionCode} — ${disc.label} -->
                <div class="header" style="background: #1E40AF; color: #fff;">
                    <span class="title">${sanitiseForPdf(disc.sectionCode)} — ${sanitiseForPdf(disc.label.toUpperCase())} MATERIALS</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:28px;">S.No</th>
                            <th>Material Description</th>
                            <th style="width:100px;">Specification / Grade</th>
                            <th style="width:36px;">Qty</th>
                            <th style="width:38px;">UOM</th>
                            <th style="width:55px;">Activity Ref</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((mat: any, i: number) => {
                            const desc = mat.customName || mat.description;
                            const spec = mat.specification || mat.item_catalog?.specification || '—';
                            const activityRef = mat.source_type === 'activity' && mat.source_id ? (activityMap[mat.source_id] ?? '—') : (mat.linked_to || mat.source_type || '—');
                            return `
                            <tr>
                                <td style="text-align:center;">${i + 1}</td>
                                <td style="font-weight:600;">${sanitiseForPdf(desc)}</td>
                                <td style="font-size:8px; color:#6b7280;">${sanitiseForPdf(spec)}</td>
                                <td style="text-align:center;">${mat.quantity_required}</td>
                                <td style="text-align:center;">${sanitiseForPdf(mat.unit_of_measure)}</td>
                                <td style="font-size:8px; color:#6b7280;">${sanitiseForPdf(activityRef)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                <p style="margin-top: 8px; font-size: 7px; color: #9ca3af; text-align: right;">Prepared by AURIANOA OS · ${new Date().toLocaleDateString('en-IN')} · ${items.length} item(s) included</p>
                `;
                }
                return html;
            })() : ''}

                ${(extra?.constraintItems?.length > 0) ? (() => {
                const items = extra.constraintItems as any[];
                const SEV_COLOURS: Record<string, string> = { critical: '#FEE2E2', high: '#FFEDD5', medium: '#FEF9C3', low: '#F3F4F6' };
                const parts = items.map((c: any) => {
                    const bg = SEV_COLOURS[c.severity] ?? '#F9FAFB';
                    const meta = [c.owner ? 'Owner: ' + sanitiseForPdf(c.owner) : null, c.target_resolution ? 'Target: ' + new Date(c.target_resolution).toLocaleDateString('en-GB') : null, c.raised_by ? 'Raised by: ' + sanitiseForPdf(c.raised_by) : null].filter(Boolean).join(' · ');
                    const desc = c.description ? '<p style="font-size:9px; color:#374151; margin:6px 0 0;">' + sanitiseForPdf(c.description).replace(/</g, '&lt;') + '</p>' : '';
                    const steps = c.resolution_steps ? '<p style="font-size:8px; color:#1D4ED8; margin-top:4px;"><strong>Resolution steps:</strong> ' + sanitiseForPdf(c.resolution_steps).replace(/</g, '&lt;') + '</p>' : '';
                    const metaP = meta ? '<p style="font-size:7.5px; color:#9CA3AF; margin-top:4px;">' + sanitiseForPdf(meta) + '</p>' : '';
                    return '<div style="background:' + bg + '; border-left:4px solid #374151; padding:10px 12px; margin-bottom:10px;">' +
                        '<div style="font-weight:700; font-size:10px; color:#111;">' + sanitiseForPdf(c.constraint_number ?? '').replace(/</g, '&lt;') + ' — ' + sanitiseForPdf(c.title ?? '').replace(/</g, '&lt;') + '</div>' +
                        '<div style="font-size:8px; color:#6b7280; margin-top:4px;">' + sanitiseForPdf((c.severity ?? '').toUpperCase()) + '</div>' + desc + steps + metaP + '</div>';
                });
                return `
                <div class="page-break"></div>
                <div class="section-title">OPEN CONSTRAINTS</div>
                ${parts.join('')}
                <div class="page-break"></div>
                `;
            })() : ''}

                ${(wp.cleaning_records?.length > 0) ? `
                <!-- CLEANING (conditional: only if items exist) -->
                <div class="page-break"></div>
                <div class="header">
                    <span class="title">Cleaning</span>
                </div>
                <table>
                    <thead>
                        <tr><th>Method</th><th>Before condition</th><th>After condition</th><th>Acceptance</th></tr>
                    </thead>
                    <tbody>
                        ${(wp.cleaning_records || []).map((r: any) => `
                            <tr>
                                <td>${sanitiseForPdf(r.cleaning_method ?? '').replace(/</g, '&lt;')}</td>
                                <td>${sanitiseForPdf(r.before_condition ?? '').replace(/</g, '&lt;')}</td>
                                <td>${sanitiseForPdf(r.after_condition ?? '').replace(/</g, '&lt;')}</td>
                                <td>${r.inspector_acceptance ? 'Accepted' : '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="page-break"></div>
                ` : ''}

                ${(extra?.certInstances?.length > 0) ? (extra.certInstances as any[]).map((cert: any) => {
                const fields: any[] = cert.template?.fields ?? [];
                const values: Record<string, string> = (cert.field_values ?? {}) as Record<string, string>;
                const statusLine = [cert.status ? 'Status: ' + cert.status.replace(/_/g, ' ') : null, cert.pass_fail ? 'Result: ' + (cert.pass_fail as string).toUpperCase() : null].filter(Boolean).join(' · ');
                const fieldRows = fields.filter((f: any) => values[f.key]).map((f: any) => {
                    const val = values[f.key];
                    const displayVal = f.type === 'boolean' ? (val === 'true' ? 'Yes' : 'No') : (f.unit ? val + ' ' + f.unit : val);
                    return '<tr><td class="field-label">' + sanitiseForPdf(f.label ?? f.key) + '</td><td class="field-value">' + sanitiseForPdf(displayVal).replace(/</g, '&lt;') + '</td></tr>';
                }).join('');
                const remarks = cert.remarks ? '<div class="section-title">Remarks</div><p>' + sanitiseForPdf(cert.remarks).replace(/</g, '&lt;') + '</p>' : '';
                return `
                <div class="page-break"></div>
                <div class="header">
                    <span class="title">CERTIFICATE: ${sanitiseForPdf(String(cert.template?.cert_name ?? cert.cert_name ?? '')).replace(/</g, '&lt;').toUpperCase()}</span>
                </div>
                ${statusLine ? '<p style="font-size:9px; color:#6b7280; margin-bottom:12px;">' + sanitiseForPdf(statusLine) + '</p>' : ''}
                <table>
                    <tbody>${fieldRows}</tbody>
                </table>
                ${remarks}
                <p style="margin-top:24px; font-size:8px; color:#9ca3af;">Prepared by ________________  Approved by ________________  Client/TPI ________________</p>
                `;
            }).join('') : ''}

                ${(extra?.lessonItems?.length > 0) ? (() => {
                const lessons = extra.lessonItems as any[];
                const IMP_BADGE: Record<string, string> = { high: '#FEE2E2', medium: '#FEF9C3', low: '#F3F4F6' };
                const lessonBlocks = lessons.map((l: any) => {
                    const bg = IMP_BADGE[l.impact ?? 'low'] ?? '#F9FAFB';
                    const desc = l.description ? '<p style="font-size:8.5px; color:#374151; margin:6px 0 0;">' + sanitiseForPdf(l.description).replace(/</g, '&lt;') + '</p>' : '';
                    const rec = l.recommendation ? '<p style="font-size:8px; color:#065F46; margin-top:4px;"><strong>Recommendation:</strong> ' + sanitiseForPdf(l.recommendation).replace(/</g, '&lt;') + '</p>' : '';
                    return '<div style="background:' + bg + '; padding:10px 12px; margin-bottom:10px; border-left:4px solid #374151;">' +
                        '<div style="font-weight:700; font-size:10px; color:#111;">' + sanitiseForPdf(l.title ?? '').replace(/</g, '&lt;') + '</div>' +
                        '<div style="font-size:7.5px; color:#6b7280; margin-top:4px;">' + sanitiseForPdf((l.impact ?? '').toUpperCase()) + ' IMPACT</div>' + desc + rec + '</div>';
                });
                return `
                <div class="page-break"></div>
                <div class="section-title">LESSONS LEARNED</div>
                ${lessonBlocks.join('')}
                <div class="page-break"></div>
                `;
            })() : ''}

                <!-- JOB COMPLETION -->
                <div class="header">
                    <span class="title">07. Job Completion</span>
                </div>
                ${wp.job_completion_certificate ? `
                    <div style="border: 4px solid #2563eb; padding: 40px; text-align: center;">
                        <h2 style="font-size: 30px; margin-bottom: 10px;">CERTIFICATE OF COMPLETION</h2>
                        <p style="color: #6b7280; font-size: 12px;">This is to certify that workpack <b>${sanitiseForPdf(wp.workpack_number)}</b> has reached mechanical completion.</p>
                        <div style="margin: 40px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: left; padding: 0 100px;">
                            <div><p class="field-label">Cat B Punch Items</p><p class="field-value" style="font-size: 20px;">${wp.job_completion_certificate.open_punch_cat_b ?? 0}</p></div>
                            <div><p class="field-label">Cat C Punch Items</p><p class="field-value" style="font-size: 20px;">${wp.job_completion_certificate.open_punch_cat_c ?? 0}</p></div>
                        </div>
                        <p style="font-size: 8px; color: #999;">Signed via AURIANA OS Digital Signature Engine</p>
                    </div>
                ` : '<p>No completion certificate generated yet.</p>'}
            </body>
            </html>
        `;
    }
}
