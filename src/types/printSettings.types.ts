/** Single content item within a zone (header/footer). */
export type ZoneItem = {
  id: string;
  type: 'text' | 'variable' | 'image';

  text?: string;

  variableCode?: string;
  variableLabel?: string;

  imagePath?: string;
  imageUrl?: string;
  imageName?: string;
  imageWidthPx?: number;
  imageHeightPx?: number;
  imageObjectFit?: 'contain' | 'cover' | 'fill';

  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  opacity?: number;
};

/** One zone (left, center, or right). */
export type Zone = {
  items: ZoneItem[];
  textAlign: 'left' | 'center' | 'right';
};

/** Full band (header or footer) with three zones. */
export type HeaderFooterZones = {
  left: Zone;
  center: Zone;
  right: Zone;
};

export type LogoLibraryItem = {
  id: string;
  name: string;
  s3_path: string;
  url: string;
  width_px?: number;
  height_px?: number;
};

export const PRINT_VARIABLES = [
  { code: '{org_name}', label: 'Organisation Name', group: 'Organisation' },
  { code: '{site_name}', label: 'Site Name', group: 'Organisation' },
  { code: '{workpack_number}', label: 'Workpack Number', group: 'Workpack' },
  { code: '{title}', label: 'Workpack Title', group: 'Workpack' },
  { code: '{revision}', label: 'Revision', group: 'Workpack' },
  { code: '{status}', label: 'Status', group: 'Workpack' },
  { code: '{work_order}', label: 'SAP Work Order', group: 'Workpack' },
  { code: '{asset_tag}', label: 'Equipment Tag', group: 'Workpack' },
  { code: '{discipline}', label: 'Lead Discipline', group: 'Workpack' },
  { code: '{planned_start}', label: 'Planned Start', group: 'Schedule' },
  { code: '{planned_end}', label: 'Planned End', group: 'Schedule' },
  { code: '{page}', label: 'Page Number', group: 'Page' },
  { code: '{total_pages}', label: 'Total Pages', group: 'Page' },
  { code: '{date_printed}', label: 'Date Printed', group: 'Page' },
  { code: '{prepared_by}', label: 'Prepared By', group: 'Page' },
];

export const DEFAULT_HEADER_ZONES: HeaderFooterZones = {
  left: {
    textAlign: 'left',
    items: [
      {
        id: 'h-l-logo',
        type: 'image',
        imageName: 'Company Logo',
        imageWidthPx: 80,
        imageHeightPx: 28,
        imageObjectFit: 'contain',
      },
    ],
  },
  center: {
    textAlign: 'center',
    items: [
      {
        id: 'h-c-1',
        type: 'variable',
        variableCode: '{workpack_number}',
        variableLabel: 'Workpack Number',
        fontSize: 12,
        fontWeight: 'bold',
      },
      {
        id: 'h-c-2',
        type: 'variable',
        variableCode: '{title}',
        variableLabel: 'Workpack Title',
        fontSize: 9,
        fontWeight: 'normal',
      },
    ],
  },
  right: {
    textAlign: 'right',
    items: [
      {
        id: 'h-r-1',
        type: 'variable',
        variableCode: '{revision}',
        variableLabel: 'Revision',
        fontSize: 10,
        fontWeight: 'bold',
      },
      {
        id: 'h-r-2',
        type: 'variable',
        variableCode: '{status}',
        variableLabel: 'Status',
        fontSize: 9,
      },
    ],
  },
};

export const DEFAULT_FOOTER_ZONES: HeaderFooterZones = {
  left: {
    textAlign: 'left',
    items: [
      {
        id: 'f-l-1',
        type: 'variable',
        variableCode: '{org_name}',
        variableLabel: 'Organisation Name',
        fontSize: 8,
      },
    ],
  },
  center: {
    textAlign: 'center',
    items: [
      { id: 'f-c-1', type: 'text', text: 'Page ', fontSize: 8 },
      {
        id: 'f-c-2',
        type: 'variable',
        variableCode: '{page}',
        variableLabel: 'Page Number',
        fontSize: 8,
        fontWeight: 'bold',
      },
      { id: 'f-c-3', type: 'text', text: ' of ', fontSize: 8 },
      {
        id: 'f-c-4',
        type: 'variable',
        variableCode: '{total_pages}',
        variableLabel: 'Total Pages',
        fontSize: 8,
        fontWeight: 'bold',
      },
    ],
  },
  right: {
    textAlign: 'right',
    items: [
      {
        id: 'f-r-1',
        type: 'text',
        text: 'Controlled when printed',
        fontSize: 8,
        fontStyle: 'italic',
        opacity: 0.8,
      },
    ],
  },
};
