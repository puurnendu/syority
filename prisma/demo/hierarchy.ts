/** Realistic refinery process units → systems → sample assets */

export type UnitDef = {
  name: string;
  code: string;
  systems: { name: string; code: string; assets: { tag: string; name: string; type: string }[] }[];
};

export const PROCESS_UNITS: UnitDef[] = [
  {
    name: 'Crude Distillation Unit',
    code: 'CDU',
    systems: [
      {
        name: 'Crude Preheat Train',
        code: 'CDU-PHT',
        assets: [
          { tag: 'E-101A', name: 'Crude / Top Pump-around Exchanger A', type: 'Shell & Tube Heat Exchanger' },
          { tag: 'E-101B', name: 'Crude / Top Pump-around Exchanger B', type: 'Shell & Tube Heat Exchanger' },
          { tag: 'P-101A', name: 'Crude Charge Pump A', type: 'Centrifugal Pump' },
          { tag: 'P-101B', name: 'Crude Charge Pump B', type: 'Centrifugal Pump' },
        ],
      },
      {
        name: 'Atmospheric Column',
        code: 'CDU-ATM',
        assets: [
          { tag: 'C-101', name: 'Atmospheric Distillation Column', type: 'Distillation Column' },
          { tag: 'E-110', name: 'Overhead Condenser', type: 'Air Cooler / Fin Fan' },
          { tag: 'V-110', name: 'Overhead Receiver', type: 'Drum / Knockout Drum' },
          { tag: 'P-110A', name: 'Reflux Pump A', type: 'Centrifugal Pump' },
        ],
      },
      {
        name: 'Desalter Package',
        code: 'CDU-DES',
        assets: [
          { tag: 'V-102', name: 'Desalter Vessel', type: 'Pressure Vessel' },
          { tag: 'T-102', name: 'Desalter Transformer', type: 'Transformer' },
        ],
      },
    ],
  },
  {
    name: 'Vacuum Distillation Unit',
    code: 'VDU',
    systems: [
      {
        name: 'Vacuum Column System',
        code: 'VDU-COL',
        assets: [
          { tag: 'C-201', name: 'Vacuum Distillation Column', type: 'Distillation Column' },
          { tag: 'E-201', name: 'Vacuum Heater Charge Exchanger', type: 'Shell & Tube Heat Exchanger' },
          { tag: 'H-201', name: 'Vacuum Heater', type: 'Fired Heater' },
          { tag: 'P-201A', name: 'Vacuum Residue Pump A', type: 'Centrifugal Pump' },
        ],
      },
      {
        name: 'Vacuum Ejector System',
        code: 'VDU-EJT',
        assets: [
          { tag: 'EJ-201', name: 'Primary Steam Ejector', type: 'Steam Trap' },
          { tag: 'V-220', name: 'Intercondenser KO Drum', type: 'Drum / Knockout Drum' },
        ],
      },
    ],
  },
  {
    name: 'Fluid Catalytic Cracking Unit',
    code: 'FCCU',
    systems: [
      {
        name: 'Reactor–Regenerator',
        code: 'FCC-RR',
        assets: [
          { tag: 'R-301', name: 'FCC Reactor', type: 'Reactor' },
          { tag: 'RG-301', name: 'FCC Regenerator', type: 'Reactor' },
          { tag: 'BL-301', name: 'Air Blower', type: 'Blower' },
          { tag: 'C-301', name: 'Main Fractionator', type: 'Distillation Column' },
        ],
      },
      {
        name: 'Wet Gas Compressor',
        code: 'FCC-WGC',
        assets: [
          { tag: 'K-310', name: 'Wet Gas Compressor', type: 'Centrifugal Compressor' },
          { tag: 'M-310', name: 'WGC Driver Motor', type: 'Induction Motor' },
        ],
      },
    ],
  },
  {
    name: 'Hydrocracker Unit',
    code: 'HCU',
    systems: [
      {
        name: 'Reactor Loop',
        code: 'HCU-RX',
        assets: [
          { tag: 'R-401A', name: 'Hydrocracker Reactor A', type: 'Reactor' },
          { tag: 'R-401B', name: 'Hydrocracker Reactor B', type: 'Reactor' },
          { tag: 'K-401', name: 'Recycle Gas Compressor', type: 'Centrifugal Compressor' },
          { tag: 'E-410', name: 'Feed / Effluent Exchanger', type: 'Shell & Tube Heat Exchanger' },
        ],
      },
      {
        name: 'Fractionation',
        code: 'HCU-FRAC',
        assets: [
          { tag: 'C-410', name: 'Product Fractionator', type: 'Distillation Column' },
          { tag: 'P-420A', name: 'Fractionator Bottoms Pump A', type: 'Centrifugal Pump' },
        ],
      },
    ],
  },
  {
    name: 'Continuous Catalytic Reformer',
    code: 'CCR',
    systems: [
      {
        name: 'CCR Reactor Stack',
        code: 'CCR-RX',
        assets: [
          { tag: 'R-501', name: 'CCR Reactor Stack', type: 'Reactor' },
          { tag: 'H-501', name: 'CCR Charge Heater', type: 'Fired Heater' },
          { tag: 'K-501', name: 'Hydrogen Recycle Compressor', type: 'Centrifugal Compressor' },
        ],
      },
    ],
  },
  {
    name: 'Hydrogen Plant',
    code: 'H2PL',
    systems: [
      {
        name: 'Steam Methane Reformer',
        code: 'H2-SMR',
        assets: [
          { tag: 'H-601', name: 'SMR Reformer', type: 'Fired Heater' },
          { tag: 'R-601', name: 'Shift Converter', type: 'Reactor' },
          { tag: 'V-610', name: 'PSA Feed KO Drum', type: 'Drum / Knockout Drum' },
        ],
      },
    ],
  },
  {
    name: 'Sulphur Recovery Unit',
    code: 'SRU',
    systems: [
      {
        name: 'Claus Reaction Train',
        code: 'SRU-CLS',
        assets: [
          { tag: 'R-701', name: 'Claus Thermal Reactor', type: 'Reactor' },
          { tag: 'E-701', name: 'Waste Heat Boiler', type: 'Boiler' },
          { tag: 'C-701', name: 'Claus Condenser Column', type: 'Distillation Column' },
        ],
      },
    ],
  },
  {
    name: 'Utilities',
    code: 'UTIL',
    systems: [
      {
        name: 'Steam Generation',
        code: 'UTL-STM',
        assets: [
          { tag: 'B-801A', name: 'Package Boiler A', type: 'Boiler' },
          { tag: 'B-801B', name: 'Package Boiler B', type: 'Boiler' },
          { tag: 'P-810A', name: 'Boiler Feedwater Pump A', type: 'Centrifugal Pump' },
        ],
      },
      {
        name: 'Instrument Air',
        code: 'UTL-IA',
        assets: [
          { tag: 'K-820A', name: 'Instrument Air Compressor A', type: 'Screw Compressor' },
          { tag: 'V-820', name: 'IA Receiver', type: 'Pressure Vessel' },
          { tag: 'FLT-820', name: 'IA Dryer / Filter', type: 'Filter / Strainer' },
        ],
      },
      {
        name: 'Fire Water',
        code: 'UTL-FW',
        assets: [
          { tag: 'P-830A', name: 'Fire Water Pump Diesel', type: 'Centrifugal Pump' },
          { tag: 'P-830B', name: 'Fire Water Pump Electric', type: 'Centrifugal Pump' },
          { tag: 'T-830', name: 'Fire Water Storage Tank', type: 'Storage Tank' },
        ],
      },
    ],
  },
  {
    name: 'Tank Farm',
    code: 'TKFM',
    systems: [
      {
        name: 'Crude Storage',
        code: 'TK-CRD',
        assets: [
          { tag: 'T-901', name: 'Crude Tank T-901', type: 'Storage Tank' },
          { tag: 'T-902', name: 'Crude Tank T-902', type: 'Storage Tank' },
          { tag: 'P-901A', name: 'Tank Farm Transfer Pump A', type: 'Centrifugal Pump' },
        ],
      },
      {
        name: 'Product Storage',
        code: 'TK-PRD',
        assets: [
          { tag: 'T-910', name: 'MS Storage Tank', type: 'Storage Tank' },
          { tag: 'T-911', name: 'HSD Storage Tank', type: 'Storage Tank' },
          { tag: 'T-920', name: 'LPG Bullet', type: 'Sphere / Bullet' },
        ],
      },
    ],
  },
  {
    name: 'Offsites',
    code: 'OFFS',
    systems: [
      {
        name: 'Flare System',
        code: 'OFF-FLR',
        assets: [
          { tag: 'FL-001', name: 'Main Flare Stack', type: 'Pressure Vessel' },
          { tag: 'K-001', name: 'Flare Gas Recovery Compressor', type: 'Screw Compressor' },
        ],
      },
      {
        name: 'Oily Water Treatment',
        code: 'OFF-OWT',
        assets: [
          { tag: 'V-050', name: 'CPI Separator', type: 'Pressure Vessel' },
          { tag: 'P-050A', name: 'Oily Water Pump A', type: 'Centrifugal Pump' },
        ],
      },
    ],
  },
  {
    name: 'Cooling Water',
    code: 'CWTR',
    systems: [
      {
        name: 'Cooling Tower',
        code: 'CW-CT',
        assets: [
          { tag: 'CT-001A', name: 'Cooling Tower Cell A', type: 'Cooling Tower Cell' },
          { tag: 'CT-001B', name: 'Cooling Tower Cell B', type: 'Cooling Tower Cell' },
          { tag: 'P-060A', name: 'CW Circulation Pump A', type: 'Centrifugal Pump' },
          { tag: 'P-060B', name: 'CW Circulation Pump B', type: 'Centrifugal Pump' },
        ],
      },
    ],
  },
  {
    name: 'Boilers',
    code: 'BLRS',
    systems: [
      {
        name: 'HP Steam Header',
        code: 'BLR-HP',
        assets: [
          { tag: 'B-010A', name: 'HP Boiler A', type: 'Boiler' },
          { tag: 'B-010B', name: 'HP Boiler B', type: 'Boiler' },
          { tag: 'PV-010', name: 'HP Steam Drum', type: 'Pressure Vessel' },
        ],
      },
    ],
  },
  {
    name: 'Electrical',
    code: 'ELEC',
    systems: [
      {
        name: '33kV Substation',
        code: 'EL-SS',
        assets: [
          { tag: 'TR-001', name: '33/6.6 kV Transformer', type: 'Transformer' },
          { tag: 'SG-001', name: '6.6 kV Switchgear', type: 'Switchgear' },
          { tag: 'MCC-101', name: 'Process MCC-101', type: 'MCC Bucket' },
        ],
      },
    ],
  },
  {
    name: 'Instrument Air',
    code: 'IAIR',
    systems: [
      {
        name: 'IA Distribution',
        code: 'IA-DIST',
        assets: [
          { tag: 'K-IA01', name: 'IA Compressor Package', type: 'Screw Compressor' },
          { tag: 'V-IA01', name: 'IA Dry Receiver', type: 'Pressure Vessel' },
        ],
      },
    ],
  },
  {
    name: 'Fire Water',
    code: 'FWTR',
    systems: [
      {
        name: 'Fire Fighting Network',
        code: 'FW-NET',
        assets: [
          { tag: 'P-FW01', name: 'Electric Fire Pump', type: 'Centrifugal Pump' },
          { tag: 'P-FW02', name: 'Diesel Fire Pump', type: 'Centrifugal Pump' },
          { tag: 'T-FW01', name: 'Fire Water Reservoir', type: 'Storage Tank' },
        ],
      },
    ],
  },
];

export const CONTRACTOR_UNITS: UnitDef[] = [
  {
    name: 'Shutdown Project Office',
    code: 'PROJ',
    systems: [
      {
        name: 'Planning Cell',
        code: 'PRJ-PLN',
        assets: [
          { tag: 'OFF-01', name: 'Planning Workstations', type: 'DCS / PLC Cabinet' },
        ],
      },
      {
        name: 'Warehouse Staging',
        code: 'PRJ-WH',
        assets: [
          { tag: 'WH-01', name: 'Material Staging Bay', type: 'Storage Tank' },
          { tag: 'CR-01', name: 'Site Mobile Crane 50T', type: 'Mobile Crane 50T' },
        ],
      },
    ],
  },
];
