import { NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { sanitiseFilename } from '@/lib/utils/filename';

/**
 * MS Project XML (MSPDI) — compatible with Project 2016, 2019, 2021, and Microsoft Project Online.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { session, error } = await guardApi('workpacks.export.xml');
    if (error) return error;
    const { orgId } = orgScope(session!);
    const { id } = await params;

    const workpack = await prisma.workpack.findFirst({
        where: { id, organization_id: orgId, deleted_at: null },
        select: {
            workpack_id_code: true,
            title: true,
            planned_start_date: true,
            planned_end_date: true,
        },
    });
    if (!workpack) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const activities = await prisma.activity.findMany({
        where: { workpack_id: id, deleted_at: null },
        orderBy: { sequence_number: 'asc' },
        include: {
            discipline: { select: { code: true, name: true } },
        },
    });

    function esc(s: string): string {
        return (s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function mspDate(d: Date | null | undefined): string {
        if (!d) return '';
        return new Date(d).toISOString().replace('Z', '') + '00:00:00';
    }

    function mspStatus(status: string | null | undefined): number {
        if (status === 'completed') return 2;
        if (status === 'in_progress') return 1;
        return 0;
    }

    const now = new Date().toISOString();
    const projRef = workpack.workpack_id_code ?? id.slice(0, 8);
    const projStart = workpack.planned_start_date
        ? mspDate(workpack.planned_start_date)
        : mspDate(new Date());

    const tasks = activities.map((act, idx) => {
        const uid = idx + 1;
        const durHours = act.duration_hours != null ? Number(act.duration_hours) : 8;
        const dur = `PT${durHours}H0M0S`;
        const pct = Math.min(100, Math.max(0, act.progress_percent ?? 0));
        const complete = act.status === 'completed';

        return `
    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <Name>${esc(act.description ?? act.activity_number ?? `Task ${uid}`)}</Name>
      <Notes>${esc(act.notes ?? '')}</Notes>
      <Duration>${dur}</Duration>
      <DurationFormat>7</DurationFormat>
      <Work>${dur}</Work>
      <Start>${act.planned_start ? mspDate(act.planned_start) : projStart}</Start>
      <Finish>${act.planned_end ? mspDate(act.planned_end) : projStart}</Finish>
      <PercentComplete>${pct}</PercentComplete>
      <PercentWorkComplete>${pct}</PercentWorkComplete>
      <ActualDuration>${complete ? dur : 'PT0H0M0S'}</ActualDuration>
      <RemainingDuration>${complete ? 'PT0H0M0S' : dur}</RemainingDuration>
      <Milestone>0</Milestone>
      <Summary>0</Summary>
      <Critical>0</Critical>
      <Status>${mspStatus(act.status ?? '')}</Status>
      <ExtendedAttribute>
        <FieldID>188743731</FieldID>
        <Value>${esc(act.activity_number ?? '')}</Value>
      </ExtendedAttribute>
      <ExtendedAttribute>
        <FieldID>188743732</FieldID>
        <Value>${esc(act.discipline?.code ?? act.discipline?.name ?? '')}</Value>
      </ExtendedAttribute>
    </Task>`;
    }).join('\n');

    const disciplineNames = [...new Set(activities.map((a) => a.discipline?.code ?? a.discipline?.name ?? '').filter(Boolean))];
    const resources = disciplineNames.map((disc, idx) => `
    <Resource>
      <UID>${idx + 1}</UID>
      <ID>${idx + 1}</ID>
      <Name>${esc(disc)}</Name>
      <Type>1</Type>
      <MaxUnits>1</MaxUnits>
      <StandardRate>0</StandardRate>
    </Resource>`).join('\n');

    const assignments = activities
        .map((act, idx) => {
            const discName = act.discipline?.code ?? act.discipline?.name ?? '';
            const resUid = disciplineNames.indexOf(discName) + 1;
            if (resUid < 1) return '';
            return `
    <Assignment>
      <UID>${idx + 1}</UID>
      <TaskUID>${idx + 1}</TaskUID>
      <ResourceUID>${resUid}</ResourceUID>
      <Units>1</Units>
    </Assignment>`;
        })
        .filter(Boolean)
        .join('\n');

    const extAttrDefs = `
    <ExtendedAttribute>
      <FieldID>188743731</FieldID>
      <FieldName>Text1</FieldName>
      <Alias>Activity Code</Alias>
      <RollupType>0</RollupType>
    </ExtendedAttribute>
    <ExtendedAttribute>
      <FieldID>188743732</FieldID>
      <FieldName>Text2</FieldName>
      <Alias>Discipline</Alias>
      <RollupType>0</RollupType>
    </ExtendedAttribute>`;

    const overallProgress = 0; // Schema has no overall_progress; could be computed from activities
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${esc(workpack.title ?? projRef)}</Name>
  <Title>${esc(projRef)}</Title>
  <CreationDate>${now}</CreationDate>
  <LastSaved>${now}</LastSaved>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${projStart}</StartDate>
  <FinishDate>${workpack.planned_end_date ? mspDate(workpack.planned_end_date) : projStart}</FinishDate>
  <FYStartDate>1</FYStartDate>
  <CurrencyDigits>2</CurrencyDigits>
  <CurrencySymbol>$</CurrencySymbol>
  <CalendarUID>1</CalendarUID>
  <DefaultTaskType>1</DefaultTaskType>
  <ExtendedAttributes>${extAttrDefs}
  </ExtendedAttributes>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <IsBaselineCalendar>0</IsBaselineCalendar>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${esc(workpack.title ?? projRef)}</Name>
      <Duration>PT0H0M0S</Duration>
      <Summary>1</Summary>
      <PercentComplete>${overallProgress}</PercentComplete>
    </Task>${tasks}
  </Tasks>
  <Resources>${resources}
  </Resources>
  <Assignments>${assignments}
  </Assignments>
</Project>`;

    const ref = projRef.replace(/[^A-Za-z0-9_-]/g, '_');
    const date = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const filename = sanitiseFilename(`${ref}_${date}.xml`);

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/vnd.ms-project; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
