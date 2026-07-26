/**
 * Template variables for workpack print header/footer/cover.
 * Use in settings UI and in PDF generation.
 */
export const PRINT_VARIABLES = [
  { code: '{org_name}', label: 'Organisation Name' },
  { code: '{site_name}', label: 'Site Name' },
  { code: '{workpack_number}', label: 'Workpack Number' },
  { code: '{title}', label: 'Workpack Title' },
  { code: '{revision}', label: 'Revision (e.g. R0)' },
  { code: '{status}', label: 'Status (e.g. ISSUED)' },
  { code: '{planned_start}', label: 'Planned Start Date' },
  { code: '{planned_end}', label: 'Planned End Date' },
  { code: '{asset_tag}', label: 'Asset / Equipment Tag' },
  { code: '{discipline}', label: 'Lead Discipline' },
  { code: '{work_order}', label: 'SAP Work Order Number' },
  { code: '{page}', label: 'Page Number' },
  { code: '{total_pages}', label: 'Total Page Count' },
  { code: '{date_printed}', label: 'Date Printed' },
  { code: '{prepared_by}', label: 'Prepared By (creator)' },
];

export function resolveVariables(
  template: string,
  workpack: Record<string, unknown> & {
    organization?: { name?: string };
    site?: { name?: string };
    workpack_number?: string;
    title?: string;
    revision?: string;
    status?: string;
    planned_start_date?: string | Date;
    planned_end_date?: string | Date;
    asset?: { tag?: string; name?: string };
    work_order_number?: string;
    creator?: { name?: string };
  },
  pageNum?: number,
  totalPages?: number
): string {
  const orgName = (workpack.organization as { name?: string } | undefined)?.name ?? '';
  const siteName = (workpack.site as { name?: string } | undefined)?.name ?? '';
  const assetTag =
    (workpack.asset as { tag?: string; name?: string } | undefined)?.tag ??
    (workpack.asset as { tag?: string; name?: string } | undefined)?.name ??
    '';
  const preparedBy = (workpack.creator as { name?: string } | undefined)?.name ?? '';

  return template
    .replace(/{org_name}/g, orgName)
    .replace(/{site_name}/g, siteName)
    .replace(/{workpack_number}/g, (workpack.workpack_number as string) ?? '')
    .replace(/{title}/g, (workpack.title as string) ?? '')
    .replace(/{revision}/g, (workpack.revision as string) ?? 'R0')
    .replace(/{status}/g, (() => {
      const raw = (workpack.status as string) ?? '';
      const u = raw.toUpperCase();
      if (u === 'OIP' || u === '') return 'DRAFT';
      return u;
    })())
    .replace(
      /{planned_start}/g,
      workpack.planned_start_date
        ? new Date(workpack.planned_start_date as string).toLocaleDateString('en-GB')
        : ''
    )
    .replace(
      /{planned_end}/g,
      workpack.planned_end_date
        ? new Date(workpack.planned_end_date as string).toLocaleDateString('en-GB')
        : ''
    )
    .replace(/{asset_tag}/g, assetTag)
    .replace(/{work_order}/g, (workpack.work_order_number as string) ?? '')
    .replace(/{page}/g, pageNum?.toString() ?? '')
    .replace(/{total_pages}/g, totalPages?.toString() ?? '')
    .replace(/{date_printed}/g, new Date().toLocaleDateString('en-GB'))
    .replace(/{prepared_by}/g, preparedBy)
    .replace(/{discipline}/g, (workpack.discipline as string) ?? '');
}

/** Sample workpack data for print preview (designer and preview PDF). */
export function getSampleWorkpack(orgName: string, pageNum = '2', totalPages = '24') {
  return {
    organization: { name: orgName },
    site: { name: 'Main Plant' },
    workpack_number: 'WP-2026-001',
    title: 'Heat Exchanger Retubing',
    revision: 'R1',
    status: 'ISSUED',
    work_order_number: 'WO-4500123',
    asset: { tag: 'HE-1001A', name: 'HE-1001A' },
    discipline: 'MECH',
    planned_start_date: '2026-04-01',
    planned_end_date: '2026-04-14',
    creator: { name: 'A. Engineer' },
    page: pageNum,
    total_pages: totalPages,
  };
}
