/**
 * AssetExtractionMapper — Canonical AI extraction → EAV mapping.
 *
 * This is the SINGLE authoritative mapper for transforming AI-extracted
 * technical data into flat Asset Register attribute entries.
 *
 * Used by:
 * - extract-technical-data/route.ts (AI extraction pipeline)
 * - ReviewService.approveCandidate() (Digital Plant approval bridge)
 *
 * Architecture ref: M8.6 P0-003 / P1-005 (Correction #3)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FlattenedAttribute = {
  code: string;
  value_string?: string | null;
  value_number?: number | null;
  value_boolean?: boolean | null;
  value_date?: Date | null;
};

// ── Section → Field → Attribute Code Mapping ─────────────────────────────────

const SECTION_FIELD_MAP: Record<string, Record<string, string>> = {
  equipment: {
    tema_designation: 'tema_designation',
    type: 'heat_exchanger_type',
  },
  dimensions: {
    shell_id_mm: 'shell_id_mm',
    overall_length_mm: 'overall_length_mm',
    tube_length_mm: 'tube_length_mm',
    heat_surface_area_m2: 'surface_area_m2',
    weight_flooded_kg: 'weight_flooded_kg',
    weight_dry_kg: 'weight_dry_kg',
    weight_operating_kg: 'weight_operating_kg',
  },
  tube_bundle: {
    total_tubes: 'tube_count',
    tube_passes: 'tube_passes',
    tube_od_mm: 'tube_od_mm',
    tube_thickness_mm: 'tube_thickness_mm',
    tube_arrangement: 'tube_pattern',
    baffle_type: 'baffle_type',
  },
  shell_side: {
    design_pressure_kg_cm2: 'shell_design_press_barg',
    design_temp_c: 'shell_design_temp_c',
    test_pressure_kg_cm2: 'shell_test_press_barg',
    medium: 'shell_side_medium',
    flow_rate: 'shell_side_flow_rate',
    inlet_temp_c: 'shell_inlet_temp_c',
    outlet_temp_c: 'shell_outlet_temp_c',
    pressure_drop_kg_cm2: 'shell_pressure_drop',
    velocity_m_s: 'shell_velocity_m_s',
  },
  tube_side: {
    design_pressure_kg_cm2: 'tube_design_press_barg',
    design_temp_c: 'tube_design_temp_c',
    test_pressure_kg_cm2: 'tube_test_press_barg',
    medium: 'tube_side_medium',
    flow_rate: 'tube_side_flow_rate',
    inlet_temp_c: 'tube_inlet_temp_c',
    outlet_temp_c: 'tube_outlet_temp_c',
    pressure_drop_kg_cm2: 'tube_pressure_drop',
    velocity_m_s: 'tube_velocity_m_s',
  },
};

// ── AI Response Normalization ─────────────────────────────────────────────────

const SECTION_MAPPINGS: Record<string, Record<string, string>> = {
  dimensions: {
    shell_id: 'shell_id_mm',
    shellId: 'shell_id_mm',
    overall_length: 'overall_length_mm',
    overallLength: 'overall_length_mm',
    tube_length: 'tube_length_mm',
    tubeLength: 'tube_length_mm',
    heat_surface: 'heat_surface_area_m2',
    heatSurface: 'heat_surface_area_m2',
    weight_dry: 'weight_dry_kg',
    weightDry: 'weight_dry_kg',
    weight_operating: 'weight_operating_kg',
    weightOperating: 'weight_operating_kg',
    weight_flooded: 'weight_flooded_kg',
    weightFlooded: 'weight_flooded_kg',
  },
  tube_bundle: {
    tube_od: 'tube_od_mm',
    tubeOD: 'tube_od_mm',
    tube_thickness: 'tube_thickness_mm',
    tubeThickness: 'tube_thickness_mm',
  },
  shell_side: {
    inlet_temp: 'inlet_temp_c',
    inletTemp: 'inlet_temp_c',
    outlet_temp: 'outlet_temp_c',
    outletTemp: 'outlet_temp_c',
    design_pressure: 'design_pressure_kg_cm2',
    designPressure: 'design_pressure_kg_cm2',
    test_pressure: 'test_pressure_kg_cm2',
    testPressure: 'test_pressure_kg_cm2',
    design_temp: 'design_temp_c',
    designTemp: 'design_temp_c',
    pressure_drop: 'pressure_drop_kg_cm2',
    pressureDrop: 'pressure_drop_kg_cm2',
    velocity: 'velocity_m_s',
  },
  tube_side: {
    inlet_temp: 'inlet_temp_c',
    inletTemp: 'inlet_temp_c',
    outlet_temp: 'outlet_temp_c',
    outletTemp: 'outlet_temp_c',
    design_pressure: 'design_pressure_kg_cm2',
    designPressure: 'design_pressure_kg_cm2',
    test_pressure: 'test_pressure_kg_cm2',
    testPressure: 'test_pressure_kg_cm2',
    design_temp: 'design_temp_c',
    designTemp: 'design_temp_c',
    pressure_drop: 'pressure_drop_kg_cm2',
    pressureDrop: 'pressure_drop_kg_cm2',
    velocity: 'velocity_m_s',
  },
};

// ── Service ───────────────────────────────────────────────────────────────────

export class AssetExtractionMapper {
  /**
   * Normalize AI response field names to match the expected system field names.
   * E.g., `shell_id` → `shell_id_mm`, `tubeOD` → `tube_od_mm`
   */
  static normalizeAiResponse(raw: any): any {
    if (!raw || typeof raw !== 'object') return raw;

    const mapped = JSON.parse(JSON.stringify(raw)); // Clone

    for (const [section, mappings] of Object.entries(SECTION_MAPPINGS)) {
      if (mapped[section] && typeof mapped[section] === 'object') {
        const sectionData = mapped[section];
        for (const [aiKey, systemKey] of Object.entries(mappings)) {
          if (systemKey in sectionData) continue; // Priority already correct
          if (aiKey in sectionData) {
            sectionData[systemKey] = sectionData[aiKey];
          }
        }
      }
    }

    return mapped;
  }

  /**
   * Transform nested AI-extracted JSON into flat attribute entries
   * matching Asset Register EAV codes for batchSetAttributeValues().
   */
  static flattenExtractedData(data: any): FlattenedAttribute[] {
    const result: FlattenedAttribute[] = [];
    if (!data || typeof data !== 'object') return result;

    for (const [section, fieldMap] of Object.entries(SECTION_FIELD_MAP)) {
      const sectionData = data[section];
      if (!sectionData || typeof sectionData !== 'object') continue;

      for (const [aiField, attrCode] of Object.entries(fieldMap)) {
        const val = sectionData[aiField];
        if (val === null || val === undefined) continue;

        if (typeof val === 'number') {
          result.push({ code: attrCode, value_number: val });
        } else if (typeof val === 'string' && val.trim() !== '') {
          result.push({ code: attrCode, value_string: val.trim() });
        } else if (typeof val === 'boolean') {
          result.push({ code: attrCode, value_boolean: val });
        }
      }
    }

    return result;
  }

  /**
   * Combined: normalize AI response + flatten to EAV attributes.
   * This is the canonical entry point used by all extraction callers.
   */
  static fromAiResponse(rawAiData: any): FlattenedAttribute[] {
    const normalized = AssetExtractionMapper.normalizeAiResponse(rawAiData);
    return AssetExtractionMapper.flattenExtractedData(normalized);
  }

  /**
   * Map from extracted_attributes (Digital Plant format) to flat EAV attributes.
   * Used by ReviewService when bridging from candidate approval to Asset Register.
   *
   * The Digital Plant extraction stores flat key/value pairs like:
   * { "tema_designation": "AEU", "design_pressure_barg": 45.0, ... }
   *
   * This method converts those to AssetRegister attribute codes.
   */
  static fromExtractedAttributes(attrs: Record<string, any>): FlattenedAttribute[] {
    const result: FlattenedAttribute[] = [];

    // Direct mappings from Digital Plant flat keys to Asset Register codes
    const directMap: Record<string, string> = {
      tema_designation: 'tema_designation',
      design_pressure_barg: 'shell_design_press_barg',
      design_temp_c: 'shell_design_temp_c',
      operating_pressure_barg: 'shell_operating_press_barg',
      operating_temp_c: 'shell_operating_temp_c',
      test_pressure_barg: 'shell_test_press_barg',
    };

    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined) continue;
      const code = directMap[key] ?? key; // Use mapping or pass through
      if (typeof value === 'number') {
        result.push({ code, value_number: value });
      } else if (typeof value === 'string' && value.trim() !== '') {
        result.push({ code, value_string: value.trim() });
      } else if (typeof value === 'boolean') {
        result.push({ code, value_boolean: value });
      }
    }

    return result;
  }

  /**
   * Transforms flat Asset Register EAV attributes + asset core data + nozzles
   * into the canonical nested legacy equipment_technical_data structure
   * expected by the PDF template and legacy consumers.
   *
   * Handles inputs as:
   * - Array of AssetAttributeValue objects (e.g. from snapshot or live query)
   * - Key-value Record<string, any> of attribute codes
   */
  static toLegacyEquipmentTechnicalData(
    attributes: Record<string, any> | Array<any>,
    assetCoreData?: any,
    nozzlesList?: any[]
  ): Record<string, any> {
    const attrMap: Record<string, any> = {};

    if (Array.isArray(attributes)) {
      for (const item of attributes) {
        const code = item.code || item.definition?.code;
        if (!code) continue;
        const val = item.value !== undefined
          ? item.value
          : (item.value_number ?? item.value_string ?? item.value_boolean ?? item.value_date ?? null);
        if (val !== null && val !== undefined) {
          attrMap[code] = val;
        }
      }
    } else if (attributes && typeof attributes === 'object') {
      for (const [k, v] of Object.entries(attributes)) {
        if (v && typeof v === 'object' && ('value' in v || 'value_number' in v || 'value_string' in v)) {
          const val = (v as any).value !== undefined
            ? (v as any).value
            : ((v as any).value_number ?? (v as any).value_string ?? (v as any).value_boolean ?? (v as any).value_date ?? null);
          if (val !== null && val !== undefined) attrMap[k] = val;
        } else if (v !== null && v !== undefined) {
          attrMap[k] = v;
        }
      }
    }

    const getVal = (...codes: string[]) => {
      for (const code of codes) {
        if (attrMap[code] !== undefined && attrMap[code] !== null) return attrMap[code];
      }
      return null;
    };

    const equipment: Record<string, any> = {
      name: assetCoreData?.name ?? assetCoreData?.tag_number ?? getVal('equipment_name', 'tag_number'),
      type: getVal('heat_exchanger_type', 'equipment_type', 'asset_type') ?? assetCoreData?.asset_type ?? 'Heat Exchanger',
      tema_designation: getVal('tema_designation'),
    };

    const dimensions: Record<string, any> = {
      shell_id_mm: getVal('shell_id_mm', 'shell_id'),
      overall_length_mm: getVal('overall_length_mm', 'overall_length'),
      tube_length_mm: getVal('tube_length_mm', 'tube_length'),
      heat_surface_area_m2: getVal('surface_area_m2', 'heat_surface_area_m2', 'heat_surface'),
      weight_dry_kg: getVal('weight_dry_kg', 'weight_dry'),
      weight_operating_kg: getVal('weight_operating_kg', 'weight_operating'),
      weight_flooded_kg: getVal('weight_flooded_kg', 'weight_flooded'),
    };

    const tube_bundle: Record<string, any> = {
      total_tubes: getVal('tube_count', 'total_tubes'),
      tube_passes: getVal('tube_passes'),
      tube_od_mm: getVal('tube_od_mm', 'tube_od', 'tubeOD'),
      tube_thickness_mm: getVal('tube_thickness_mm', 'tube_thickness', 'tubeThickness'),
      tube_arrangement: getVal('tube_pattern', 'tube_arrangement'),
      baffle_type: getVal('baffle_type'),
    };

    const shell_side: Record<string, any> = {
      medium: getVal('shell_side_medium', 'medium'),
      flow_rate: getVal('shell_side_flow_rate', 'flow_rate'),
      inlet_temp_c: getVal('shell_inlet_temp_c', 'inlet_temp_c', 'inlet_temp'),
      outlet_temp_c: getVal('shell_outlet_temp_c', 'outlet_temp_c', 'outlet_temp'),
      design_pressure_kg_cm2: getVal('shell_design_press_barg', 'shell_design_pressure_kg_cm2', 'design_pressure_kg_cm2', 'design_pressure'),
      test_pressure_kg_cm2: getVal('shell_test_press_barg', 'shell_test_pressure_kg_cm2', 'test_pressure_kg_cm2', 'test_pressure'),
      design_temp_c: getVal('shell_design_temp_c', 'design_temp_c', 'design_temp'),
      pressure_drop_kg_cm2: getVal('shell_pressure_drop', 'shell_pressure_drop_kg_cm2', 'pressure_drop_kg_cm2', 'pressure_drop'),
      velocity_m_s: getVal('shell_velocity_m_s', 'velocity_m_s', 'velocity'),
      passes: getVal('shell_passes', 'passes'),
    };

    const tube_side: Record<string, any> = {
      medium: getVal('tube_side_medium'),
      flow_rate: getVal('tube_side_flow_rate'),
      inlet_temp_c: getVal('tube_inlet_temp_c'),
      outlet_temp_c: getVal('tube_outlet_temp_c'),
      design_pressure_kg_cm2: getVal('tube_design_press_barg', 'tube_design_pressure_kg_cm2'),
      test_pressure_kg_cm2: getVal('tube_test_press_barg', 'tube_test_pressure_kg_cm2'),
      design_temp_c: getVal('tube_design_temp_c'),
      pressure_drop_kg_cm2: getVal('tube_pressure_drop', 'tube_pressure_drop_kg_cm2'),
      velocity_m_s: getVal('tube_velocity_m_s'),
      passes: getVal('tube_passes'),
    };

    const materials: Record<string, any> = {};
    for (const [k, v] of Object.entries(attrMap)) {
      if (k.startsWith('mat_') || k.startsWith('material_')) {
        materials[k.replace(/^(mat_|material_)/, '')] = v;
      }
    }
    if (getVal('shell_material')) materials['shell'] = getVal('shell_material');
    if (getVal('tube_material')) materials['tubes'] = getVal('tube_material');
    if (getVal('tubesheet_material')) materials['tubesheet'] = getVal('tubesheet_material');
    if (getVal('channel_material')) materials['channel'] = getVal('channel_material');

    // Nozzles
    const nozzles: { shell_side: any[]; tube_side: any[] } = { shell_side: [], tube_side: [] };
    if (Array.isArray(nozzlesList)) {
      for (const n of nozzlesList) {
        const item = {
          mark: n.designation ?? n.mark ?? 'N',
          service: n.service ?? '—',
          size: n.nominal_size_inches ? `${n.nominal_size_inches}"` : (n.size ?? '—'),
          rating: n.pressure_rating ?? n.rating ?? '—',
        };
        const des = String(n.designation || n.mark || '').toLowerCase();
        if (des.startsWith('s') || des.includes('shell')) {
          nozzles.shell_side.push(item);
        } else {
          nozzles.tube_side.push(item);
        }
      }
    }

    const design_codes: string[] = [];
    const designCodeVal = getVal('design_code', 'design_codes', 'design_standard');
    if (Array.isArray(designCodeVal)) {
      design_codes.push(...designCodeVal);
    } else if (typeof designCodeVal === 'string' && designCodeVal) {
      design_codes.push(designCodeVal);
    }

    return {
      equipment,
      dimensions,
      tube_bundle,
      shell_side,
      tube_side,
      materials,
      nozzles,
      design_codes,
      ...attrMap,
    };
  }
}
