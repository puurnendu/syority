/**
 * M8.6 — Seed Platform-Level Asset Attribute Definitions
 *
 * Creates ~80 attribute definitions for 9 equipment types.
 * All seeded with organization_id = null (PLATFORM scope).
 *
 * Architecture ref: M8.6_ASSET_REGISTER_FINAL_ARCHITECTURE.md §3 (R2.1)
 *
 * Usage: npx ts-node prisma/seed-asset-attribute-definitions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Type alias for a single definition seed row
// ---------------------------------------------------------------------------
type AttrDef = {
  code: string;
  name: string;
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'select';
  unit?: string;
  equipment_types: string[];
  group_name: string;
  group_sort_order: number;
  sort_order: number;
  is_required?: boolean;
  is_design_basis?: boolean;
  validation_rule?: Record<string, unknown>;
  select_options?: string[];
  description?: string;
};

// ---------------------------------------------------------------------------
// HEAT EXCHANGER attributes (~30)
// ---------------------------------------------------------------------------
const HEAT_EXCHANGER: AttrDef[] = [
  // Equipment Info
  { code: 'tema_designation',       name: 'TEMA Designation',      data_type: 'string',  equipment_types: ['heat_exchanger'], group_name: 'Equipment Info',   group_sort_order: 0, sort_order: 0 },
  { code: 'heat_exchanger_type',    name: 'HX Type',               data_type: 'select',  equipment_types: ['heat_exchanger'], group_name: 'Equipment Info',   group_sort_order: 0, sort_order: 1, select_options: ['Shell & Tube', 'Plate', 'Air Cooled', 'Double Pipe', 'Spiral'] },
  { code: 'surface_area_m2',       name: 'Heat Transfer Area',    data_type: 'number',  unit: 'm²',   equipment_types: ['heat_exchanger'], group_name: 'Equipment Info',   group_sort_order: 0, sort_order: 2, is_design_basis: true },
  // Dimensions
  { code: 'shell_id_mm',           name: 'Shell ID',              data_type: 'number',  unit: 'mm',   equipment_types: ['heat_exchanger'], group_name: 'Dimensions',       group_sort_order: 1, sort_order: 0, is_design_basis: true },
  { code: 'overall_length_mm',     name: 'Overall Length',        data_type: 'number',  unit: 'mm',   equipment_types: ['heat_exchanger'], group_name: 'Dimensions',       group_sort_order: 1, sort_order: 1 },
  { code: 'tube_length_mm',        name: 'Tube Length',           data_type: 'number',  unit: 'mm',   equipment_types: ['heat_exchanger'], group_name: 'Dimensions',       group_sort_order: 1, sort_order: 2 },
  { code: 'heat_surface_area_m2',  name: 'Heat Surface Area',     data_type: 'number',  unit: 'm²',   equipment_types: ['heat_exchanger'], group_name: 'Dimensions',       group_sort_order: 1, sort_order: 3 },
  { code: 'weight_flooded_kg',     name: 'Weight (Flooded)',      data_type: 'number',  unit: 'kg',   equipment_types: ['heat_exchanger'], group_name: 'Dimensions',       group_sort_order: 1, sort_order: 4 },
  // Tube Bundle
  { code: 'tube_od_mm',            name: 'Tube OD',               data_type: 'number',  unit: 'mm',   equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 0, is_design_basis: true },
  { code: 'tube_thickness_mm',     name: 'Tube Thickness',        data_type: 'number',  unit: 'mm',   equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 1 },
  { code: 'tube_count',            name: 'Tube Count',            data_type: 'number',  equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 2 },
  { code: 'tube_passes',           name: 'Tube Passes',           data_type: 'number',  equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 3 },
  { code: 'tube_pitch_mm',         name: 'Tube Pitch',            data_type: 'number',  unit: 'mm',   equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 4 },
  { code: 'tube_pattern',          name: 'Tube Pattern',          data_type: 'select',  equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 5, select_options: ['Triangular', 'Square', 'Rotated Triangular', 'Rotated Square'] },
  { code: 'tube_material',         name: 'Tube Material',         data_type: 'string',  equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 6 },
  { code: 'baffle_type',           name: 'Baffle Type',           data_type: 'select',  equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 7, select_options: ['Single Segmental', 'Double Segmental', 'Triple Segmental', 'No Baffles', 'Rod Baffle', 'Disc & Donut'] },
  { code: 'baffle_spacing_mm',     name: 'Baffle Spacing',        data_type: 'number',  unit: 'mm',   equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 8 },
  { code: 'baffle_cut_percent',    name: 'Baffle Cut',            data_type: 'number',  unit: '%',    equipment_types: ['heat_exchanger'], group_name: 'Tube Bundle',      group_sort_order: 2, sort_order: 9, validation_rule: { min: 0, max: 100 } },
  // Shell Side
  { code: 'shell_design_press_barg',   name: 'Shell Design Pressure',   data_type: 'number', unit: 'barg', equipment_types: ['heat_exchanger'], group_name: 'Shell Side',  group_sort_order: 3, sort_order: 0, is_design_basis: true },
  { code: 'shell_design_temp_c',       name: 'Shell Design Temperature', data_type: 'number', unit: '°C',  equipment_types: ['heat_exchanger'], group_name: 'Shell Side',  group_sort_order: 3, sort_order: 1, is_design_basis: true },
  { code: 'shell_test_press_barg',     name: 'Shell Test Pressure',     data_type: 'number', unit: 'barg', equipment_types: ['heat_exchanger'], group_name: 'Shell Side',  group_sort_order: 3, sort_order: 2 },
  { code: 'shell_material',            name: 'Shell Material',          data_type: 'string',              equipment_types: ['heat_exchanger'], group_name: 'Shell Side',  group_sort_order: 3, sort_order: 3 },
  { code: 'shell_corrosion_allow_mm',  name: 'Shell Corrosion Allowance', data_type: 'number', unit: 'mm', equipment_types: ['heat_exchanger'], group_name: 'Shell Side', group_sort_order: 3, sort_order: 4 },
  // Tube Side
  { code: 'tube_design_press_barg',    name: 'Tube Design Pressure',    data_type: 'number', unit: 'barg', equipment_types: ['heat_exchanger'], group_name: 'Tube Side',  group_sort_order: 4, sort_order: 0, is_design_basis: true },
  { code: 'tube_design_temp_c',        name: 'Tube Design Temperature', data_type: 'number', unit: '°C',  equipment_types: ['heat_exchanger'], group_name: 'Tube Side',  group_sort_order: 4, sort_order: 1, is_design_basis: true },
  { code: 'tube_test_press_barg',      name: 'Tube Test Pressure',      data_type: 'number', unit: 'barg', equipment_types: ['heat_exchanger'], group_name: 'Tube Side',  group_sort_order: 4, sort_order: 2 },
  { code: 'tubesheet_material',        name: 'Tubesheet Material',      data_type: 'string',              equipment_types: ['heat_exchanger'], group_name: 'Tube Side',  group_sort_order: 4, sort_order: 3 },
  // Design Codes
  { code: 'design_code_standard',      name: 'Design Code',             data_type: 'select',              equipment_types: ['heat_exchanger'], group_name: 'Design Codes', group_sort_order: 5, sort_order: 0, select_options: ['ASME VIII Div 1', 'ASME VIII Div 2', 'EN 13445', 'PD 5500', 'AD 2000'] },
  { code: 'stamp_number',              name: 'Stamp Number',            data_type: 'string',              equipment_types: ['heat_exchanger'], group_name: 'Design Codes', group_sort_order: 5, sort_order: 1 },
];

// ---------------------------------------------------------------------------
// VESSEL attributes (~15)
// ---------------------------------------------------------------------------
const VESSEL: AttrDef[] = [
  { code: 'vessel_type',               name: 'Vessel Type',             data_type: 'select',              equipment_types: ['vessel'], group_name: 'Equipment Info',    group_sort_order: 0, sort_order: 0, select_options: ['Drum', 'Separator', 'Reactor', 'Filter', 'Accumulator', 'Surge'] },
  { code: 'vessel_orientation',        name: 'Orientation',             data_type: 'select',              equipment_types: ['vessel'], group_name: 'Equipment Info',    group_sort_order: 0, sort_order: 1, select_options: ['Horizontal', 'Vertical'] },
  { code: 'vessel_id_mm',             name: 'Internal Diameter',       data_type: 'number', unit: 'mm',  equipment_types: ['vessel'], group_name: 'Dimensions',        group_sort_order: 1, sort_order: 0, is_design_basis: true },
  { code: 'vessel_tan_tan_mm',        name: 'Tan-Tan Length',          data_type: 'number', unit: 'mm',  equipment_types: ['vessel'], group_name: 'Dimensions',        group_sort_order: 1, sort_order: 1 },
  { code: 'vessel_wall_thickness_mm', name: 'Wall Thickness',          data_type: 'number', unit: 'mm',  equipment_types: ['vessel'], group_name: 'Dimensions',        group_sort_order: 1, sort_order: 2, is_design_basis: true },
  { code: 'vessel_head_type',         name: 'Head Type',               data_type: 'select',              equipment_types: ['vessel'], group_name: 'Dimensions',        group_sort_order: 1, sort_order: 3, select_options: ['Hemispherical', 'Ellipsoidal 2:1', 'Torispherical', 'Flat', 'Conical'] },
  { code: 'vessel_design_press_barg', name: 'Design Pressure',         data_type: 'number', unit: 'barg',equipment_types: ['vessel'], group_name: 'Design Conditions', group_sort_order: 2, sort_order: 0, is_design_basis: true },
  { code: 'vessel_design_temp_c',     name: 'Design Temperature',      data_type: 'number', unit: '°C', equipment_types: ['vessel'], group_name: 'Design Conditions', group_sort_order: 2, sort_order: 1, is_design_basis: true },
  { code: 'vessel_mdmt_c',            name: 'MDMT',                    data_type: 'number', unit: '°C', equipment_types: ['vessel'], group_name: 'Design Conditions', group_sort_order: 2, sort_order: 2 },
  { code: 'vessel_test_press_barg',   name: 'Test Pressure',           data_type: 'number', unit: 'barg',equipment_types: ['vessel'], group_name: 'Design Conditions', group_sort_order: 2, sort_order: 3 },
  { code: 'vessel_shell_material',    name: 'Shell Material',          data_type: 'string',              equipment_types: ['vessel'], group_name: 'Materials',         group_sort_order: 3, sort_order: 0 },
  { code: 'vessel_head_material',     name: 'Head Material',           data_type: 'string',              equipment_types: ['vessel'], group_name: 'Materials',         group_sort_order: 3, sort_order: 1 },
  { code: 'vessel_lining',            name: 'Internal Lining',         data_type: 'string',              equipment_types: ['vessel'], group_name: 'Materials',         group_sort_order: 3, sort_order: 2 },
  { code: 'vessel_corrosion_allow_mm',name: 'Corrosion Allowance',     data_type: 'number', unit: 'mm',  equipment_types: ['vessel'], group_name: 'Materials',         group_sort_order: 3, sort_order: 3 },
  { code: 'vessel_internals',         name: 'Internals Description',   data_type: 'string',              equipment_types: ['vessel'], group_name: 'Internals',         group_sort_order: 4, sort_order: 0 },
];

// ---------------------------------------------------------------------------
// COLUMN attributes (~12)
// ---------------------------------------------------------------------------
const COLUMN: AttrDef[] = [
  { code: 'column_type',              name: 'Column Type',             data_type: 'select',              equipment_types: ['column'], group_name: 'Equipment Info',    group_sort_order: 0, sort_order: 0, select_options: ['Tray', 'Packed', 'Hybrid'] },
  { code: 'column_id_mm',            name: 'Internal Diameter',       data_type: 'number', unit: 'mm',  equipment_types: ['column'], group_name: 'Dimensions',        group_sort_order: 1, sort_order: 0, is_design_basis: true },
  { code: 'column_tan_tan_mm',       name: 'Tan-Tan Height',          data_type: 'number', unit: 'mm',  equipment_types: ['column'], group_name: 'Dimensions',        group_sort_order: 1, sort_order: 1 },
  { code: 'column_wall_thickness_mm',name: 'Wall Thickness',          data_type: 'number', unit: 'mm',  equipment_types: ['column'], group_name: 'Dimensions',        group_sort_order: 1, sort_order: 2, is_design_basis: true },
  { code: 'column_tray_count',       name: 'Number of Trays',         data_type: 'number',              equipment_types: ['column'], group_name: 'Trays/Packing',     group_sort_order: 2, sort_order: 0 },
  { code: 'column_tray_type',        name: 'Tray Type',               data_type: 'select',              equipment_types: ['column'], group_name: 'Trays/Packing',     group_sort_order: 2, sort_order: 1, select_options: ['Sieve', 'Valve', 'Bubble Cap', 'Structured Packing', 'Random Packing'] },
  { code: 'column_tray_spacing_mm',  name: 'Tray Spacing',            data_type: 'number', unit: 'mm',  equipment_types: ['column'], group_name: 'Trays/Packing',     group_sort_order: 2, sort_order: 2 },
  { code: 'column_packing_type',     name: 'Packing Type',            data_type: 'string',              equipment_types: ['column'], group_name: 'Trays/Packing',     group_sort_order: 2, sort_order: 3 },
  { code: 'column_design_press_barg',name: 'Design Pressure',         data_type: 'number', unit: 'barg',equipment_types: ['column'], group_name: 'Design Conditions', group_sort_order: 3, sort_order: 0, is_design_basis: true },
  { code: 'column_design_temp_c',    name: 'Design Temperature',      data_type: 'number', unit: '°C', equipment_types: ['column'], group_name: 'Design Conditions', group_sort_order: 3, sort_order: 1, is_design_basis: true },
  { code: 'column_shell_material',   name: 'Shell Material',          data_type: 'string',              equipment_types: ['column'], group_name: 'Materials',         group_sort_order: 4, sort_order: 0 },
  { code: 'column_tray_material',    name: 'Tray/Packing Material',   data_type: 'string',              equipment_types: ['column'], group_name: 'Materials',         group_sort_order: 4, sort_order: 1 },
];

// ---------------------------------------------------------------------------
// PUMP attributes (~10)
// ---------------------------------------------------------------------------
const PUMP: AttrDef[] = [
  { code: 'pump_type',               name: 'Pump Type',               data_type: 'select',              equipment_types: ['pump'], group_name: 'Equipment Info',     group_sort_order: 0, sort_order: 0, select_options: ['Centrifugal', 'Positive Displacement', 'Reciprocating', 'Diaphragm', 'Gear', 'Screw'] },
  { code: 'pump_flow_m3h',          name: 'Rated Flow',              data_type: 'number', unit: 'm³/h',equipment_types: ['pump'], group_name: 'Performance',        group_sort_order: 1, sort_order: 0, is_design_basis: true },
  { code: 'pump_head_m',            name: 'Rated Head',              data_type: 'number', unit: 'm',   equipment_types: ['pump'], group_name: 'Performance',        group_sort_order: 1, sort_order: 1 },
  { code: 'pump_diff_press_barg',   name: 'Differential Pressure',   data_type: 'number', unit: 'barg',equipment_types: ['pump'], group_name: 'Performance',        group_sort_order: 1, sort_order: 2 },
  { code: 'pump_speed_rpm',         name: 'Speed',                   data_type: 'number', unit: 'RPM', equipment_types: ['pump'], group_name: 'Performance',        group_sort_order: 1, sort_order: 3 },
  { code: 'pump_npsh_req_m',        name: 'NPSH Required',           data_type: 'number', unit: 'm',   equipment_types: ['pump'], group_name: 'Performance',        group_sort_order: 1, sort_order: 4 },
  { code: 'pump_motor_power_kw',    name: 'Motor Power',             data_type: 'number', unit: 'kW',  equipment_types: ['pump'], group_name: 'Motor',              group_sort_order: 2, sort_order: 0 },
  { code: 'pump_motor_voltage',     name: 'Motor Voltage',           data_type: 'string',              equipment_types: ['pump'], group_name: 'Motor',              group_sort_order: 2, sort_order: 1 },
  { code: 'pump_seal_type',         name: 'Seal Type',               data_type: 'select',              equipment_types: ['pump'], group_name: 'Seal',               group_sort_order: 3, sort_order: 0, select_options: ['Single Mechanical', 'Double Mechanical', 'Tandem', 'Packed Gland', 'Magnetic Drive'] },
  { code: 'pump_casing_material',   name: 'Casing Material',         data_type: 'string',              equipment_types: ['pump'], group_name: 'Materials',          group_sort_order: 4, sort_order: 0 },
];

// ---------------------------------------------------------------------------
// COMPRESSOR attributes (~8)
// ---------------------------------------------------------------------------
const COMPRESSOR: AttrDef[] = [
  { code: 'compressor_type',         name: 'Compressor Type',         data_type: 'select',              equipment_types: ['compressor'], group_name: 'Equipment Info',  group_sort_order: 0, sort_order: 0, select_options: ['Centrifugal', 'Reciprocating', 'Screw', 'Axial', 'Scroll'] },
  { code: 'compressor_flow_m3h',    name: 'Rated Capacity',          data_type: 'number', unit: 'm³/h',equipment_types: ['compressor'], group_name: 'Performance',     group_sort_order: 1, sort_order: 0, is_design_basis: true },
  { code: 'compressor_suction_barg',name: 'Suction Pressure',        data_type: 'number', unit: 'barg',equipment_types: ['compressor'], group_name: 'Performance',     group_sort_order: 1, sort_order: 1 },
  { code: 'compressor_discharge_barg',name: 'Discharge Pressure',    data_type: 'number', unit: 'barg',equipment_types: ['compressor'], group_name: 'Performance',     group_sort_order: 1, sort_order: 2, is_design_basis: true },
  { code: 'compressor_speed_rpm',   name: 'Speed',                   data_type: 'number', unit: 'RPM', equipment_types: ['compressor'], group_name: 'Performance',     group_sort_order: 1, sort_order: 3 },
  { code: 'compressor_driver_type', name: 'Driver Type',             data_type: 'select',              equipment_types: ['compressor'], group_name: 'Driver',          group_sort_order: 2, sort_order: 0, select_options: ['Electric Motor', 'Gas Turbine', 'Steam Turbine', 'Engine'] },
  { code: 'compressor_driver_kw',   name: 'Driver Power',            data_type: 'number', unit: 'kW',  equipment_types: ['compressor'], group_name: 'Driver',          group_sort_order: 2, sort_order: 1 },
  { code: 'compressor_seal_type',   name: 'Seal Type',               data_type: 'select',              equipment_types: ['compressor'], group_name: 'Seal',            group_sort_order: 3, sort_order: 0, select_options: ['Dry Gas Seal', 'Oil Film Seal', 'Labyrinth', 'Carbon Ring'] },
];

// ---------------------------------------------------------------------------
// AIR COOLED HEAT EXCHANGER attributes (~8)
// ---------------------------------------------------------------------------
const AIR_COOLED_HX: AttrDef[] = [
  { code: 'ache_bundle_count',       name: 'Bundle Count',            data_type: 'number',              equipment_types: ['heat_exchanger_air'], group_name: 'Equipment Info', group_sort_order: 0, sort_order: 0 },
  { code: 'ache_bay_width_mm',      name: 'Bay Width',               data_type: 'number', unit: 'mm',  equipment_types: ['heat_exchanger_air'], group_name: 'Dimensions',     group_sort_order: 1, sort_order: 0 },
  { code: 'ache_tube_length_mm',    name: 'Tube Length',             data_type: 'number', unit: 'mm',  equipment_types: ['heat_exchanger_air'], group_name: 'Dimensions',     group_sort_order: 1, sort_order: 1 },
  { code: 'ache_fan_count',         name: 'Fan Count',               data_type: 'number',              equipment_types: ['heat_exchanger_air'], group_name: 'Fans',           group_sort_order: 2, sort_order: 0 },
  { code: 'ache_fan_diameter_mm',   name: 'Fan Diameter',            data_type: 'number', unit: 'mm',  equipment_types: ['heat_exchanger_air'], group_name: 'Fans',           group_sort_order: 2, sort_order: 1 },
  { code: 'ache_fan_motor_kw',      name: 'Fan Motor Power',         data_type: 'number', unit: 'kW',  equipment_types: ['heat_exchanger_air'], group_name: 'Fans',           group_sort_order: 2, sort_order: 2 },
  { code: 'ache_design_press_barg', name: 'Design Pressure',         data_type: 'number', unit: 'barg',equipment_types: ['heat_exchanger_air'], group_name: 'Design Conditions', group_sort_order: 3, sort_order: 0, is_design_basis: true },
  { code: 'ache_design_temp_c',     name: 'Design Temperature',      data_type: 'number', unit: '°C', equipment_types: ['heat_exchanger_air'], group_name: 'Design Conditions', group_sort_order: 3, sort_order: 1, is_design_basis: true },
];

// ---------------------------------------------------------------------------
// TANK attributes (~8)
// ---------------------------------------------------------------------------
const TANK: AttrDef[] = [
  { code: 'tank_type',              name: 'Tank Type',               data_type: 'select',              equipment_types: ['tank'], group_name: 'Equipment Info',      group_sort_order: 0, sort_order: 0, select_options: ['Fixed Roof', 'Floating Roof', 'Bullet', 'Sphere', 'Horizontal Cylinder'] },
  { code: 'tank_diameter_mm',      name: 'Diameter',                data_type: 'number', unit: 'mm',  equipment_types: ['tank'], group_name: 'Dimensions',          group_sort_order: 1, sort_order: 0, is_design_basis: true },
  { code: 'tank_height_mm',        name: 'Height',                  data_type: 'number', unit: 'mm',  equipment_types: ['tank'], group_name: 'Dimensions',          group_sort_order: 1, sort_order: 1 },
  { code: 'tank_capacity_m3',      name: 'Nominal Capacity',        data_type: 'number', unit: 'm³',  equipment_types: ['tank'], group_name: 'Dimensions',          group_sort_order: 1, sort_order: 2 },
  { code: 'tank_design_press_barg',name: 'Design Pressure',         data_type: 'number', unit: 'barg',equipment_types: ['tank'], group_name: 'Design Conditions',   group_sort_order: 2, sort_order: 0, is_design_basis: true },
  { code: 'tank_design_temp_c',    name: 'Design Temperature',      data_type: 'number', unit: '°C', equipment_types: ['tank'], group_name: 'Design Conditions',   group_sort_order: 2, sort_order: 1, is_design_basis: true },
  { code: 'tank_roof_type',        name: 'Roof Type',               data_type: 'select',              equipment_types: ['tank'], group_name: 'Roof',                group_sort_order: 3, sort_order: 0, select_options: ['Cone', 'Dome', 'Internal Floating', 'External Floating', 'Geodesic'] },
  { code: 'tank_shell_material',   name: 'Shell Material',          data_type: 'string',              equipment_types: ['tank'], group_name: 'Materials',           group_sort_order: 4, sort_order: 0 },
];

// ---------------------------------------------------------------------------
// VALVE attributes (~5)
// ---------------------------------------------------------------------------
const VALVE: AttrDef[] = [
  { code: 'valve_type',             name: 'Valve Type',              data_type: 'select',              equipment_types: ['valve'], group_name: 'Valve',               group_sort_order: 0, sort_order: 0, select_options: ['Gate', 'Globe', 'Ball', 'Butterfly', 'Check', 'Plug', 'Needle', 'Diaphragm', 'Relief'] },
  { code: 'valve_size_inches',      name: 'Size',                    data_type: 'number', unit: 'in',  equipment_types: ['valve'], group_name: 'Valve',               group_sort_order: 0, sort_order: 1 },
  { code: 'valve_rating',           name: 'Rating',                  data_type: 'select',              equipment_types: ['valve'], group_name: 'Valve',               group_sort_order: 0, sort_order: 2, select_options: ['150#', '300#', '600#', '900#', '1500#', '2500#'] },
  { code: 'valve_body_material',    name: 'Body Material',           data_type: 'string',              equipment_types: ['valve'], group_name: 'Valve',               group_sort_order: 0, sort_order: 3 },
  { code: 'valve_actuator_type',    name: 'Actuator Type',           data_type: 'select',              equipment_types: ['valve'], group_name: 'Actuator',            group_sort_order: 1, sort_order: 0, select_options: ['Manual', 'Pneumatic', 'Electric', 'Hydraulic', 'Self-Acting'] },
];

// ---------------------------------------------------------------------------
// INSTRUMENT attributes (~5)
// ---------------------------------------------------------------------------
const INSTRUMENT: AttrDef[] = [
  { code: 'instrument_type',        name: 'Instrument Type',         data_type: 'select',              equipment_types: ['instrument'], group_name: 'Instrument',       group_sort_order: 0, sort_order: 0, select_options: ['Transmitter', 'Gauge', 'Switch', 'Control Valve', 'Analyzer', 'Flow Meter', 'Level Sensor', 'Thermocouple'] },
  { code: 'instrument_range_min',   name: 'Range Min',               data_type: 'number',              equipment_types: ['instrument'], group_name: 'Range',            group_sort_order: 1, sort_order: 0 },
  { code: 'instrument_range_max',   name: 'Range Max',               data_type: 'number',              equipment_types: ['instrument'], group_name: 'Range',            group_sort_order: 1, sort_order: 1 },
  { code: 'instrument_range_unit',  name: 'Range Unit',              data_type: 'string',              equipment_types: ['instrument'], group_name: 'Range',            group_sort_order: 1, sort_order: 2 },
  { code: 'instrument_signal_type', name: 'Signal Type',             data_type: 'select',              equipment_types: ['instrument'], group_name: 'Signal',           group_sort_order: 2, sort_order: 0, select_options: ['4-20mA', '0-10V', 'HART', 'Fieldbus', 'Modbus', 'Profibus', 'Wireless'] },
];

// ---------------------------------------------------------------------------
// Combine all definitions
// ---------------------------------------------------------------------------
const ALL_DEFINITIONS: AttrDef[] = [
  ...HEAT_EXCHANGER,
  ...VESSEL,
  ...COLUMN,
  ...PUMP,
  ...COMPRESSOR,
  ...AIR_COOLED_HX,
  ...TANK,
  ...VALVE,
  ...INSTRUMENT,
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seedAssetAttributeDefinitions() {
  console.log(`\n🌱 Seeding ${ALL_DEFINITIONS.length} platform-level asset attribute definitions...\n`);

  let created = 0;
  let skipped = 0;

  for (const def of ALL_DEFINITIONS) {
    const existing = await prisma.assetAttributeDefinition.findUnique({
      where: { org_attr_code: { organization_id: null as any, code: def.code } },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.assetAttributeDefinition.create({
      data: {
        organization_id: null,  // PLATFORM scope
        code: def.code,
        name: def.name,
        description: def.description ?? null,
        data_type: def.data_type,
        unit: def.unit ?? null,
        equipment_types: def.equipment_types,
        group_name: def.group_name,
        group_sort_order: def.group_sort_order,
        sort_order: def.sort_order,
        is_required: def.is_required ?? false,
        is_design_basis: def.is_design_basis ?? false,
        validation_rule: (def.validation_rule as any) ?? undefined,
        select_options: (def.select_options as any) ?? undefined,
        scope: 'PLATFORM',
        is_active: true,
      },
    });
    created++;
  }

  console.log(`  ✅ Created: ${created}`);
  console.log(`  ⏩ Skipped (already exist): ${skipped}`);
  console.log(`  📊 Total definitions available: ${created + skipped}\n`);

  // Summary by equipment type
  const byType: Record<string, number> = {};
  for (const def of ALL_DEFINITIONS) {
    for (const et of def.equipment_types) {
      byType[et] = (byType[et] || 0) + 1;
    }
  }
  console.log('  📋 Definitions per equipment type:');
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`     ${type}: ${count}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------
seedAssetAttributeDefinitions()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
