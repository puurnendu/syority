import { prisma, disconnect } from './seed-client';

type FieldDef = {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean';
    required?: boolean;
    unit?: string;
    options?: string[];
    auto_from?: string;
    placeholder?: string;
};

const TEMPLATES = [
    {
        cert_type: 'hydrotest_shell',
        cert_name: 'Hydrotest Certificate — Shell Side',
        equipment_types: ['Heat Exchanger', 'Shell and Tube Heat Exchanger', 'Pressure Vessel'],
        version: 1,
        fields: [
            { key: 'asset_tag', label: 'Asset / Equipment Tag', type: 'text', required: true, auto_from: 'workpack.asset_tag' },
            { key: 'asset_description', label: 'Equipment Description', type: 'text', auto_from: 'workpack.asset_name' },
            { key: 'design_pressure_bar', label: 'Design Pressure (barg)', type: 'number', unit: 'barg', required: true },
            { key: 'test_pressure_bar', label: 'Test Pressure (barg)', type: 'number', unit: 'barg', required: true, placeholder: '1.5× design pressure' },
            { key: 'test_medium', label: 'Test Medium', type: 'select', required: true, options: ['Demineralised Water', 'Hydraulic Oil', 'Nitrogen', 'Instrument Air'] },
            { key: 'test_duration_mins', label: 'Hold Duration (minutes)', type: 'number', unit: 'min', required: true, placeholder: 'Minimum 30 minutes' },
            { key: 'ambient_temp_c', label: 'Ambient Temperature (°C)', type: 'number', unit: '°C' },
            { key: 'test_date', label: 'Date of Test', type: 'date', required: true },
            { key: 'tested_by', label: 'Tested By', type: 'text', required: true },
            { key: 'witnessed_by', label: 'Witnessed By (Inspector / Client)', type: 'text' },
            { key: 'leaks_observed', label: 'Any Leaks Observed?', type: 'select', required: true, options: ['No', 'Yes — see remarks'] },
            { key: 'pressure_drop_bar', label: 'Pressure Drop over Hold Period (bar)', type: 'number', unit: 'bar' },
            { key: 'remarks', label: 'Remarks / Observations', type: 'textarea' },
        ] as FieldDef[],
    },
    {
        cert_type: 'hydrotest_tube',
        cert_name: 'Hydrotest Certificate — Tube Side',
        equipment_types: ['Heat Exchanger', 'Shell and Tube Heat Exchanger'],
        version: 1,
        fields: [
            { key: 'asset_tag', label: 'Asset / Equipment Tag', type: 'text', required: true, auto_from: 'workpack.asset_tag' },
            { key: 'asset_description', label: 'Equipment Description', type: 'text', auto_from: 'workpack.asset_name' },
            { key: 'tube_design_pressure_bar', label: 'Tube Side Design Pressure (barg)', type: 'number', unit: 'barg', required: true },
            { key: 'tube_test_pressure_bar', label: 'Tube Side Test Pressure (barg)', type: 'number', unit: 'barg', required: true },
            { key: 'test_medium', label: 'Test Medium', type: 'select', required: true, options: ['Demineralised Water', 'Hydraulic Oil', 'Nitrogen', 'Instrument Air'] },
            { key: 'test_duration_mins', label: 'Hold Duration (minutes)', type: 'number', unit: 'min', required: true },
            { key: 'test_date', label: 'Date of Test', type: 'date', required: true },
            { key: 'tested_by', label: 'Tested By', type: 'text', required: true },
            { key: 'witnessed_by', label: 'Witnessed By', type: 'text' },
            { key: 'leaks_observed', label: 'Any Leaks Observed?', type: 'select', required: true, options: ['No', 'Yes — see remarks'] },
            { key: 'remarks', label: 'Remarks', type: 'textarea' },
        ] as FieldDef[],
    },
    {
        cert_type: 'hydrotest_final',
        cert_name: 'Hydrotest Certificate — Final',
        equipment_types: ['Heat Exchanger', 'Shell and Tube Heat Exchanger', 'Pressure Vessel', 'Piping System'],
        version: 1,
        fields: [
            { key: 'asset_tag', label: 'Asset / Equipment Tag', type: 'text', required: true, auto_from: 'workpack.asset_tag' },
            { key: 'test_scope', label: 'Scope of Test', type: 'textarea', placeholder: 'Describe the full scope tested' },
            { key: 'final_test_pressure_bar', label: 'Final Test Pressure (barg)', type: 'number', unit: 'barg', required: true },
            { key: 'test_medium', label: 'Test Medium', type: 'select', required: true, options: ['Demineralised Water', 'Hydraulic Oil', 'Nitrogen', 'Instrument Air'] },
            { key: 'test_duration_mins', label: 'Hold Duration (minutes)', type: 'number', unit: 'min', required: true },
            { key: 'test_date', label: 'Date of Test', type: 'date', required: true },
            { key: 'final_result', label: 'Final Result', type: 'select', required: true, options: ['Pass', 'Fail', 'Conditional Pass'] },
            { key: 'approved_by_inspector', label: 'Approved by Inspector', type: 'text' },
            { key: 'client_witness', label: 'Client Witness', type: 'text' },
            { key: 'approval_date', label: 'Approval Date', type: 'date' },
            { key: 'remarks', label: 'Remarks', type: 'textarea' },
        ] as FieldDef[],
    },
    {
        cert_type: 'boxup',
        cert_name: 'Box-up / Reinstatement Certificate',
        equipment_types: ['Heat Exchanger', 'Shell and Tube Heat Exchanger', 'Pressure Vessel', 'Pump', 'Compressor', 'Valve'],
        version: 1,
        fields: [
            { key: 'asset_tag', label: 'Asset / Equipment Tag', type: 'text', required: true, auto_from: 'workpack.asset_tag' },
            { key: 'asset_description', label: 'Equipment Description', type: 'text', auto_from: 'workpack.asset_name' },
            { key: 'bundle_installed', label: 'Bundle / Internals Installed', type: 'boolean' },
            { key: 'gaskets_replaced', label: 'All Gaskets Replaced (new)', type: 'boolean' },
            { key: 'gasket_spec', label: 'Gasket Specification', type: 'text', placeholder: 'e.g. CAF 3mm ASME B16.21 RF' },
            { key: 'bolts_torqued', label: 'Bolts Torqued to Spec', type: 'boolean' },
            { key: 'torque_spec_nm', label: 'Torque Specification (N·m)', type: 'number', unit: 'N·m' },
            { key: 'blinds_removed', label: 'All Blinds Removed', type: 'boolean' },
            { key: 'blind_register_ref', label: 'Blind Register Reference', type: 'text', auto_from: 'workpack.workpack_id_code' },
            { key: 'instrument_connections_reinstated', label: 'Instrument Connections Reinstated', type: 'boolean' },
            { key: 'boxup_date', label: 'Box-up Completed Date', type: 'date', required: true },
            { key: 'completed_by', label: 'Completed By (Lead Technician)', type: 'text', required: true },
            { key: 'verified_by', label: 'Verified By (Supervisor)', type: 'text', required: true },
            { key: 'remarks', label: 'Remarks', type: 'textarea' },
        ] as FieldDef[],
    },
    {
        cert_type: 'torque',
        cert_name: 'Flange Torque Certificate',
        equipment_types: ['Heat Exchanger', 'Shell and Tube Heat Exchanger', 'Pressure Vessel', 'Piping System', 'Pump'],
        version: 1,
        fields: [
            { key: 'asset_tag', label: 'Asset / Equipment Tag', type: 'text', required: true, auto_from: 'workpack.asset_tag' },
            { key: 'flange_location', label: 'Flange Location / Identifier', type: 'text', required: true, placeholder: 'e.g. N1 Nozzle, Shell Flange' },
            { key: 'flange_size', label: 'Flange Size', type: 'text', placeholder: 'e.g. 12" ASME B16.5 #300 RF' },
            { key: 'bolt_size_grade', label: 'Bolt Size & Grade', type: 'text', placeholder: 'e.g. M30 A193 B7 / A194 2H' },
            { key: 'bolt_count', label: 'Number of Bolts', type: 'number' },
            { key: 'torque_stage_1_nm', label: 'Stage 1 Torque (N·m)', type: 'number', unit: 'N·m', required: true },
            { key: 'torque_stage_2_nm', label: 'Stage 2 Torque (N·m)', type: 'number', unit: 'N·m', required: true },
            { key: 'torque_final_nm', label: 'Final Torque (N·m)', type: 'number', unit: 'N·m', required: true },
            { key: 'torque_tool_id', label: 'Torque Wrench Tool ID / Cal Due', type: 'text', placeholder: 'e.g. TW-042 Cal due 2026-06-01' },
            { key: 'lubricant_used', label: 'Lubricant / Anti-seize Used', type: 'text', placeholder: 'e.g. Molykote Cu-7439 Plus' },
            { key: 'torque_date', label: 'Date of Torque', type: 'date', required: true },
            { key: 'torqued_by', label: 'Torqued By', type: 'text', required: true },
            { key: 'verified_by', label: 'Verified By (Supervisor)', type: 'text', required: true },
            { key: 'remarks', label: 'Remarks', type: 'textarea' },
        ] as FieldDef[],
    },
    {
        cert_type: 'reinstatement',
        cert_name: 'Equipment Reinstatement Certificate',
        equipment_types: ['Heat Exchanger', 'Pump', 'Compressor', 'Pressure Vessel'],
        version: 1,
        fields: [
            { key: 'asset_tag', label: 'Asset / Equipment Tag', type: 'text', required: true, auto_from: 'workpack.asset_tag' },
            { key: 'workpack_ref', label: 'Workpack Reference', type: 'text', auto_from: 'workpack.workpack_id_code' },
            { key: 'maintenance_scope', label: 'Summary of Maintenance Scope', type: 'textarea', required: true },
            { key: 'all_certs_signed', label: 'All Certificates Signed Off', type: 'boolean' },
            { key: 'hydrotest_complete', label: 'Hydrotest Complete', type: 'boolean' },
            { key: 'boxup_complete', label: 'Box-up Complete', type: 'boolean' },
            { key: 'torque_complete', label: 'Torque Complete', type: 'boolean' },
            { key: 'blinds_cleared', label: 'Blind Register Cleared', type: 'boolean' },
            { key: 'isolation_removed', label: 'Isolation Removed / LOTO Released', type: 'boolean' },
            { key: 'ready_for_commissioning', label: 'Ready for Commissioning / Startup', type: 'boolean' },
            { key: 'reinstatement_date', label: 'Date of Reinstatement', type: 'date', required: true },
            { key: 'authorised_by', label: 'Authorised By (Engineer / Supervisor)', type: 'text', required: true },
            { key: 'client_approval', label: 'Client / Operations Approval', type: 'text' },
            { key: 'remarks', label: 'Remarks', type: 'textarea' },
        ] as FieldDef[],
    },
] as const;

async function main() {
    console.log(`Seeding ${TEMPLATES.length} certificate templates...`);

    for (const t of TEMPLATES) {
        const existing = await prisma.certificateTemplate.findFirst({
            where: {
                cert_type: t.cert_type,
                organization_id: null,
            },
            select: { id: true, version: true },
        });

        if (existing) {
            await prisma.certificateTemplate.update({
                where: { id: existing.id },
                data: {
                    cert_name: t.cert_name,
                    equipment_types: [...t.equipment_types],
                    fields: t.fields as object,
                    version: t.version,
                    is_active: true,
                },
            });
            console.log(`  ↺  Updated: ${t.cert_name}`);
        } else {
            await prisma.certificateTemplate.create({
                data: {
                    organization_id: null,
                    cert_type: t.cert_type,
                    cert_name: t.cert_name,
                    equipment_types: [...t.equipment_types],
                    fields: t.fields as object,
                    is_active: true,
                    is_platform: true,
                    version: t.version,
                },
            });
            console.log(`  ✓  Created: ${t.cert_name}`);
        }
    }

    const count = await prisma.certificateTemplate.count({
        where: { is_active: true },
    });
    console.log(`\nDone. ${count} active certificate templates total.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => disconnect());
