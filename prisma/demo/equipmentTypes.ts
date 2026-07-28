/** 100+ realistic refining equipment types for Platform Standard Library */
const BASE: { name: string; code: string; description: string }[] = [
  { name: 'Centrifugal Pump', code: 'PMP-CF', description: 'API 610 centrifugal process pump' },
  { name: 'Positive Displacement Pump', code: 'PMP-PD', description: 'Reciprocating / gear / screw pump' },
  { name: 'Vertical Sump Pump', code: 'PMP-VS', description: 'Vertical wet-pit sump pump' },
  { name: 'Canned Motor Pump', code: 'PMP-CM', description: 'Sealless canned motor pump' },
  { name: 'Induction Motor', code: 'MOT-IM', description: 'LV/MV squirrel-cage induction motor' },
  { name: 'Synchronous Motor', code: 'MOT-SM', description: 'Synchronous drive motor' },
  { name: 'Steam Turbine', code: 'TRB-ST', description: 'Backpressure / condensing steam turbine' },
  { name: 'Gas Turbine', code: 'TRB-GT', description: 'Industrial gas turbine driver' },
  { name: 'Gate Valve', code: 'VLV-GT', description: 'Process gate valve' },
  { name: 'Globe Valve', code: 'VLV-GB', description: 'Throttling globe valve' },
  { name: 'Ball Valve', code: 'VLV-BL', description: 'Trunnion / floating ball valve' },
  { name: 'Butterfly Valve', code: 'VLV-BF', description: 'High-performance butterfly valve' },
  { name: 'Control Valve', code: 'VLV-CV', description: 'Pneumatic / electric control valve' },
  { name: 'PSV / PRV', code: 'VLV-PSV', description: 'Pressure safety / relief valve' },
  { name: 'Check Valve', code: 'VLV-CK', description: 'Non-return check valve' },
  { name: 'Shell & Tube Heat Exchanger', code: 'HEX-ST', description: 'TEMA shell-and-tube exchanger' },
  { name: 'Air Cooler / Fin Fan', code: 'HEX-AC', description: 'Forced / induced draft air cooler' },
  { name: 'Plate Heat Exchanger', code: 'HEX-PL', description: 'Gasketed plate heat exchanger' },
  { name: 'Double Pipe Exchanger', code: 'HEX-DP', description: 'Hairpin / double-pipe exchanger' },
  { name: 'Reciprocating Compressor', code: 'CMP-RC', description: 'API 618 reciprocating compressor' },
  { name: 'Centrifugal Compressor', code: 'CMP-CC', description: 'API 617 centrifugal compressor' },
  { name: 'Screw Compressor', code: 'CMP-SC', description: 'Oil-flooded / dry screw compressor' },
  { name: 'Pressure Vessel', code: 'VSL-PV', description: 'ASME VIII pressure vessel' },
  { name: 'Drum / Knockout Drum', code: 'VSL-DR', description: 'Process drum / KO drum' },
  { name: 'Storage Tank', code: 'TNK-AT', description: 'Atmospheric storage tank' },
  { name: 'Sphere / Bullet', code: 'TNK-PR', description: 'Pressure storage sphere or bullet' },
  { name: 'Distillation Column', code: 'COL-DS', description: 'Fractionation / distillation column' },
  { name: 'Absorber / Stripper', code: 'COL-AB', description: 'Absorption or stripping column' },
  { name: 'Reactor', code: 'RCT-FX', description: 'Fixed-bed / CCR reactor' },
  { name: 'Filter / Strainer', code: 'FLT-CS', description: 'Cartridge / basket filter' },
  { name: 'Centrifugal Fan', code: 'FAN-CF', description: 'Process / FD / ID fan' },
  { name: 'Blower', code: 'BLW-PD', description: 'Positive displacement blower' },
  { name: 'Fired Heater', code: 'HTR-FH', description: 'Process fired heater' },
  { name: 'Boiler', code: 'BLR-WH', description: 'Waste heat / package boiler' },
  { name: 'Cooling Tower Cell', code: 'CTW-CL', description: 'Cooling tower cell / fan stack' },
  { name: 'Transformer', code: 'ELC-XF', description: 'Power transformer' },
  { name: 'Switchgear', code: 'ELC-SG', description: 'MV/LV switchgear assembly' },
  { name: 'MCC Bucket', code: 'ELC-MCC', description: 'Motor control centre unit' },
  { name: 'Cable Tray / Bus Duct', code: 'ELC-CB', description: 'Power distribution hardware' },
  { name: 'Transmitter', code: 'INS-TX', description: 'Pressure / flow / level transmitter' },
  { name: 'Analyzer', code: 'INS-AN', description: 'Process analyzer / GC' },
  { name: 'Flow Meter', code: 'INS-FM', description: 'Orifice / vortex / Coriolis meter' },
  { name: 'Level Gauge / LT', code: 'INS-LG', description: 'Level instrumentation' },
  { name: 'DCS / PLC Cabinet', code: 'INS-DCS', description: 'Control system cabinet' },
  { name: 'Scaffold Structure', code: 'SCF-ST', description: 'Temporary scaffolding' },
  { name: 'Blind / Spacer', code: 'PIP-BL', description: 'Line blind / spectacle blind' },
  { name: 'Expansion Joint', code: 'PIP-EJ', description: 'Piping expansion joint' },
  { name: 'Steam Trap', code: 'PIP-ST', description: 'Steam condensate trap' },
  { name: 'Agitator / Mixer', code: 'AGT-MX', description: 'Vessel agitator' },
  { name: 'Conveyor', code: 'CNV-BT', description: 'Belt / screw conveyor' },
];

const VARIANTS = [
  'Carbon Steel',
  'Stainless Steel',
  'Alloy 825',
  'Low Temperature',
  'High Temperature',
  'Cryogenic',
  'Sour Service',
  'High Pressure',
  'Heavy Duty',
  'Spare Rotating',
];

export function buildEquipmentTypes(): { name: string; code: string; description: string }[] {
  const out = [...BASE];
  let i = 0;
  while (out.length < 110) {
    const base = BASE[i % BASE.length];
    const v = VARIANTS[Math.floor(i / BASE.length) % VARIANTS.length];
    const seq = Math.floor(i / (BASE.length * VARIANTS.length)) + 1;
    out.push({
      name: `${base.name} — ${v}${seq > 1 ? ` ${seq}` : ''}`,
      code: `${base.code}-${String(i + 1).padStart(3, '0')}`,
      description: `${base.description} (${v} service class)`,
    });
    i++;
  }
  return out.slice(0, 110);
}
