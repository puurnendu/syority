/**
 * AI joint extraction prompt and standard fallback joints by equipment type.
 */

export const JOINT_TEXT_PROMPT = (
  equipmentTag: string,
  equipmentType: string,
  spec: string
) => `
You are a mechanical engineer analyzing technical data for a maintenance workpack.

Equipment: ${equipmentTag} (${equipmentType})
Reference Data/Spec: 
${spec || 'Standard heat exchanger'}

Extract all nozzle and flange data from the provided text.
Return ONLY a valid JSON array of objects. No intro/outro text.

Keys to use:
- joint_number: e.g. J-${equipmentTag}-N1
- location: e.g. Shell Inlet Nozzle
- flange_size: e.g. 4 inch, 8 inch
- flange_rating: e.g. 150#, 300#, Class 900
- flange_type: e.g. RF, RTJ
- specification: e.g. CS, LTCS, A105
- tightening_method: Torque or Tensioning

If data is missing from the spec, suggest standard values based on your technical knowledge for this equipment type.
`;

export const JOINT_EXTRACTION_PROMPT = (equipmentTag: string, equipmentType: string) => `
You are an expert piping researcher. Analyse this equipment drawing or datasheet and extract ALL flange joints that must be opened and reinstated.

Equipment: ${equipmentTag || 'N/A'} (${equipmentType || 'N/A'})

For each joint/nozzle, extract:
1. Joint No: e.g., J-E101-N1 (use J- prefix + tag + mark).
2. Location: e.g., Shell Inlet Nozzle N1, Tube Outlet N2.
3. Size: e.g., 4", 8", 12 inch. CRITICAL: Find nominal pipe size!
4. Rating: e.g., 150#, 300#, Class 600.
5. Facing/Type: e.g., RF, RTJ, FF.
6. Line Number: e.g., 10"-HC-1201.
7. Pipe Spec: e.g., CS, Spec A1A.
8. Tightening: Torque or Tensioning.

Return ONLY a valid JSON array of objects. Keys: joint_number, location, flange_size, flange_rating, flange_type, line_number, specification, tightening_method.
`;

export type ExtractedJoint = {
  jointNo: string;
  lineNumber?: string | null;
  size?: string | null;
  pipeSpec?: string | null;
  flangeRating?: string | null; // Changed from rating to be explicit
  flangeType?: string | null;   // Added
  location?: string | null;
  gasketType?: string | null;
  gasketMaterial?: string | null;
  boltSpec?: string | null;
  tighteningMethod?: string | null;
  torqueValue?: number | null;
  status?: string | null;
};

const STANDARD_JOINTS: Record<string, Array<{ location: string; size: string | null; flangeRating: string | null }>> = {
  heat_exchanger: [
    { location: 'Shell Inlet Nozzle', size: null, flangeRating: null },
    { location: 'Shell Outlet Nozzle', size: null, flangeRating: null },
    { location: 'Tube Inlet Channel', size: null, flangeRating: null },
    { location: 'Tube Outlet Channel', size: null, flangeRating: null },
    { location: 'Shell Vent', size: null, flangeRating: null },
    { location: 'Shell Drain', size: null, flangeRating: null },
    { location: 'Channel Cover (Front)', size: null, flangeRating: null },
    { location: 'Channel Cover (Rear)', size: null, flangeRating: null },
    { location: 'Floating Head Cover', size: null, flangeRating: null },
  ],
  pressure_vessel: [
    { location: 'Manway', size: null, flangeRating: null },
    { location: 'Inlet Nozzle', size: null, flangeRating: null },
    { location: 'Outlet Nozzle', size: null, flangeRating: null },
    { location: 'Vent', size: null, flangeRating: null },
    { location: 'Drain', size: null, flangeRating: null },
  ],
  pump: [
    { location: 'Suction Flange', size: null, flangeRating: null },
    { location: 'Discharge Flange', size: null, flangeRating: null },
    { location: 'Seal Flush Connection', size: null, flangeRating: null },
  ],
};

export function getStandardJointsForType(
  equipmentType: string,
  equipmentTag: string
): ExtractedJoint[] {
  const key = (equipmentType || '').toLowerCase().replace(/\s+/g, '_');
  const list = STANDARD_JOINTS[key] ?? STANDARD_JOINTS.heat_exchanger;
  const prefix = equipmentTag ? `J-${equipmentTag.replace(/\s+/g, '')}-` : 'J-';
  return list.map((row, i) => ({
    jointNo: `${prefix}${String(i + 1).padStart(3, '0')}`,
    lineNumber: null,
    size: row.size,
    pipeSpec: null,
    flangeRating: row.flangeRating,
    location: row.location,
    gasketType: null,
    gasketMaterial: null,
    boltSpec: null,
    tighteningMethod: null,
    torqueValue: null,
    status: 'pending',
  }));
}
