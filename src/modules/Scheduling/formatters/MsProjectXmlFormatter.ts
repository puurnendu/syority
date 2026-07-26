/**
 * Phase 1 — MS Project 2019 XML export. Synchronous formatter.
 * Input: Workpack with activities, udf_values (definition + option), and predecessor relationships.
 * Section 17.
 */

type ActivityWithUdf = {
    id: string;
    description: string;
    activity_code?: string | null;
    activity_number?: string | null;
    duration_hours?: unknown;
    progress_percent?: unknown;
    planned_start?: Date | null;
    planned_end?: Date | null;
    status?: string | null;
    udf_values?: Array<{
        definition?: { code: string } | null;
        option?: { description?: string; code_value?: string } | null;
        value_string?: string | null;
        value_number?: unknown;
    }> | null;
    predecessors?: Array<{ predecessor_id: string }> | null;
    predecessorRelationships?: Array<{ predecessor_id: string; relationship_type?: string; lag_hours?: unknown }> | null;
};

type MaterialLine = {
    id: string;
    source_type: string;
    source_id: string | null;
    description: string;
    quantity_required: number;
    unit_of_measure: string;
    sap_material_number?: string | null;
    item_catalog?: { item_code?: string | null; sap_material_number?: string | null } | null;
};

type WorkpackWithRelations = {
    title: string;
    workpack_number?: string | null;
    scope_of_work?: string | null;
    organization?: { name?: string } | null;
    planned_start_date?: Date | null;
    activities: ActivityWithUdf[];
    material_lines?: MaterialLine[] | null;
};

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function getUdfValue(act: ActivityWithUdf, code: string): string | null {
    const val = act.udf_values?.find((v) => v.definition?.code === code);
    if (!val) return null;
    const desc = val.option?.description ?? val.option?.code_value ?? null;
    if (desc) return desc;
    return val.value_string ?? null;
}

function getUdfNumber(act: ActivityWithUdf, code: string): number | null {
    const val = act.udf_values?.find((v) => v.definition?.code === code);
    if (!val || val.value_number == null) return null;
    const n = Number(val.value_number);
    return Number.isFinite(n) ? n : null;
}

function getUdfDisplayValue(act: ActivityWithUdf, code: string): string {
    const val = act.udf_values?.find((v) => v.definition?.code === code);
    if (!val) return '';
    const opt = val.option;
    if (opt) return (opt as any).label ?? opt.description ?? opt.code_value ?? '';
    return val.value_string ?? (val.value_number != null ? String(val.value_number) : '') ?? '';
}

type UdfDef = { code: string; name: string; type: string };

export class MsProjectXmlFormatter {
    static format(workpack: WorkpackWithRelations, udfDefinitions?: UdfDef[]): string {
        const activities = (workpack.activities ?? []).filter((a) => a != null);
        const idToIndex = new Map<string, number>();
        activities.forEach((a, idx) => idToIndex.set(a.id, idx + 1));

        const textFieldStart = 188743731;
        const numberFieldStart = 188743774;
        let textIdx = 0;
        let numberIdx = 0;
        const udfFieldMap: Array<{ udfCode: string; fieldId: number; fieldName: string; alias: string; isNumber: boolean }> = [];

        if (Array.isArray(udfDefinitions) && udfDefinitions.length > 0) {
            udfDefinitions.forEach((udf) => {
                if (udf.type === 'number') {
                    const fieldId = numberFieldStart + numberIdx++;
                    udfFieldMap.push({ udfCode: udf.code, fieldId, fieldName: `Number${numberIdx}`, alias: udf.name, isNumber: true });
                } else {
                    const fieldId = textFieldStart + textIdx++;
                    udfFieldMap.push({ udfCode: udf.code, fieldId, fieldName: `Text${textIdx}`, alias: udf.name, isNumber: false });
                }
            });
        }

        const extAttrDefs = udfFieldMap.length > 0
            ? udfFieldMap.map((f) => `<ExtendedAttribute><FieldID>${f.fieldId}</FieldID><FieldName>${f.fieldName}</FieldName><Alias>${escapeXml(f.alias)}</Alias></ExtendedAttribute>`).join('\n    ')
            : `
    <ExtendedAttribute><FieldID>188743731</FieldID><FieldName>Text1</FieldName><Alias>Discipline</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743732</FieldID><FieldName>Text2</FieldName><Alias>Hold Point</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743733</FieldID><FieldName>Text3</FieldName><Alias>QA Witness Party</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743734</FieldID><FieldName>Text4</FieldName><Alias>Activity Code</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743737</FieldID><FieldName>Text7</FieldName><Alias>Workpack Number</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743774</FieldID><FieldName>Number1</FieldName><Alias>Welding Qty (ID)</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743775</FieldID><FieldName>Number2</FieldName><Alias>Scaffolding Qty</Alias></ExtendedAttribute>
    <ExtendedAttribute><FieldID>188743776</FieldID><FieldName>Number3</FieldName><Alias>Progress %</Alias></ExtendedAttribute>`;

        const summaryTask = `
    <Task>
      <UID>0</UID><ID>0</ID>
      <Name>${escapeXml(workpack.title)}</Name>
      <OutlineLevel>0</OutlineLevel><Summary>1</Summary>
    </Task>`;

        const predList = (act: ActivityWithUdf) =>
            act.predecessorRelationships ?? act.predecessors ?? [];
        const typeMap: Record<string, number> = { FS: 0, SS: 1, FF: 2, SF: 3 };

        const tasks = activities
            .map((act, idx) => {
                const uid = idx + 1;
                const pct = Math.round(Number(act.progress_percent ?? 0));

                let extAttrs: string;
                if (udfFieldMap.length > 0) {
                    extAttrs = udfFieldMap
                        .map((f) => {
                            const displayVal = f.isNumber
                                ? (getUdfNumber(act as ActivityWithUdf, f.udfCode) ?? '')
                                : getUdfDisplayValue(act as ActivityWithUdf, f.udfCode);
                            if (displayVal === '') return '';
                            return `<ExtendedAttribute><FieldID>${f.fieldId}</FieldID><Value>${escapeXml(String(displayVal))}</Value></ExtendedAttribute>`;
                        })
                        .filter(Boolean)
                        .join('\n        ');
                } else {
                    const discipline = getUdfValue(act, 'discipline');
                    const holdPoint = getUdfValue(act, 'hold_point_type');
                    const witnessParty = getUdfValue(act, 'qa_witness_party');
                    const weldQty = getUdfNumber(act, 'welding_qty');
                    const scaffQty = getUdfNumber(act, 'scaffolding_qty');
                    extAttrs = [
                        discipline ? `<ExtendedAttribute><FieldID>188743731</FieldID><Value>${escapeXml(discipline)}</Value></ExtendedAttribute>` : '',
                        holdPoint ? `<ExtendedAttribute><FieldID>188743732</FieldID><Value>${escapeXml(holdPoint)}</Value></ExtendedAttribute>` : '',
                        witnessParty ? `<ExtendedAttribute><FieldID>188743733</FieldID><Value>${escapeXml(witnessParty)}</Value></ExtendedAttribute>` : '',
                        `<ExtendedAttribute><FieldID>188743734</FieldID><Value>${escapeXml(act.activity_code ?? act.activity_number ?? '')}</Value></ExtendedAttribute>`,
                        `<ExtendedAttribute><FieldID>188743737</FieldID><Value>${escapeXml(workpack.workpack_number ?? '')}</Value></ExtendedAttribute>`,
                        weldQty != null ? `<ExtendedAttribute><FieldID>188743774</FieldID><Value>${weldQty}</Value></ExtendedAttribute>` : '',
                        scaffQty != null ? `<ExtendedAttribute><FieldID>188743775</FieldID><Value>${scaffQty}</Value></ExtendedAttribute>` : '',
                        `<ExtendedAttribute><FieldID>188743776</FieldID><Value>${pct}</Value></ExtendedAttribute>`,
                    ]
                        .filter(Boolean)
                        .join('\n        ');
                }

                const preds = predList(act)
                    .map((rel: { predecessor_id: string; relationship_type?: string; lag_hours?: unknown }) => {
                        const predUid = idToIndex.get(rel.predecessor_id);
                        if (predUid == null) return '';
                        const type = typeMap[rel.relationship_type ?? 'FS'] ?? 0;
                        const lagMinutes = Math.round(Number(rel.lag_hours ?? 0) * 60);
                        return `
        <PredecessorLink>
          <PredecessorUID>${predUid}</PredecessorUID>
          <Type>${type}</Type>
          <Lag>${lagMinutes}</Lag>
          <LagFormat>19</LagFormat>
        </PredecessorLink>`;
                    })
                    .filter(Boolean)
                    .join('');

                const durationH = Number(act.duration_hours ?? 8);
                const startSeg = act.planned_start
                    ? `<Start>${(act.planned_start as Date).toISOString().replace('.000Z', '')}</Start>`
                    : '';
                const finishSeg = act.planned_end
                    ? `<Finish>${(act.planned_end as Date).toISOString().replace('.000Z', '')}</Finish>`
                    : '';
                const priority = act.status === 'on_hold' ? 1000 : 500;
                const durationXml = `PT${durationH}H0M0S`;

                return `
    <Task>
      <UID>${uid}</UID><ID>${uid}</ID>
      <Name>${escapeXml(act.description)}</Name>
      <OutlineLevel>1</OutlineLevel><Summary>0</Summary><Milestone>0</Milestone>
      <Duration>${durationXml}</Duration>
      <RemainingDuration>PT${Math.max(0, durationH * (1 - pct / 100))}H0M0S</RemainingDuration>
      <PercentComplete>${pct}</PercentComplete>
      <Priority>${priority}</Priority>
      ${startSeg}
      ${finishSeg}
      <ExtendedAttributes>${extAttrs}</ExtendedAttributes>${preds}
    </Task>`;
            })
            .join('');

        const activityMaterialLines = (workpack.material_lines ?? []).filter(
            (l) => l.source_type === 'activity' && l.source_id
        );
        const resourceMap = new Map<string, { uid: number; name: string; code: string }>();
        let resourceUid = 1;
        for (const line of activityMaterialLines) {
            const key = (line as any).item_catalog_id ?? line.description;
            if (!resourceMap.has(key)) {
                resourceMap.set(key, {
                    uid: resourceUid++,
                    name: line.description,
                    code: (line as any).item_code ?? line.item_catalog?.item_code ?? line.sap_material_number ?? line.item_catalog?.sap_material_number ?? '',
                });
            }
        }
        const resourcesXml = Array.from(resourceMap.values())
            .map(
                (r) => `
  <Resource>
    <UID>${r.uid}</UID>
    <ID>${r.uid}</ID>
    <Name>${escapeXml(r.name)}</Name>
    <Code>${escapeXml(r.code)}</Code>
    <Type>1</Type>
    <IsNull>0</IsNull>
    <MaxUnits>1</MaxUnits>
  </Resource>`
            )
            .join('');

        let assignUid = 1;
        const assignmentsXml = activityMaterialLines
            .map((line) => {
                const actIdx = activities.findIndex((a) => a.id === line.source_id);
                if (actIdx === -1) return '';
                const taskUid = actIdx + 1;
                const key = (line as any).item_catalog_id ?? line.description;
                const resource = resourceMap.get(key);
                if (!resource) return '';
                const notes = `${line.unit_of_measure}${line.sap_material_number ?? (line as any).item_catalog?.sap_material_number ? ` | SAP: ${line.sap_material_number ?? (line as any).item_catalog?.sap_material_number}` : ''}`;
                return `
  <Assignment>
    <UID>${assignUid++}</UID>
    <TaskUID>${taskUid}</TaskUID>
    <ResourceUID>${resource.uid}</ResourceUID>
    <Units>${line.quantity_required}</Units>
    <Notes>${escapeXml(notes)}</Notes>
  </Assignment>`;
            })
            .filter(Boolean)
            .join('');

        const startDate = workpack.planned_start_date
            ? (workpack.planned_start_date as Date).toISOString().replace('.000Z', '')
            : '';
        return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${escapeXml(workpack.title)}</Name>
  <Title>${escapeXml(workpack.workpack_number ?? workpack.title)}</Title>
  <Subject>${escapeXml((workpack.scope_of_work ?? '').slice(0, 255))}</Subject>
  <Company>${escapeXml(workpack.organization?.name ?? '')}</Company>
  <StartDate>${startDate}</StartDate>
  <DefaultView>Gantt Chart</DefaultView>
  <DefaultTaskType>0</DefaultTaskType>
  <DurationFormat>7</DurationFormat>
  <ExtendedAttributes>${extAttrDefs}</ExtendedAttributes>
  <Tasks>${summaryTask}${tasks}
  </Tasks>
  <Resources>${resourcesXml}
  </Resources>
  <Assignments>${assignmentsXml}
  </Assignments>
</Project>`;
    }
}
