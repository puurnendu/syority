export const ITEM_CATEGORIES = [
  { value: 'gasket', label: 'Gasket', color: 'bg-blue-100 text-blue-700' },
  { value: 'bolt', label: 'Bolt / Stud', color: 'bg-gray-100 text-gray-700' },
  { value: 'nut', label: 'Nut', color: 'bg-gray-100 text-gray-600' },
  { value: 'seal', label: 'Seal / O-Ring', color: 'bg-purple-100 text-purple-700' },
  { value: 'bearing', label: 'Bearing', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'consumable', label: 'Consumable', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'chemical', label: 'Chemical', color: 'bg-orange-100 text-orange-700' },
  { value: 'lubricant', label: 'Lubricant', color: 'bg-amber-100 text-amber-700' },
  { value: 'tool', label: 'Tool / Equipment', color: 'bg-green-100 text-green-700' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-500' },
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number]['value'];

export const UNITS_OF_MEASURE = [
  'EA', 'SET', 'BOX', 'ROLL', 'DRUM',
  'KG', 'G', 'L', 'ML', 'M', 'MM',
] as const;

export const PIPE_SIZES = [
  '1/2"', '3/4"', '1"', '1.5"', '2"', '3"',
  '4"', '6"', '8"', '10"', '12"', '14"',
  '16"', '18"', '20"', '24"',
] as const;

export const PRESSURE_RATINGS = [
  '150#', '#300', '#600', '#900', '#1500', '#2500',
] as const;

export const FLANGE_TYPES = [
  { value: 'RF', label: 'RF — Raised Face' },
  { value: 'RTJ', label: 'RTJ — Ring Type Joint' },
  { value: 'FF', label: 'FF — Full Face' },
  { value: 'MF', label: 'MF — Male/Female' },
] as const;

export const PROCUREMENT_STATUSES = [
  { value: 'not_requested', label: 'Not Requested', color: 'bg-gray-100 text-gray-500' },
  { value: 'requested', label: 'Requested', color: 'bg-blue-100 text-blue-700' },
  { value: 'approved', label: 'Approved', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'ordered', label: 'Ordered', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'received', label: 'Received', color: 'bg-green-100 text-green-700' },
  { value: 'issued', label: 'Issued', color: 'bg-green-200 text-green-800' },
  { value: 'partial', label: 'Partial', color: 'bg-amber-100 text-amber-700' },
] as const;

export const SAP_COLUMN_MAPPINGS: Record<string, string> = {
  MATNR: 'sap_material_number',
  Material: 'sap_material_number',
  MAKTX: 'description',
  'Material Description': 'description',
  MEINS: 'unit_of_measure',
  'Base Unit of Measure': 'unit_of_measure',
  MTART: 'sap_material_group',
  'Material Type': 'item_category',
  MFRPN: 'manufacturer_part_no',
  'Mfr Part Number': 'manufacturer_part_no',
  MFRNR: 'manufacturer',
  Manufacturer: 'manufacturer',
  WERKS: 'sap_plant',
  Plant: 'sap_plant',
  LGORT: 'sap_storage_location',
  'Stor. Location': 'sap_storage_location',
};

export const SAP_TYPE_TO_CATEGORY: Record<string, string> = {
  ZGAS: 'gasket', GAS: 'gasket',
  ZBLT: 'bolt', BLT: 'bolt',
  ZNUT: 'nut', NUT: 'nut',
  ZSEA: 'seal', SEA: 'seal',
  ZBER: 'bearing', BER: 'bearing',
  ZCON: 'consumable', CON: 'consumable',
  ZCHEM: 'chemical',
  ZLUB: 'lubricant',
  ZTOOL: 'tool',
  ROH: 'other',
  HALB: 'other',
  FERT: 'other',
};
